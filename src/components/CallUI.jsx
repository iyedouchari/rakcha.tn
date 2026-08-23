import React, { useEffect, useRef, useState } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { Video, VideoOff, Mic, MicOff, PhoneOff, MonitorUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { playCallingSound, stopCallingSound } from '../lib/audio';
import { DEFAULT_AVATAR } from '../lib/utils';

export function CallUI({ group, currentUser, onLeave }) {
  const { isMuted, isCameraOn, toggleMute, toggleCamera, isCaller, activeCallType, endCall } = useRakchaStore();
  const [callStatus, setCallStatus] = useState(isCaller ? 'Calling...' : 'Connecting...');
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  const localStreamRef = useRef(null);
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
        log('Requesting local media...', { audio: true, video: activeCallType === 'video' });
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: activeCallType === 'video' 
        });
        
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Apply initial mute state
        stream.getAudioTracks().forEach(t => t.enabled = !isMuted);
        
        // Initialize remote stream placeholder
        remoteStreamRef.current = new MediaStream();
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
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
              log('Received USER_JOINED. Creating offer...');
              if (!peerConnectionRef.current) {
                await createPeerConnection();
              }
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'offer', offer, from: currentUser.id }
              });
              log('Offer sent.');
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
              log('Received offer. Creating answer...');
              if (!peerConnectionRef.current) {
                await createPeerConnection();
              }
              const pc = peerConnectionRef.current;
              
              await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
              processIceQueue(pc);
              
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'answer', answer, from: currentUser.id }
              });
              log('Answer sent.');
            } 
            else if (payload.type === 'answer') {
              log('Received answer. Setting remote description...');
              const pc = peerConnectionRef.current;
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                processIceQueue(pc);
                setCallStatus('');
              }
            } 
            else if (payload.type === 'ice-candidate') {
              const pc = peerConnectionRef.current;
              const candidate = new RTCIceCandidate(payload.candidate);
              if (pc && pc.remoteDescription) {
                log('Adding ICE candidate directly.');
                await pc.addIceCandidate(candidate);
              } else {
                log('Queueing ICE candidate.');
                iceCandidateQueueRef.current.push(candidate);
              }
            }
            else if (payload.type === 'call_ended') {
              log('Remote user ended the call.');
              setCallStatus('Call ended');
              setTimeout(() => handleEndCall(false), 1500); // end after brief delay
            }
          } catch (e) {
            console.error('Signaling error', e);
          }
        });

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
      log('Initializing RTCPeerConnection');
      // Use standard STUN servers. In production Rakcha, add TURN servers here.
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Add local tracks to PC
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          log('Adding local track to PC', track.kind);
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          log('Sending local ICE candidate');
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'ice-candidate', candidate: event.candidate, from: currentUser.id }
          });
        }
      };

      pc.ontrack = (event) => {
        log('Received remote track', event.track.kind);
        if (remoteStreamRef.current) {
          remoteStreamRef.current.addTrack(event.track);
          setCallStatus(''); // Clear calling status once we have media
        }
      };

      pc.onconnectionstatechange = () => {
        log('Connection state changed:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setCallStatus('Disconnected');
        }
      };

      peerConnectionRef.current = pc;
    };

    initMediaAndChannel();

    return () => {
      mounted = false;
      log('Cleaning up CallUI...');
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []); // Run once on mount

  // Handle local Audio Mute toggle
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !isMuted;
        log('Audio track enabled:', !isMuted);
      });
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
          log('Upgrading call to Video...');
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newVideoTrack = newStream.getVideoTracks()[0];
            
            // Add track to local stream
            localStreamRef.current.addTrack(newVideoTrack);
            
            // Re-assign srcObject so local video updates
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = null;
              localVideoRef.current.srcObject = localStreamRef.current;
            }

            // Add track to PeerConnection
            peerConnectionRef.current.addTrack(newVideoTrack, localStreamRef.current);
            
            // Renegotiate with remote peer
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);
            
            channelRef.current.send({
              type: 'broadcast',
              event: 'signal',
              payload: { type: 'offer', offer, from: currentUser.id }
            });
            log('Renegotiation offer sent.');
            
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
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'offer', offer, from: currentUser.id }
          });
        }
        
        // Update local video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([screenTrack]);
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
        sender.replaceTrack(cameraTrack);
      } else {
        sender.replaceTrack(null);
      }
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    log('Screen sharing stopped');
  };

  const handleEndCall = (broadcast = true) => {
    log('Ending call. Broadcast:', broadcast);
    if (broadcast && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { type: 'call_ended', from: currentUser.id }
      }).then(() => {
        // give it a tiny moment to send
        endCall();
        onLeave();
      }).catch(() => {
        endCall();
        onLeave();
      });
    } else {
      endCall();
      onLeave();
    }
  };


  return (
    <div className="flex-1 flex flex-col bg-[#0B0E14] relative">
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
        
        {/* Local Video (PiP) */}
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
