import React, { useState } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { X, Check, UserPlus, Bell, Copy, AlertTriangle } from 'lucide-react';
import { SearchUsers } from './SearchUsers';
import { normalizeUsername, DEFAULT_AVATAR } from '../lib/utils';

// ── Invitations Panel ────────────────────────────────────────────────────────
export function InvitationsPanel({ isOpen, onClose }) {
  const friendRequests = useRakchaStore(s => s.friendRequests);
  const acceptFriendRequest = useRakchaStore(s => s.acceptFriendRequest);
  const declineFriendRequest = useRakchaStore(s => s.declineFriendRequest);
  const showToast = useRakchaStore(s => s.showToast);

  if (!isOpen) return null;

  const handle = async (fn, id, msg) => {
    try {
      await fn(id);
      showToast(msg);
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-outline-variant/20 animate-in fade-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-primary" />
            <h2 className="text-lg font-heading font-bold">Invitations</h2>
            {friendRequests.length > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{friendRequests.length}</span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20}/></button>
        </div>

        <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
          {friendRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell size={40} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No pending invitations.</p>
            </div>
          ) : (
            friendRequests.map(req => (
              <div key={req.id} className="flex items-center gap-3 bg-surface-container-high rounded-xl p-3">
                <img
                  src={req.sender?.avatar_url || DEFAULT_AVATAR}
                  className="w-11 h-11 rounded-full object-cover shrink-0"
                  alt={req.sender?.display_name}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{req.sender?.display_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground truncate">@{normalizeUsername(req.sender?.username)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handle(acceptFriendRequest, req.id, 'Friend request accepted!')}
                    className="w-9 h-9 bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white rounded-lg flex items-center justify-center transition"
                    title="Accept"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => handle(declineFriendRequest, req.id, 'Friend request declined.')}
                    className="w-9 h-9 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg flex items-center justify-center transition"
                    title="Decline"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Friend Modal ─────────────────────────────────────────────────────────
export function AddFriendModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-outline-variant/20 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-primary" />
            <h2 className="text-lg font-heading font-bold">Add Friend</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20}/></button>
        </div>
        <div className="p-6">
          <SearchUsers onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

// ── Invite Code Modal ──────────────────────────────────────────────────────
export function InviteCodeModal({ isOpen, onClose, group, currentUser, groupMembers, regenerateGroupCode }) {
  const showToast = useRakchaStore(s => s.showToast);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOpen || !group) return null;

  const myRole = groupMembers?.find(m => m.id === currentUser?.id)?.groupRole;
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
        <div className="bg-surface-container-high w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-outline-variant/20 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container">
            <h2 className="text-xl font-heading font-bold text-foreground">Invitation Code</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-surface-container-highest">
              <X size={20} />
            </button>
          </div>

          <div className="p-8 flex flex-col items-center text-center gap-6">
            <div className="w-full">
              <p className="text-sm text-muted-foreground mb-3">Share this code with others to let them join <span className="font-bold text-foreground">{group.name}</span>.</p>
              <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between shadow-inner">
                <span className="font-mono text-2xl tracking-widest font-bold text-primary">{group.code}</span>
                <button 
                  onClick={() => { navigator.clipboard.writeText(group.code); showToast('Code copied!', 'success'); }} 
                  className="bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors p-2 rounded-lg"
                  title="Copy Code"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>
            
            <div className="w-full bg-surface-container rounded-xl p-4 border border-outline-variant/20 flex flex-col gap-3">
              <div className="flex items-start gap-2 text-left">
                <div className="text-orange-500 mt-0.5"><AlertTriangle size={16} /></div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Logic Label:</strong> Regeneration is restricted to the Group Creator or Admins.
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="w-full py-2.5 bg-surface-container-highest hover:bg-surface-bright text-foreground text-sm font-semibold rounded-lg transition-colors border border-outline-variant/30 flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                  Regenerate Code
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="Regenerate Code?"
        message="Regenerating will revoke the old code. Existing members will stay in the group, but anyone using the old code won't be able to join."
        confirmText="Regenerate"
        cancelText="Cancel"
        onConfirm={async () => {
          await regenerateGroupCode(group.id);
          setShowConfirm(false);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

// ── Generic Confirm Modal ───────────────────────────────────────────────────
export function ConfirmModal({ isOpen, title, message, confirmText = 'Confirm', cancelText = 'Cancel', confirmVariant = 'danger', onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onCancel}>
      <div className="bg-surface-container-high w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className={`w-12 h-12 ${confirmVariant === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-xl font-bold mb-2 text-foreground">{title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
        </div>
        <div className="bg-surface-container p-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl font-semibold text-foreground bg-surface-container-highest hover:bg-surface-bright transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-white transition-colors shadow-lg ${
              confirmVariant === 'danger'
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                : 'bg-primary hover:opacity-90 shadow-primary/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Unfriend Confirmation Modal ─────────────────────────────────────────────
export function UnfriendConfirmModal({ isOpen, userName = 'this friend', onConfirm, onCancel }) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      title="Remove Friend"
      message={`Are you sure you want to remove ${userName} from your friends list? Your private direct message chat history will also be removed.`}
      confirmText="Remove Friend"
      cancelText="Cancel"
      confirmVariant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

// ── Block User Confirmation Modal ───────────────────────────────────────────
export function BlockUserConfirmModal({ isOpen, userName = 'this user', onConfirm, onCancel }) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      title={`Block ${userName}`}
      message={`They will be removed from your friends list, will not be able to message or call you directly, and will appear as 'Rakcha User' in mutual groups.`}
      confirmText="Block Account"
      cancelText="Cancel"
      confirmVariant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

// ── Re-exports of specialized modals ─────────────────────────────────────────
export { default as DisconnectModal } from './DisconnectModal';
export { default as CreateGroupModal } from './CreateGroupModal';

