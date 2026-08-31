import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { Video, VideoOff, Mic, MicOff, PhoneOff, MonitorUp, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DEFAULT_AVATAR } from '../lib/utils';
import {
  getOptimalUserMedia,
  createStudioAudioDSP,
  tuneRTCPeerConnection,
  tuneVideoSender,
  boostSDPAudioQuality,
  RTC_CONFIG
} from '../utils/webrtcMediaEngine';

/**
 * GroupCallUI — N-party full-mesh WebRTC group call.
 *
 * Architecture: Every participant creates one RTCPeerConnection to every other
 * participant. Signaling is routed via Supabase Broadcast on a per-session
 * channel. Each signal payload carries `from` and `to` user IDs so messages
 * are only processed by the intended recipient.
 *
 * Props:
 *  group        — the active group object
 *  currentUser  — the logged-in user profile
 *  session      — call_session row { id, call_type, started_by }
 *  callParticipants — live array of { user_id, display_name, avatar_url }
 */
export function GroupCallUI({ group, currentUser, session, callParticipants }) {
  const {
    isMuted, isCameraOn, isScreenSharing,
    toggleMute, toggleCamera, toggleScreenShare,
    leaveGroupCall,
  } = useRakchaStore();

  const [remoteStreams, setRemoteStreams] = useState({}); // { [userId]: MediaStream }
  const [localStatus, setLocalStatus] = useState('connecting');

  const localStreamRef     = useRef(null);
  const audioDspRef        = useRef(null);
  const screenStreamRef    = useRef(null);
  const peerConnectionsRef = useRef({}); // { [userId]: RTCPeerConnection }
  const channelRef         = useRef(null);
  const localVideoRef      = useRef(null);
  const pendingCandidates  = useRef({}); // { [userId]: RTCIceCandidate[] }
  const mountedRef         = useRef(true);

  const callType = session?.call_type || 'video';

  // ── Logging helper ──────────────────────────────────────────────────────────
  const log = useCallback((msg, ...args) => {
    console.log(`[GROUP_CALL ${currentUser?.id?.slice(0, 6)}] ${msg}`, ...args);
  }, [currentUser?.id]);

  // ── Send a signal to a specific peer (or broadcast to all) ──────────────────
  const sendSignal = useCallback((toUserId, payload) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'signal',
      payload: { ...payload, from: currentUser.id, to: toUserId },
    });
  }, [currentUser?.id]);

  // ── Process queued ICE candidates once remote desc is set ───────────────────
  const drainCandidates = useCallback(async (userId) => {
    const pc = peerConnectionsRef.current[userId];
    const queue = pendingCandidates.current[userId] || [];
    if (!pc || !pc.remoteDescription) return;
    for (const c of queue) {
      try { await pc.addIceCandidate(c); } catch (e) { /* ignore */ }
    }
    pendingCandidates.current[userId] = [];
  }, []);

  // ── Create a new RTCPeerConnection for a given remote user ──────────────────
  const createPeerConnection = useCallback((remoteUserId) => {
    if (peerConnectionsRef.current[remoteUserId]) {
      return peerConnectionsRef.current[remoteUserId];
    }
    log('Creating PC for', remoteUserId.slice(0, 6));
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // 3. Attach DSP-conditioned clean audio track & HD video track
    const audioTrack = audioDspRef.current?.cleanAudioTrack || localStreamRef.current?.getAudioTracks()[0];
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];

    if (audioTrack) {
      pc.addTrack(audioTrack, localStreamRef.current);
    }
    if (videoTrack) {
      pc.addTrack(videoTrack, localStreamRef.current);
    }

    // Prioritize VP9 / H.264 codecs
    tuneRTCPeerConnection(pc);

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(remoteUserId, { type: 'ice-candidate', candidate: e.candidate });
      }
    };

    // Incoming tracks → update remote streams state
    pc.ontrack = (e) => {
      log('Track received from', remoteUserId.slice(0, 6), e.track.kind);
      if (!mountedRef.current) return;
      setRemoteStreams(prev => {
        const existing = prev[remoteUserId] || new MediaStream();
        existing.addTrack(e.track);
        return { ...prev, [remoteUserId]: existing };
      });
      setLocalStatus('connected');
    };

    pc.onconnectionstatechange = () => {
      log('PC state for', remoteUserId.slice(0, 6), '→', pc.connectionState);
      if (pc.connectionState === 'connected') {
        tuneVideoSender(pc);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        // Clean up this peer's stream
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[remoteUserId];
          return next;
        });
      }
    };

    peerConnectionsRef.current[remoteUserId] = pc;
    return pc;
  }, [log, sendSignal]);

  // ── Initiate offer to a newly-joined peer ───────────────────────────────────
  const makeOffer = useCallback(async (remoteUserId) => {
    const pc = createPeerConnection(remoteUserId);
    try {
      const rawOffer = await pc.createOffer();
      // 4. Programmatic SDP Optimizer: Injects 64kbps CBR Opus + In-Band FEC
      const enhancedSdp = boostSDPAudioQuality(rawOffer.sdp);
      const offer = { type: rawOffer.type, sdp: enhancedSdp };
      
      await pc.setLocalDescription(offer);
      await tuneVideoSender(pc);
      
      sendSignal(remoteUserId, { type: 'offer', offer });
      log('High-fidelity offer sent to', remoteUserId.slice(0, 6));
    } catch (e) {
      console.error('makeOffer error', e);
    }
  }, [createPeerConnection, sendSignal, log]);

  // ── Handle incoming signaling messages ──────────────────────────────────────
  const handleSignal = useCallback(async ({ payload }) => {
    if (!payload || payload.from === currentUser.id) return;
    if (payload.to && payload.to !== currentUser.id) return; // not for us

    const { from, type } = payload;

    try {
      if (type === 'peer_joined') {
        // A new participant announced their arrival; we (as existing) offer to them
        log('Peer joined:', from.slice(0, 6), '→ making offer');
        await makeOffer(from);
      }
      else if (type === 'offer') {
        log('Offer from', from.slice(0, 6));
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        await drainCandidates(from);
        
        const rawAnswer = await pc.createAnswer();
        // 4. Programmatic SDP Optimizer: Injects 64kbps CBR Opus + In-Band FEC
        const enhancedSdp = boostSDPAudioQuality(rawAnswer.sdp);
        const answer = { type: rawAnswer.type, sdp: enhancedSdp };
        
        await pc.setLocalDescription(answer);
        await tuneVideoSender(pc);
        
        sendSignal(from, { type: 'answer', answer });
        log('High-fidelity answer sent to', from.slice(0, 6));
      }
      else if (type === 'answer') {
        log('Answer from', from.slice(0, 6));
        const pc = peerConnectionsRef.current[from];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          await drainCandidates(from);
          await tuneVideoSender(pc);
        }
      }
      else if (type === 'ice-candidate') {
        const pc = peerConnectionsRef.current[from];
        const candidate = new RTCIceCandidate(payload.candidate);
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(candidate);
        } else {
          if (!pendingCandidates.current[from]) pendingCandidates.current[from] = [];
          pendingCandidates.current[from].push(candidate);
        }
      }
      else if (type === 'peer_left') {
        log('Peer left:', from.slice(0, 6));
        const pc = peerConnectionsRef.current[from];
        if (pc) { pc.close(); delete peerConnectionsRef.current[from]; }
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[from];
          return next;
        });
      }
    } catch (e) {
      console.error('handleSignal error', e);
    }
  }, [currentUser?.id, makeOffer, createPeerConnection, sendSignal, drainCandidates, log]);

  // ── Cleanup helper ──────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    mountedRef.current = false;
    if (audioDspRef.current) {
      audioDspRef.current.cleanup();
      audioDspRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
    }
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // ── Main init: get media, join channel, announce presence ──────────────────
  useEffect(() => {
    mountedRef.current = true;
    let channel;

    const init = async () => {
      try {
        // 1. High-Definition 1080p Ingest Layer with fallback
        const stream = await getOptimalUserMedia({
          audio: true,
          video: callType === 'video',
        });
        if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // 2. 3-Stage Web Audio DSP Graph (85Hz Highpass -> 3kHz Peaking EQ -> Dynamics Compressor)
        try {
          const dsp = createStudioAudioDSP(stream);
          audioDspRef.current = dsp;
          await dsp.resume();
          log('Web Audio 3-Stage Studio DSP Graph active.');
        } catch (dspErr) {
          console.warn('[Rakcha GroupCallUI] DSP Graph init fallback:', dspErr);
        }

        // Apply initial mute state
        stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
        if (audioDspRef.current?.cleanAudioTrack) {
          audioDspRef.current.cleanAudioTrack.enabled = !isMuted;
        }

        // Setup signaling channel
        channel = supabase.channel(`group-call-${session.id}`, {
          config: { broadcast: { ack: false, self: false } },
        });
        channelRef.current = channel;

        channel.on('broadcast', { event: 'signal' }, handleSignal);

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && mountedRef.current) {
            log('Channel subscribed — announcing peer_joined');
            // Broadcast to all existing participants that we joined
            channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { type: 'peer_joined', from: currentUser.id },
            });
            setLocalStatus('waiting');
          }
        });
      } catch (err) {
        console.error('GroupCallUI init error:', err);
        setLocalStatus('error');
      }
    };

    init();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // ── Sync mute state to local audio tracks ──────────────────────────────────
  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
    if (audioDspRef.current?.cleanAudioTrack) {
      audioDspRef.current.cleanAudioTrack.enabled = !isMuted;
    }
  }, [isMuted]);

  // ── Camera toggle: enable/disable or dynamically add local video track ────
  useEffect(() => {
    const handleCameraToggle = async () => {
      if (!localStreamRef.current) return;
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (isCameraOn) {
        if (!videoTrack) {
          try {
            const newStream = await getOptimalUserMedia({ video: true, audio: false });
            const newVideoTrack = newStream.getVideoTracks()[0];
            localStreamRef.current.addTrack(newVideoTrack);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = null;
              localVideoRef.current.srcObject = localStreamRef.current;
            }
            Object.values(peerConnectionsRef.current).forEach(async (pc) => {
              pc.addTrack(newVideoTrack, localStreamRef.current);
              tuneRTCPeerConnection(pc);
              await tuneVideoSender(pc);
            });
          } catch (e) {
            console.error('Failed to get video track on toggle', e);
            toggleCamera();
          }
        } else {
          videoTrack.enabled = true;
        }
      } else {
        if (videoTrack) videoTrack.enabled = false;
      }
    };
    handleCameraToggle();
  }, [isCameraOn]);

  // ── Screen share ────────────────────────────────────────────────────────────
  const handleScreenShare = async () => {
    const { isScreenSharing } = useRakchaStore.getState();
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrack.onended = stopScreenShare;

      // Replace video sender in all peer connections
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = new MediaStream([screenTrack]);
      }
      toggleScreenShare();
    } catch (e) {
      console.error('Screen share error', e);
    }
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    Object.values(peerConnectionsRef.current).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
    });
    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    const { isScreenSharing } = useRakchaStore.getState();
    if (isScreenSharing) toggleScreenShare();
  };

  // ── Leave call ─────────────────────────────────────────────────────────────
  const handleLeave = async () => {
    // Signal peers we are leaving
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { type: 'peer_left', from: currentUser.id },
      });
      // Small delay so the signal goes out before cleanup
      await new Promise(r => setTimeout(r, 200));
    }
    cleanup();
    await leaveGroupCall(session.id);
  };

  // ── Remote video tile refs (we need individual refs per peer) ────────────────
  const RemoteVideoTile = ({ userId, stream }) => {
    const ref = useRef(null);
    const participant = callParticipants.find(p => p.user_id === userId);
    const name = participant?.display_name || participant?.username || 'Participant';
    const avatar = participant?.avatar_url || DEFAULT_AVATAR;

    useEffect(() => {
      if (ref.current && stream) ref.current.srcObject = stream;
    }, [stream]);

    return (
      <div className="relative bg-zinc-900 rounded-2xl overflow-hidden flex items-center justify-center aspect-video">
        <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
        {!stream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <img src={avatar} alt={name} className="w-16 h-16 rounded-full object-cover border-2 border-white/10 animate-pulse" />
            <span className="text-xs text-white/60">Connecting…</span>
          </div>
        )}
        {/* Name badge */}
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
          <span className="bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {name}
          </span>
        </div>
      </div>
    );
  };

  // Determine grid columns based on participant count
  const remoteUserIds = Object.keys(remoteStreams);
  const totalTiles = remoteUserIds.length + 1; // +1 for local
  const gridCols =
    totalTiles <= 1 ? 'grid-cols-1' :
    totalTiles <= 2 ? 'grid-cols-2' :
    totalTiles <= 4 ? 'grid-cols-2' :
    totalTiles <= 6 ? 'grid-cols-3' :
                      'grid-cols-3';

  return (
    <div className="flex-1 flex flex-col bg-[#090B10] relative overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-black/40 backdrop-blur-md border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
          <span className="font-semibold text-sm">{group.name}</span>
          <span className="text-xs text-white/40 ml-1">Group Call</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Users size={13} />
          <span>{callParticipants.length} in call</span>
        </div>
      </div>

      {/* Video grid */}
      <div className={`flex-1 overflow-hidden p-4 grid ${gridCols} gap-3 auto-rows-fr`}>
        {/* Remote tiles */}
        {remoteUserIds.map(userId => (
          <RemoteVideoTile
            key={userId}
            userId={userId}
            stream={remoteStreams[userId]}
          />
        ))}

        {/* Local tile */}
        <div className="relative bg-zinc-900 rounded-2xl overflow-hidden flex items-center justify-center aspect-video ring-2 ring-primary/60">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!isCameraOn && (
            <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center gap-2">
              <img
                src={currentUser?.avatar_url || DEFAULT_AVATAR}
                alt="You"
                className="w-16 h-16 rounded-full object-cover border-2 border-white/10"
              />
            </div>
          )}
          {/* YOU badge */}
          <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
            <span className="bg-primary/80 backdrop-blur-sm text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              You {isMuted && '(Muted)'}
            </span>
          </div>
        </div>

        {/* Waiting state: show placeholders for participants not yet streaming */}
        {callParticipants
          .filter(p => p.user_id !== currentUser?.id && !remoteStreams[p.user_id])
          .map(p => (
            <div
              key={p.user_id}
              className="relative bg-zinc-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center aspect-video gap-2"
            >
              <img
                src={p.avatar_url || DEFAULT_AVATAR}
                alt={p.display_name}
                className="w-16 h-16 rounded-full object-cover border-2 border-white/10 animate-pulse"
              />
              <span className="text-xs text-white/50">
                {p.display_name || p.username || 'Participant'}
              </span>
              <span className="text-[10px] text-white/30">Joining…</span>
            </div>
          ))
        }
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-5 shrink-0 bg-black/40 backdrop-blur-md border-t border-white/5">
        <CallCtrlBtn
          active={isMuted}
          activeColor="text-red-400"
          label={isMuted ? 'Unmute' : 'Mute'}
          onClick={toggleMute}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </CallCtrlBtn>

        {callType === 'video' && (
          <CallCtrlBtn
            active={!isCameraOn}
            activeColor="text-red-400"
            label={isCameraOn ? 'Stop Cam' : 'Start Cam'}
            onClick={toggleCamera}
          >
            {isCameraOn ? <Video size={22} /> : <VideoOff size={22} />}
          </CallCtrlBtn>
        )}

        <CallCtrlBtn
          active={isScreenSharing}
          activeColor="text-green-400"
          label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
          onClick={handleScreenShare}
        >
          <MonitorUp size={22} />
        </CallCtrlBtn>

        <div className="w-px h-8 bg-white/10" />

        <button
          onClick={handleLeave}
          className="bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-2xl transition shadow-lg shadow-red-500/30 flex items-center gap-2 font-semibold"
          title="Leave Call"
        >
          <PhoneOff size={20} />
          <span className="text-sm">Leave</span>
        </button>
      </div>
    </div>
  );
}

function CallCtrlBtn({ children, onClick, label, active, activeColor }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex flex-col items-center gap-1.5 transition ${active ? activeColor : 'text-white/60 hover:text-white'}`}
    >
      <div
        className={`p-3 rounded-xl transition ${
          active ? 'bg-red-500/15 ring-1 ring-red-500/40' : 'bg-white/5 hover:bg-white/10'
        }`}
      >
        {children}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
