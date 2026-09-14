import React, { useEffect, useRef, useState } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { Video, VideoOff, Mic, MicOff, PhoneOff, MonitorUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { playCallingSound, stopCallingSound } from '../lib/audio';
import { DEFAULT_AVATAR } from '../lib/utils';
import {
  getOptimalUserMedia,
  createStudioAudioDSP,
  tuneRTCPeerConnection,
  tuneVideoSender,
  boostSDPAudioQuality,
  RTC_CONFIG
} from '../utils/webrtcMediaEngine';

export function CallUI({ group, currentUser, onLeave }) {
  const { isMuted, isCameraOn, toggleMute, toggleCamera, isCaller, activeCallType, endCall, cancelOutgoingCall } = useRakchaStore();
  const [callStatus, setCallStatus] = useState(isCaller ? 'Calling...' : 'Connecting...');
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  
  const localStreamRef = useRef(null);
  const audioDspRef = useRef(null);
  const screenStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const channelRef = useRef(null);
  
  const iceCandidateQueueRef = useRef([]);
  const hasJoinedRef = useRef(false);

  // Helper to log with context
  const log = (msg, ...args) => {
    console.log(`[CALL ${isCaller ? 'CALLER' : 'RECEIVER'}] ${msg}`, ...args);
  };

  useEffect(() => {
    if (callStatus === 'Calling...') {
      playCallingSound();
    } else {
      stopCallingSound();
    }
    return () => {
      stopCallingSound();
    };
  }, [callStatus]);

  useEffect(() => {
    let mounted = true;

    const initMediaAndChannel = async () => {
      try {
        log('Requesting studio 1080p / 48kHz local media...', { audio: true, video: activeCallType === 'video' });
        
        // 1. High-Definition 1080p Ingest Layer with fallback
        const stream = await getOptimalUserMedia({ 
          audio: true, 
          video: activeCallType === 'video' 
        });
        
        if (!mounted) {
          stream.getTracks().forEach(t => {
            try { t.stop(); t.enabled = false; } catch { /* ignore */ }
          });
          return;
        }

        localStreamRef.current = stream;
        useRakchaStore.setState({ localStream: stream, isCalling: true });

        // Bind local stream with strict muted enforcement to prevent acoustic feedback loopback
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.defaultMuted = true;
        }

        // 2. 3-Stage Web Audio DSP Graph (85Hz Highpass -> 3kHz Peaking EQ -> Dynamics Compressor)
        try {
          const dsp = createStudioAudioDSP(stream);
          audioDspRef.current = dsp;
          await dsp.resume();
          log('Web Audio 3-Stage Studio DSP Graph active.');
        } catch (dspErr) {
          console.warn('[Rakcha CallUI] DSP Graph init fallback:', dspErr);
        }

        // Apply initial mute state to both raw and clean audio tracks
        stream.getAudioTracks().forEach(t => {
          t.enabled = !isMuted;
        });
        if (audioDspRef.current?.cleanAudioTrack) {
          audioDspRef.current.cleanAudioTrack.enabled = !isMuted;
        }
        
        // Setup Signaling Channel with broadcast enabled
        const channel = supabase.channel(`call-${group.id}`, {
          config: { broadcast: { ack: false, self: false } }
        });
        channelRef.current = channel;

        // Register Signaling Listeners
        channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
          if (payload.from === currentUser.id) return;
          
          try {
            if (payload.type === 'USER_JOINED' && isCaller) {
              log('Received USER_JOINED. Creating optimized offer...');
              if (!peerConnectionRef.current) {
                await createPeerConnection();
              }
              const pc = peerConnectionRef.current;
              
              if (audioDspRef.current) {
                await audioDspRef.current.resume().catch(() => {});
              }
              
              const rawOffer = await pc.createOffer();
              
              // 4. Programmatic SDP Optimizer: Injects 64kbps CBR Opus + In-Band FEC
              const enhancedSdp = boostSDPAudioQuality(rawOffer.sdp);
              const offer = { type: rawOffer.type, sdp: enhancedSdp };
              
              await pc.setLocalDescription(offer);
              await tuneVideoSender(pc);
              
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'offer', offer, from: currentUser.id }
              });
              log('High-fidelity offer sent.');
            } 
            else if (payload.type === 'CALLER_JOINED' && !isCaller) {
              log('Caller joined/rejoined. Sending USER_JOINED...');
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'USER_JOINED', from: currentUser.id }
              });
            } 
            else if (payload.type === 'offer') {
              log('Received offer. Creating optimized answer...');
              if (!peerConnectionRef.current) {
                await createPeerConnection();
              }
              const pc = peerConnectionRef.current;
              
              if (audioDspRef.current) {
                await audioDspRef.current.resume().catch(() => {});
              }
              
              await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
              await processIceQueue(pc);
              
              const rawAnswer = await pc.createAnswer();
              
              // 4. Programmatic SDP Optimizer: Injects 64kbps CBR Opus + In-Band FEC
              const enhancedSdp = boostSDPAudioQuality(rawAnswer.sdp);
              const answer = { type: rawAnswer.type, sdp: enhancedSdp };
              
              await pc.setLocalDescription(answer);
              await tuneVideoSender(pc);
              
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'answer', answer, from: currentUser.id }
              });
              log('High-fidelity answer sent.');
            } 
            else if (payload.type === 'answer') {
              log('Received answer. Setting remote description...');
              const pc = peerConnectionRef.current;
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                await processIceQueue(pc);
                setCallStatus('');
                await tuneVideoSender(pc);
              }
            } 
            else if (payload.type === 'ice-candidate') {
              const pc = peerConnectionRef.current;
              const candidate = new RTCIceCandidate(payload.candidate);
              if (pc && pc.remoteDescription) {
                log(`Adding ICE candidate directly: [${candidate.protocol || ''} ${candidate.type || ''}]`);
                await pc.addIceCandidate(candidate).catch(e => console.warn('[CallUI] Add ICE candidate notice:', e));
              } else {
                log('Queueing ICE candidate (remoteDescription not set yet).');
                iceCandidateQueueRef.current.push(candidate);
              }
            }
            else if (payload.type === 'call_cancelled' || payload.type === 'call_ended') {
              log(`Remote user ${payload.type === 'call_cancelled' ? 'cancelled' : 'ended'} the call.`);
              setCallStatus(payload.type === 'call_cancelled' ? 'Call cancelled' : 'Call ended');
              stopCallingSound();
              if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => {
                  try { t.stop(); t.enabled = false; } catch { /* ignore */ }
                });
              }
              if (audioDspRef.current) {
                try { audioDspRef.current.cleanup(); } catch { /* ignore */ }
              }
              setTimeout(() => handleEndCall(false), 500);
            }
          } catch (e) {
            console.error('[CallUI] Signaling error', e);
          }
        });

        // Listen for direct broadcast cancellation event
        channel.on('broadcast', { event: 'call_cancelled' }, async () => {
          log('Received direct call_cancelled broadcast');
          setCallStatus('Call cancelled');
          stopCallingSound();
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => {
              try { t.stop(); t.enabled = false; } catch { /* ignore */ }
            });
          }
          if (audioDspRef.current) {
            try { audioDspRef.current.cleanup(); } catch { /* ignore */ }
          }
          setTimeout(() => handleEndCall(false), 500);
        });

        // Listen for postgres_changes on call_sessions
        channel.on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `group_id=eq.${group.id}` },
          (payload) => {
            if (payload.new.status === 'cancelled' || payload.new.ended_at) {
              log('Call session marked ended/cancelled in database');
              setCallStatus('Call ended');
              setTimeout(() => handleEndCall(false), 500);
            }
          }
        );

        log('Subscribing to channel...');
        channel.subscribe(async (status) => {
          log('Channel status:', status);
          if (status === 'SUBSCRIBED') {
            if (!hasJoinedRef.current) {
              hasJoinedRef.current = true;
              log(`Sending ${isCaller ? 'CALLER_JOINED' : 'USER_JOINED'} signal...`);
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: isCaller ? 'CALLER_JOINED' : 'USER_JOINED', from: currentUser.id }
              });
            }
          }
        });

      } catch (err) {
        console.error('Failed to get local stream or init call', err);
        setCallStatus('Camera/Mic error');
      }
    };

    const processIceQueue = async (pc) => {
      while (iceCandidateQueueRef.current.length > 0) {
        const candidate = iceCandidateQueueRef.current.shift();
        log('Processing queued ICE candidate');
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          console.error('Error adding queued ICE candidate', e);
        }
      }
    };

    const createPeerConnection = async () => {
      log('Initializing RTCPeerConnection with STUN/TURN configuration');
      const pc = new RTCPeerConnection(RTC_CONFIG);

      // 3. Attach Outbound Tracks & Verify State
      const audioTrack = audioDspRef.current?.cleanAudioTrack || localStreamRef.current?.getAudioTracks()[0];
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];

      if (audioTrack) {
        audioTrack.enabled = !isMuted;
        log('Attaching Outbound Clean Audio Track to PC:', audioTrack.id, 'enabled:', audioTrack.enabled);
        pc.addTrack(audioTrack, localStreamRef.current);
      }
      if (videoTrack) {
        videoTrack.enabled = isCameraOn;
        log('Attaching Outbound HD Video Track to PC:', videoTrack.id, 'enabled:', videoTrack.enabled);
        pc.addTrack(videoTrack, localStreamRef.current);
      }

      // Prioritize VP9 / H.264 video codecs
      tuneRTCPeerConnection(pc);

      // ICE Candidates handling & diagnostic tracing
      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          log(`Local ICE candidate gathered: [${event.candidate.protocol || 'unknown'} ${event.candidate.type || ''}]`, event.candidate.candidate);
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'ice-candidate', candidate: event.candidate, from: currentUser.id }
          });
        } else if (!event.candidate) {
          log('Local ICE candidate gathering completed (end-of-candidates).');
        }
      };

      pc.onicecandidateerror = (event) => {
        console.warn(`[CallUI ICE Error] Code: ${event.errorCode}, Text: ${event.errorText}, URL: ${event.url}`);
      };

      pc.oniceconnectionstatechange = () => {
        log('ICE Connection State ->', pc.iceConnectionState);
      };

      pc.onicegatheringstatechange = () => {
        log('ICE Gathering State ->', pc.iceGatheringState);
      };

      pc.onsignalingstatechange = () => {
        log('Signaling State ->', pc.signalingState);
      };

      // Remote Track Attachment & Autoplay Handling
      pc.ontrack = (event) => {
        log('pc.ontrack received remote track:', event.track.kind, 'ID:', event.track.id, 'Streams:', event.streams?.length);
        
        const remoteStream = (event.streams && event.streams[0])
          ? event.streams[0]
          : (remoteStreamRef.current || new MediaStream());

        if (!event.streams || !event.streams[0]) {
          if (!remoteStream.getTracks().some(t => t.id === event.track.id)) {
            remoteStream.addTrack(event.track);
          }
        }
        remoteStreamRef.current = remoteStream;

        // 1. Video Element Binding (Unmuted, auto-play handled)
        if (remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
          remoteVideoRef.current.muted = false;
          const vPromise = remoteVideoRef.current.play();
          if (vPromise !== undefined) {
            vPromise.catch((err) => {
              console.warn('[CallUI] Remote video autoplay prevented/interrupted:', err);
            });
          }
        }

        // 2. Dedicated Audio Element Binding (Guarantees uninterrupted audio playback)
        if (remoteAudioRef.current) {
          if (remoteAudioRef.current.srcObject !== remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
          remoteAudioRef.current.muted = false;
          const aPromise = remoteAudioRef.current.play();
          if (aPromise !== undefined) {
            aPromise.catch((err) => {
              console.warn('[CallUI] Remote audio element playback blocked:', err);
            });
          }
        }

        setCallStatus(''); // Clear calling status once we have active incoming media
      };

      pc.onconnectionstatechange = () => {
        log('PeerConnection State ->', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('');
          tuneVideoSender(pc);
        } else if (pc.connectionState === 'disconnected') {
          log('PeerConnection disconnected, waiting for reconnection...');
        } else if (pc.connectionState === 'failed') {
          log('PeerConnection failed.');
          setCallStatus('Disconnected');
        }
      };

      peerConnectionRef.current = pc;
    };

    initMediaAndChannel();

    return () => {
      mounted = false;
      log('Cleaning up CallUI and DSP audio context...');
      stopCallingSound();
      if (audioDspRef.current) {
        try {
          audioDspRef.current.cleanup();
        } catch {
          /* ignore */
        }
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
            t.enabled = false;
          } catch {
            /* ignore */
          }
        });
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
            t.enabled = false;
          } catch {
            /* ignore */
          }
        });
      }
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch {
          /* ignore */
        }
      }
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {
          /* ignore */
        }
      }
      useRakchaStore.setState({ isCalling: false, localStream: null });
    };
  }, []); // Run once on mount

  // Handle local Audio Mute toggle
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !isMuted;
        log('Local stream audio track enabled:', !isMuted);
      });
    }
    if (audioDspRef.current?.cleanAudioTrack) {
      audioDspRef.current.cleanAudioTrack.enabled = !isMuted;
      log('DSP clean audio track enabled:', !isMuted);
    }
    if (audioDspRef.current) {
      audioDspRef.current.resume().catch(() => {});
    }
  }, [isMuted]);

  // Handle local Camera toggle & Renegotiation (Audio -> Video upgrade)
  useEffect(() => {
    const handleCameraToggle = async () => {
      // If we don't have refs ready, ignore. This also avoids running on initial mount if stream isn't ready.
      if (!localStreamRef.current || !peerConnectionRef.current || !channelRef.current) return;
      
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      
      if (isCameraOn) {
        if (!videoTrack) {
          log('Upgrading call to 1080p Video...');
          try {
            const newStream = await getOptimalUserMedia({ video: true, audio: false });
            const newVideoTrack = newStream.getVideoTracks()[0];
            newVideoTrack.enabled = true;
            
            // Add track to local stream
            localStreamRef.current.addTrack(newVideoTrack);
            
            // Re-assign srcObject so local video updates with muted=true enforced
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = null;
              localVideoRef.current.srcObject = localStreamRef.current;
              localVideoRef.current.muted = true;
              localVideoRef.current.defaultMuted = true;
            }

            // Add track to PeerConnection
            peerConnectionRef.current.addTrack(newVideoTrack, localStreamRef.current);
            tuneRTCPeerConnection(peerConnectionRef.current);
            
            // Renegotiate with remote peer with enhanced SDP
            const rawOffer = await peerConnectionRef.current.createOffer();
            const enhancedOfferSdp = boostSDPAudioQuality(rawOffer.sdp);
            const offer = { type: rawOffer.type, sdp: enhancedOfferSdp };
            
            await peerConnectionRef.current.setLocalDescription(offer);
            await tuneVideoSender(peerConnectionRef.current);
            
            channelRef.current.send({
              type: 'broadcast',
              event: 'signal',
              payload: { type: 'offer', offer, from: currentUser.id }
            });
            log('Renegotiation offer sent with enhanced 1080p video.');
            
          } catch (e) {
            console.error("Failed to turn camera on", e);
            toggleCamera(); // Revert state in store if permission denied
          }
        } else {
          // Track exists, just enable it
          videoTrack.enabled = true;
          log('Video track enabled');
        }
      } else {
        if (videoTrack) {
          // Disable track to pause video (black screen), but don't destroy it so renegotiation isn't needed
          videoTrack.enabled = false;
          log('Video track disabled');
        }
      }
    };
    
    handleCameraToggle();
  }, [isCameraOn]);

  const handleScreenShareToggle = async () => {
    if (!peerConnectionRef.current || !localStreamRef.current) return;
    const { isScreenSharing, toggleScreenShare } = useRakchaStore.getState();

    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        
        const screenTrack = stream.getVideoTracks()[0];
        screenTrack.enabled = true;
        
        // Listen to the browser's "Stop sharing" button
        screenTrack.onended = () => {
          stopScreenSharing();
        };

        // Replace track in peer connection
        const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        } else {
          // If started as audio only, add track
          peerConnectionRef.current.addTrack(screenTrack, localStreamRef.current);
          const rawOffer = await peerConnectionRef.current.createOffer();
          const enhancedOfferSdp = boostSDPAudioQuality(rawOffer.sdp);
          const offer = { type: rawOffer.type, sdp: enhancedOfferSdp };
          await peerConnectionRef.current.setLocalDescription(offer);
          await tuneVideoSender(peerConnectionRef.current);
          
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'offer', offer, from: currentUser.id }
          });
        }
        
        // Update local video element with strict muted enforcement
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([screenTrack]);
          localVideoRef.current.muted = true;
          localVideoRef.current.defaultMuted = true;
        }
        toggleScreenShare(); // sets to true
        log('Screen sharing started');
      } catch (e) {
        console.error('Failed to share screen', e);
      }
    } else {
      stopScreenSharing();
    }
  };

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    const { isCameraOn, toggleScreenShare, isScreenSharing } = useRakchaStore.getState();
    if (isScreenSharing) toggleScreenShare(); // set to false

    if (!peerConnectionRef.current || !localStreamRef.current) return;

    const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
    const cameraTrack = localStreamRef.current.getVideoTracks()[0];

    if (sender) {
      if (isCameraOn && cameraTrack) {
        cameraTrack.enabled = true;
        sender.replaceTrack(cameraTrack);
      } else {
        sender.replaceTrack(null);
      }
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.muted = true;
      localVideoRef.current.defaultMuted = true;
    }
    log('Screen sharing stopped');
  };

  const handleEndCall = async (broadcast = true) => {
    log('Ending/cancelling call. Broadcast:', broadcast);
    const isInvitationPending = isCaller && callStatus === 'Calling...';

    // 1. Stop all active media tracks immediately to shut down mic/cam hardware instantly
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
          t.enabled = false;
        } catch {
          /* ignore */
        }
      });
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
          t.enabled = false;
        } catch {
          /* ignore */
        }
      });
    }
    if (audioDspRef.current) {
      try {
        audioDspRef.current.cleanup();
      } catch {
        /* ignore */
      }
    }

    // Stop ringback sound
    stopCallingSound();

    if (broadcast && channelRef.current) {
      try {
        const signalType = isInvitationPending ? 'call_cancelled' : 'call_ended';
        await channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: signalType, from: currentUser.id }
        }).catch(() => {});

        if (isInvitationPending) {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'call_cancelled',
            payload: { type: 'call_cancelled', groupId: group.id, from: currentUser.id }
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('[CallUI] Broadcast end signal notice:', e);
      }
    }

    if (isInvitationPending) {
      try {
        await cancelOutgoingCall({
          groupId: group.id,
          targetUserId: group.otherUserId,
          stream: localStreamRef.current
        });
      } catch {
        endCall();
      }
    } else {
      endCall();
    }

    onLeave();
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0B0E14] relative">
      {/* Hidden dedicated remote audio element to ensure audio is always played regardless of video rendering */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="flex-1 relative overflow-hidden">
        {/* Remote Video (Full Screen) */}
        <div className="absolute inset-0 bg-surface-container-lowest flex items-center justify-center">
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className={`w-full h-full object-cover transition-opacity duration-300 ${callStatus ? 'opacity-0' : 'opacity-100'}`}
          />
          {/* Show avatar if we are connecting, or if video is off */}
          {callStatus && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
              <img src={group.avatar_url || DEFAULT_AVATAR} className={`w-32 h-32 rounded-full border-4 border-surface-container mb-4 object-cover ${callStatus.includes('ing') ? 'animate-pulse' : ''}`} alt="Group" />
              <h2 className="text-xl font-bold mb-2">{group.name}</h2>
              <p className="text-muted-foreground">{callStatus}</p>
            </div>
          )}
        </div>
        
        {/* Local Video (PiP) with guaranteed muted state */}
        <div className="absolute top-6 right-6 w-48 aspect-[3/4] bg-surface-container-high rounded-2xl overflow-hidden shadow-2xl border-2 border-outline-variant/20 z-20">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          {!isCameraOn && (
            <div className="absolute inset-0 bg-surface-container-highest flex flex-col items-center justify-center">
              <img src={currentUser.avatar_url || DEFAULT_AVATAR} className="w-16 h-16 rounded-full object-cover mb-2" alt="Me" />
              <span className="text-xs font-bold bg-black/50 px-2 py-0.5 rounded-md">You</span>
            </div>
          )}
          <div className="absolute bottom-2 right-2 bg-black/60 p-1.5 rounded-lg backdrop-blur-md">
            {isMuted ? <MicOff size={14} className="text-red-500" /> : <Mic size={14} />}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface-container-highest/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-outline-variant/20 flex items-center gap-6 shadow-2xl z-30">
        <CtrlBtn active={isMuted} activeColor="text-red-500" onClick={toggleMute} label={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </CtrlBtn>
        <CtrlBtn active={!isCameraOn} activeColor="text-red-500" onClick={toggleCamera} label={isCameraOn ? 'Start Cam' : 'Stop Cam'}>
          {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
        </CtrlBtn>
        <CtrlBtn active={useRakchaStore.getState().isScreenSharing} activeColor="text-green-500" onClick={handleScreenShareToggle} label="Share Screen">
          <MonitorUp size={24} />
        </CtrlBtn>
        <div className="w-px h-8 bg-outline-variant/30" />
        <button onClick={() => handleEndCall(true)} className="bg-red-500 hover:bg-red-600 text-white p-3.5 rounded-2xl transition shadow-lg shadow-red-500/20" title="End Call">
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}

function CtrlBtn({ children, onClick, label, active, activeColor }) {
  return (
    <button onClick={onClick} title={label} className={`flex flex-col items-center gap-1.5 transition ${active ? activeColor : 'text-muted-foreground hover:text-white'}`}>
      <div className={`p-3 rounded-xl transition ${active ? 'bg-red-500/10' : 'bg-surface-container hover:bg-surface-bright'}`}>
        {children}
      </div>
    </button>
  );
}
