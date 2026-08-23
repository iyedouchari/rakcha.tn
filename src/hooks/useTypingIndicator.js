import { useState, useEffect, useRef, useCallback } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';

/**
 * Custom hook to manage typing indicator lifecycle (Sender & Receiver)
 * Pure JavaScript / JSX implementation.
 *
 * @param {string} groupId - The active group or DM ID
 * @param {object} currentUser - The logged in user
 * @param {Array} messages - Active messages list (to clear typing on new message arrival)
 */
export function useTypingIndicator(groupId, currentUser, messages = []) {
  const { sendTypingEvent, typingUsers } = useRakchaStore();

  // Local state for active typing users with safety timers: { [userId]: { userId, username, timerId } }
  const [localTypingMap, setLocalTypingMap] = useState({});

  // Sender refs
  const typingTimerRef = useRef(null);
  const lastBroadcastTimeRef = useRef(0);
  const isCurrentlyTypingRef = useRef(false);

  // Receiver timers ref for safety cleanup
  const receiverTimersRef = useRef({});

  // ── SENDER LIFECYCLE ──────────────────────────────────────────────────────

  // Instant Reset: immediately broadcast false and clear debounce timers
  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (isCurrentlyTypingRef.current && groupId && currentUser) {
      isCurrentlyTypingRef.current = false;
      sendTypingEvent(groupId, false).catch(() => {});
    }
  }, [groupId, currentUser, sendTypingEvent]);

  // Handle Keystrokes with 2.5s inactivity debounce & broadcast throttling
  const handleTypingKeystroke = useCallback((textValue) => {
    if (!groupId || !currentUser) return;

    const trimmed = typeof textValue === 'string' ? textValue.trim() : '';

    // If input is emptied, clear immediately
    if (trimmed.length === 0) {
      stopTyping();
      return;
    }

    const now = Date.now();
    // Throttle outgoing 'is_typing: true' packets to once every 1500ms
    if (!isCurrentlyTypingRef.current || now - lastBroadcastTimeRef.current > 1500) {
      isCurrentlyTypingRef.current = true;
      lastBroadcastTimeRef.current = now;
      sendTypingEvent(groupId, true).catch(() => {});
    }

    // Reset 2.5s inactivity timeout on every keystroke
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      stopTyping();
    }, 2500);
  }, [groupId, currentUser, sendTypingEvent, stopTyping]);

  // Clean up sender timers on unmount or groupId change
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (isCurrentlyTypingRef.current && groupId) {
        isCurrentlyTypingRef.current = false;
        sendTypingEvent(groupId, false).catch(() => {});
      }
    };
  }, [groupId, sendTypingEvent]);

  // ── RECEIVER LIFECYCLE ────────────────────────────────────────────────────

  // Sync from store's global broadcast listener with 3-second safety fallback & self-filtering
  useEffect(() => {
    if (!groupId || !currentUser) return;

    const currentStoreTyping = typingUsers[groupId] || [];
    const currentUserId = currentUser.id;

    // Filter out self
    const otherTyping = currentStoreTyping.filter(u => u.userId !== currentUserId && u.user_id !== currentUserId);

    setLocalTypingMap((prevMap) => {
      const nextMap = { ...prevMap };
      const incomingUserIds = new Set();

      otherTyping.forEach((u) => {
        const uId = u.userId || u.user_id;
        const uName = u.username || u.display_name || 'Someone';
        if (!uId) return;

        incomingUserIds.add(uId);

        // Clear previous safety timer if exists
        if (receiverTimersRef.current[uId]) {
          clearTimeout(receiverTimersRef.current[uId]);
        }

        // Set 3-second safety fallback auto-clear
        receiverTimersRef.current[uId] = setTimeout(() => {
          setLocalTypingMap((m) => {
            const updated = { ...m };
            delete updated[uId];
            return updated;
          });
          delete receiverTimersRef.current[uId];
        }, 3000);

        nextMap[uId] = { userId: uId, username: uName };
      });

      // Remove users who are no longer in incoming store list
      Object.keys(nextMap).forEach((id) => {
        if (!incomingUserIds.has(id)) {
          if (receiverTimersRef.current[id]) {
            clearTimeout(receiverTimersRef.current[id]);
            delete receiverTimersRef.current[id];
          }
          delete nextMap[id];
        }
      });

      return nextMap;
    });
  }, [typingUsers, groupId, currentUser]);

  // Instant Receiver Reset when a new message is received from a sender
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    const senderId = lastMessage?.sender_id;

    if (senderId) {
      if (receiverTimersRef.current[senderId]) {
        clearTimeout(receiverTimersRef.current[senderId]);
        delete receiverTimersRef.current[senderId];
      }
      setLocalTypingMap((prev) => {
        if (!prev[senderId]) return prev;
        const next = { ...prev };
        delete next[senderId];
        return next;
      });
    }
  }, [messages]);

  // Clean up all receiver timers on unmount or group change
  useEffect(() => {
    return () => {
      Object.values(receiverTimersRef.current).forEach((t) => clearTimeout(t));
      receiverTimersRef.current = {};
      setLocalTypingMap({});
    };
  }, [groupId]);

  // Return active typing list as an array of usernames
  const activeTypingUsers = Object.values(localTypingMap);

  return {
    activeTypingUsers,
    handleTypingKeystroke,
    stopTyping
  };
}
