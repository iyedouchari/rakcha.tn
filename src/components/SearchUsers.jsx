import React, { useState, useEffect } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { UserPlus, Search, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DEFAULT_AVATAR, cn, normalizeUsername } from '../lib/utils';

export function SearchUsers({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = useRakchaStore((s) => s.searchUsers);
  const sendFriendRequest = useRakchaStore((s) => s.sendFriendRequest);
  const cancelFriendRequest = useRakchaStore((s) => s.cancelFriendRequest);
  const acceptFriendRequest = useRakchaStore((s) => s.acceptFriendRequest);
  const declineFriendRequest = useRakchaStore((s) => s.declineFriendRequest);
  const isUserBlocked = useRakchaStore((s) => s.isUserBlocked);
  const onlineUsers = useRakchaStore((s) => s.onlineUsers);
  const showToast = useRakchaStore((s) => s.showToast);

  // Debounce search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const normalizedQuery = normalizeUsername(query);
        const data = await searchUsers(normalizedQuery);
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query, searchUsers]);

  // Real-time synchronization for friend requests while modal is mounted
  useEffect(() => {
    const currentUser = useRakchaStore.getState().currentUser;
    if (!currentUser) return;

    const channel = supabase
      .channel(`search-users-sync-${currentUser.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            setResults((prev) =>
              prev.map((u) => {
                if (
                  (deletedId && u.requestId === deletedId) ||
                  u.id === payload.old?.receiver_id ||
                  u.id === payload.old?.sender_id
                ) {
                  return { ...u, relationshipStatus: 'none', requestId: null };
                }
                return u;
              })
            );
          } else if (payload.eventType === 'INSERT') {
            const row = payload.new;
            if (row.sender_id === currentUser.id) {
              setResults((prev) =>
                prev.map((u) =>
                  u.id === row.receiver_id
                    ? { ...u, relationshipStatus: 'request_sent', requestId: row.id }
                    : u
                )
              );
            } else if (row.receiver_id === currentUser.id) {
              setResults((prev) =>
                prev.map((u) =>
                  u.id === row.sender_id
                    ? { ...u, relationshipStatus: 'request_received', requestId: row.id }
                    : u
                )
              );
            }
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            if (row.status === 'accepted') {
              setResults((prev) =>
                prev.map((u) =>
                  u.id === row.sender_id || u.id === row.receiver_id
                    ? { ...u, relationshipStatus: 'friends' }
                    : u
                )
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, []);

  const handleSendRequest = async (userId) => {
    if (isUserBlocked(userId)) {
      showToast('Cannot send friend request to a blocked user.', 'error');
      return;
    }

    // 1. Optimistic UI update: immediately switch button state to 'request_sent'
    const previousResults = results;
    setResults((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, relationshipStatus: 'request_sent' } : u))
    );

    try {
      const createdRequest = await sendFriendRequest(userId);
      showToast('Friend request sent!', 'info');
      // Store created requestId for instant cancellation
      if (createdRequest?.id) {
        setResults((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, requestId: createdRequest.id } : u))
        );
      }
    } catch (err) {
      // Rollback on failure
      setResults(previousResults);
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleCancelRequest = async (user) => {
    // 1. Optimistic UI update: immediately reset button state back to 'none'
    const previousResults = results;
    setResults((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, relationshipStatus: 'none', requestId: null } : u))
    );

    try {
      await cancelFriendRequest({
        requestId: user.requestId,
        targetUserId: user.id,
      });
    } catch (err) {
      // Rollback on failure
      setResults(previousResults);
      showToast('Error cancelling request: ' + err.message, 'error');
    }
  };

  const getStatusButton = (user) => {
    if (isUserBlocked(user.id)) {
      return (
        <span className="text-[11px] font-bold text-rose-400 px-2 py-1 bg-rose-500/10 rounded-lg">
          Blocked
        </span>
      );
    }
    switch (user.relationshipStatus) {
      case 'friends':
        return (
          <button
            onClick={async () => {
              try {
                await useRakchaStore.getState().openDirectMessage(user.id);
                onClose(); // Close modal
              } catch (err) {
                showToast(err.message, 'error');
              }
            }}
            className="w-9 h-9 bg-surface-container text-primary rounded-lg flex items-center justify-center hover:bg-primary/20 transition"
            title="Message"
          >
            <MessageSquare size={18} />
          </button>
        );
      case 'request_sent':
        return (
          <button
            onClick={() => handleCancelRequest(user)}
            className="px-3 h-9 bg-surface-container text-muted-foreground hover:bg-red-500/10 hover:text-red-500 text-xs font-semibold rounded-lg flex items-center gap-1 transition"
          >
            Cancel
          </button>
        );
      case 'request_received':
        return (
          <div className="flex gap-1">
            <button
              onClick={async () => {
                try {
                  await acceptFriendRequest(user.requestId);
                  setResults((prev) =>
                    prev.map((u) => (u.id === user.id ? { ...u, relationshipStatus: 'friends' } : u))
                  );
                  showToast('Friend request accepted!', 'success');
                } catch (err) {
                  showToast('Error accepting request: ' + err.message, 'error');
                }
              }}
              className="px-3 h-9 bg-primary/20 text-primary hover:bg-primary/30 text-xs font-semibold rounded-lg flex items-center transition"
            >
              Accept
            </button>
            <button
              onClick={async () => {
                try {
                  await declineFriendRequest(user.requestId);
                  setResults((prev) =>
                    prev.map((u) => (u.id === user.id ? { ...u, relationshipStatus: 'none' } : u))
                  );
                  showToast('Friend request declined.', 'info');
                } catch (err) {
                  showToast('Error declining request: ' + err.message, 'error');
                }
              }}
              className="px-3 h-9 bg-surface-container text-muted-foreground hover:bg-red-500/10 hover:text-red-500 text-xs font-semibold rounded-lg flex items-center transition"
            >
              Decline
            </button>
          </div>
        );
      default:
        return (
          <button
            onClick={() => handleSendRequest(user.id)}
            className="w-9 h-9 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg flex items-center justify-center transition"
            title="Add Friend"
          >
            <UserPlus size={18} />
          </button>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username..."
          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl py-3 pl-10 pr-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
        />
      </div>

      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        {loading && <div className="text-center py-4 text-xs text-muted-foreground">Searching...</div>}
        {!loading && query && results.length === 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground">No users found.</div>
        )}
        {!loading &&
          results.map((user) => (
            <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-surface-container rounded-xl transition">
              <div className="relative shrink-0">
                <img
                  src={user.avatar_url || DEFAULT_AVATAR}
                  alt={user.display_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div
                  className={cn(
                    'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface',
                    onlineUsers.includes(user.id) ? 'bg-green-500' : 'bg-gray-400'
                  )}
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-foreground truncate">{user.display_name}</span>
                <span className="text-xs text-muted-foreground truncate">@{normalizeUsername(user.username)}</span>
              </div>
              <div className="shrink-0 flex items-center ml-auto">{getStatusButton(user)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}
