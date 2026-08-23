import React, { useState, useEffect } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { UserPlus, Check, Clock, Search, MessageSquare } from 'lucide-react';
import { DEFAULT_AVATAR } from '../lib/utils';
import { cn } from '../lib/utils';
import { normalizeUsername } from '../lib/utils';

export function SearchUsers({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const searchUsers = useRakchaStore(s => s.searchUsers);
  const sendFriendRequest = useRakchaStore(s => s.sendFriendRequest);
  const cancelFriendRequest = useRakchaStore(s => s.cancelFriendRequest);
  const acceptFriendRequest = useRakchaStore(s => s.acceptFriendRequest);
  const declineFriendRequest = useRakchaStore(s => s.declineFriendRequest);
  const isUserBlocked = useRakchaStore(s => s.isUserBlocked);
  const onlineUsers = useRakchaStore(s => s.onlineUsers);
  const showToast = useRakchaStore(s => s.showToast);

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

  const handleSendRequest = async (userId) => {
    if (isUserBlocked(userId)) {
      showToast('Cannot send friend request to a blocked user.', 'error');
      return;
    }
    try {
      await sendFriendRequest(userId);
      showToast('Friend request sent!', 'info');
      // Update local state to reflect sent request
      setResults(prev => prev.map(u => u.id === userId ? { ...u, relationshipStatus: 'request_sent' } : u));
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
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
                onClose(); // Close the modal
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
            onClick={async () => {
              try {
                await cancelFriendRequest(user.requestId);
                setResults(prev => prev.map(u => u.id === user.id ? { ...u, relationshipStatus: 'none' } : u));
              } catch (err) {
                showToast('Error cancelling request: ' + err.message, 'error');
              }
            }}
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
                  setResults(prev => prev.map(u => u.id === user.id ? { ...u, relationshipStatus: 'friends' } : u));
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
                  setResults(prev => prev.map(u => u.id === user.id ? { ...u, relationshipStatus: 'none' } : u));
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
        {!loading && results.map(user => (
          <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-surface-container rounded-xl transition">
            <div className="relative shrink-0">
              <img 
                src={user.avatar_url || DEFAULT_AVATAR}
                alt={user.display_name} 
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className={cn("absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface", onlineUsers.includes(user.id) ? "bg-green-500" : "bg-gray-400")} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-foreground truncate">{user.display_name}</span>
              <span className="text-xs text-muted-foreground truncate">@{normalizeUsername(user.username)}</span>
            </div>
            <div className="shrink-0 flex items-center">
              {getStatusButton(user)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
