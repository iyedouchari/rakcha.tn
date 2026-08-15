import React from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { X, Upload, MessageSquare, Video, RefreshCw } from 'lucide-react';

export function UserProfileModal({ user, onClose }) {
  const { removeFriend, addFriend, currentUser, startDirectMessage, joinCall, isMuted, toggleMute } = useRakchaStore();

  if (!user) return null;
  
  const isFriend = currentUser.friends?.includes(user.id);

  const handleMessage = () => {
    startDirectMessage(user);
    onClose();
  };

  const handleCall = () => {
    startDirectMessage(user);
    // In a real app we'd trigger joinCall on the new DM ID, but since it's async we'll just start the DM.
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200 border border-outline-variant/20" onClick={e => e.stopPropagation()}>
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-primary to-secondary w-full relative">
          <button onClick={onClose} className="absolute right-3 top-3 text-white/70 hover:text-white bg-black/20 p-1 rounded-full backdrop-blur-md transition"><X size={20}/></button>
        </div>
        
        {/* Profile Info */}
        <div className="px-6 pb-6 relative">
          <div className="absolute -top-10 left-6 rounded-full border-4 border-surface-container bg-surface-container">
            <img src={user.avatar} className="w-20 h-20 rounded-full object-cover" alt={user.name} />
            {user.status === 'online' && <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-surface-container"></div>}
          </div>
          
          <div className="pt-12">
            <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
            <p className="text-sm text-primary font-medium">{user.username || '@username'}</p>
            
            <div className="mt-4 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">About Me</h3>
              <p className="text-sm text-foreground/90">{user.bio || 'This user has no bio yet.'}</p>
            </div>

            <div className="flex gap-2">
              <button onClick={handleMessage} className="flex-1 bg-primary hover:bg-indigo-600 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2">
                <MessageSquare size={18} /> Message
              </button>
              <button onClick={handleCall} className="bg-surface-container-high hover:bg-surface-bright text-foreground px-4 py-2.5 rounded-lg transition">
                <Video size={18} />
              </button>
            </div>
            
            <div className="flex gap-3 mt-3">
              <button onClick={() => { toggleMute(); onClose(); }} className="flex-1 bg-surface-container-high hover:bg-surface-bright text-foreground py-2.5 rounded-lg text-sm font-medium transition">
                {isMuted ? 'Unmute User' : 'Mute User'}
              </button>
              {isFriend ? (
                <button onClick={() => { removeFriend(user.id); onClose(); }} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-2.5 rounded-lg text-sm font-medium transition">
                  Remove Friend
                </button>
              ) : (
                <button onClick={() => { addFriend(user.id); onClose(); }} className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 py-2.5 rounded-lg text-sm font-medium transition">
                  Send Invitation
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditGroupModal({ group, isOpen, onClose }) {
  const { updateGroup, regenerateGroupCode } = useRakchaStore();
  
  if (!isOpen || !group) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    updateGroup(group.id, { 
      name: formData.get('name'),
      description: formData.get('description')
    });
    onClose();
  };

  const handleChangeAvatar = () => {
    // Mock avatar update
    const avatars = [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=100&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?q=80&w=100&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1529156069898-49953eb1b5ce?q=80&w=100&auto=format&fit=crop',
      group.icon
    ];
    const currentIndex = avatars.indexOf(group.icon);
    const nextIndex = (currentIndex + 1) % avatars.length;
    updateGroup(group.id, { icon: avatars[nextIndex] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200 border border-outline-variant/20" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
          <h2 className="text-lg font-heading font-bold text-foreground">Group Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20}/></button>
        </div>

        <div className="p-6">
          {/* Password / Invite Code Section */}
          <div className="bg-surface-container-highest rounded-xl p-4 mb-6 border border-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Group Password / Invite Code</h3>
            <p className="text-xs text-muted-foreground mb-3">Share this code to let people join.</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-background text-foreground font-mono text-center py-2 rounded-lg border border-outline-variant/30 text-lg tracking-widest uppercase">
                {group.inviteCode || 'N/A'}
              </code>
              <button onClick={() => regenerateGroupCode(group.id)} className="w-10 h-10 bg-surface-container hover:bg-surface-bright flex items-center justify-center rounded-lg transition text-muted-foreground hover:text-primary" title="Regenerate Code">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex items-center gap-4 mb-2">
              <img src={group.icon} className="w-16 h-16 rounded-xl object-cover shrink-0 border border-outline-variant/30" alt="Group Icon" />
              <button type="button" onClick={handleChangeAvatar} className="bg-surface-container-high hover:bg-surface-bright text-xs font-bold px-3 py-2 rounded-lg transition flex items-center gap-2">
                <Upload size={14} /> Change Avatar
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Group Name</label>
              <input name="name" defaultValue={group.name} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Description</label>
              <textarea name="description" defaultValue={group.description} rows="3" className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition resize-none" placeholder="What is this group about?" />
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-foreground hover:bg-surface-container-high transition font-medium text-sm">Cancel</button>
              <button type="submit" className="bg-primary hover:bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium transition text-sm shadow-md shadow-primary/20">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AddFriendModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  const handleAddFriend = (e) => {
    e.preventDefault();
    if (e.target.username.value.trim()) {
      // Find user by username
      const foundUser = null; // Mock search logic could go here
      // Real app would addFriend here
      onClose();
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200 border border-outline-variant/20" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
          <h2 className="text-lg font-heading font-bold text-foreground">Add Friend</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20}/></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-4">You can add friends with their Rakcha username.</p>
          <form onSubmit={handleAddFriend} className="flex flex-col gap-4">
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">@</span>
                <input name="username" required pattern="[a-zA-Z0-9]+_[a-zA-Z0-9]+" title="name_secondname" type="text" placeholder="name_secondname" className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl py-3 pl-8 pr-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
              </div>
            </div>
            <button type="submit" className="bg-primary hover:bg-indigo-600 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-primary/20">Send Friend Request</button>
          </form>
        </div>
      </div>
    </div>
  );
}

