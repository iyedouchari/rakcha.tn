import React, { useEffect, useRef, useCallback } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DEFAULT_AVATAR } from '../lib/utils';
import { playIncomingRingtone, stopIncomingRingtone } from '../lib/audio';
import { normalizeUsername } from '../lib/utils';

export function IncomingCallModal() {
  const incomingCall = useRakchaStore((s) => s.incomingCall);
  const acceptCall = useRakchaStore((s) => s.acceptCall);
  const declineCall = useRakchaStore((s) => s.declineCall);
  const showToast = useRakchaStore((s) => s.showToast);

  const callChannelRef = useRef(null);

  const handleDismiss = useCallback(
    (message = 'Call cancelled by caller') => {
      stopIncomingRingtone();
      if (callChannelRef.current) {
        try {
          supabase.removeChannel(callChannelRef.current);
          callChannelRef.current = null;
        } catch {
          /* ignore */
        }
      }
      useRakchaStore.setState({ incomingCall: null });
      if (message && showToast) {
        showToast(message, 'info');
      }
    },
    [showToast]
  );

  // Subscribe to call-specific channel and database changes while incoming call is active
  useEffect(() => {
    if (!incomingCall) {
      stopIncomingRingtone();
      return;
    }

    playIncomingRingtone();

    const groupId = incomingCall.groupId;
    if (groupId) {
      const channel = supabase.channel(`call-incoming-${groupId}-${Date.now()}`, {
        config: { broadcast: { ack: false, self: false } },
      });
      callChannelRef.current = channel;

      // 1. Listen for real-time cancellation broadcast event
      channel.on('broadcast', { event: 'call_cancelled' }, () => {
        handleDismiss('Call cancelled by caller');
      });

      channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
        if (payload?.type === 'call_cancelled') {
          handleDismiss('Call cancelled by caller');
        }
      });

      // 2. Listen for Postgres changes on call_sessions table
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `group_id=eq.${groupId}` },
        (payload) => {
          if (payload?.new && (payload.new.status === 'cancelled' || payload.new.ended_at)) {
            handleDismiss('Call cancelled by caller');
          }
        }
      );

      channel.subscribe();
    }

    return () => {
      stopIncomingRingtone();
      if (callChannelRef.current) {
        try {
          supabase.removeChannel(callChannelRef.current);
          callChannelRef.current = null;
        } catch {
          /* ignore */
        }
      }
    };
  }, [incomingCall, handleDismiss]);

  if (!incomingCall) return null;

  const normalizedName = normalizeUsername(incomingCall.callerName);
  const avatar = incomingCall.callerAvatar || DEFAULT_AVATAR;
  const isVideo = incomingCall.callType === 'video';

  const handleAcceptClick = async () => {
    // Graceful race condition check: check if call was cancelled in database right before accepting
    if (incomingCall?.groupId) {
      try {
        const { data } = await supabase
          .from('call_sessions')
          .select('status, ended_at')
          .eq('group_id', incomingCall.groupId)
          .maybeSingle();

        if (data && (data.status === 'cancelled' || data.ended_at)) {
          handleDismiss('Call was already cancelled');
          return;
        }
      } catch {
        // Transient network failure should not block answering
      }
    }

    stopIncomingRingtone();
    if (callChannelRef.current) {
      try {
        supabase.removeChannel(callChannelRef.current);
        callChannelRef.current = null;
      } catch {
        /* ignore */
      }
    }
    acceptCall();
  };

  const handleDeclineClick = () => {
    stopIncomingRingtone();
    if (callChannelRef.current) {
      try {
        supabase.removeChannel(callChannelRef.current);
        callChannelRef.current = null;
      } catch {
        /* ignore */
      }
    }
    declineCall();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-container-high w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20 animate-in slide-in-from-top-10 duration-300">
        <div className="p-6 flex flex-col items-center text-center relative">
          <div className="absolute top-0 left-0 w-full h-24 bg-primary/20 blur-3xl -z-10" />

          <img
            src={avatar}
            alt={normalizedName}
            className="w-20 h-20 rounded-full object-cover border-4 border-surface-container shadow-xl mb-4 animate-bounce"
          />

          <h2 className="text-xl font-bold mb-1">{normalizedName}</h2>
          <p className="text-muted-foreground flex items-center justify-center gap-1.5">
            {isVideo ? <Video size={16} /> : <Phone size={16} />}
            Incoming {isVideo ? 'video' : 'audio'} call...
          </p>
        </div>

        <div className="bg-surface-container p-6 flex items-center justify-center gap-8">
          <button
            onClick={handleDeclineClick}
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-white transition group"
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 group-hover:bg-red-500 flex items-center justify-center transition-colors">
              <PhoneOff size={24} className="text-red-500 group-hover:text-white" />
            </div>
            <span className="text-sm font-medium">Decline</span>
          </button>

          <button
            onClick={handleAcceptClick}
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-white transition group"
          >
            <div className="w-14 h-14 rounded-full bg-green-500/10 group-hover:bg-green-500 flex items-center justify-center transition-colors shadow-lg shadow-green-500/20 animate-pulse">
              {isVideo ? (
                <Video size={24} className="text-green-500 group-hover:text-white" />
              ) : (
                <Phone size={24} className="text-green-500 group-hover:text-white" />
              )}
            </div>
            <span className="text-sm font-medium">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
