import React, { useState, useEffect } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { ArrowLeft, Users, KeyRound, Upload, CheckCircle2, MessageSquare, X } from 'lucide-react';

/**
 * CreateGroupModal component
 * Pure JSX modal for Creating or Joining groups.
 * Ensures "Back to Dashboard" and "Cancel" buttons immediately close/navigate without getting stuck by form validation.
 */
export default function CreateGroupModal({ isOpen = true, onClose, onSuccess }) {
  const { navigate, createGroup, joinGroup, setActiveGroup, groups, showToast } = useRakchaStore();

  // views: 'choice' | 'create' | 'join' | 'success' | 'already_member'
  const [view, setView] = useState('choice');

  // create form state
  const [groupName, setGroupName]         = useState('');
  const [description, setDescription]     = useState('');
  const [avatarFile, setAvatarFile]       = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [createdGroup, setCreatedGroup]   = useState(null);

  // join form state
  const [inviteCode, setInviteCode]               = useState('');
  const [joinError, setJoinError]                 = useState('');
  const [isJoining, setIsJoining]                 = useState(false);
  const [alreadyMemberGroup, setAlreadyMemberGroup] = useState(null);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setView('choice');
      setGroupName('');
      setDescription('');
      setAvatarFile(null);
      setAvatarPreview(null);
      setCreatedGroup(null);
      setInviteCode('');
      setJoinError('');
      setIsJoining(false);
      setAlreadyMemberGroup(null);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setView('choice');
    if (typeof onClose === 'function') {
      onClose();
    } else {
      navigate('app');
    }
  };

  // Code input: uppercase + XXXX-XXXX auto-format
  const handleInviteCodeChange = (e) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    val = val.replace(/[0O1I]/g, '');
    if (val.length > 4) {
      val = val.slice(0, 4) + '-' + val.slice(4, 8);
    } else {
      val = val.slice(0, 4);
    }
    setInviteCode(val);
    if (joinError) setJoinError('');
  };

  // Create group handler
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!avatarFile) {
      showToast('Error: Please upload a group avatar image before continuing.', 'error');
      return;
    }
    if (groupName.trim()) {
      try {
        const newGroup = await createGroup({ name: groupName, description, avatarFile });
        setCreatedGroup(newGroup);
        setView('success');
        if (typeof onSuccess === 'function') onSuccess(newGroup);
      } catch (err) {
        showToast('Failed to create group: ' + err.message, 'error');
      }
    }
  };

  // Join group handler
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoinError('');
    setIsJoining(true);

    try {
      const result = await joinGroup(inviteCode);
      if (result?.already_member) {
        const existingGroup = groups.find(g => g.id === result.id)
          || { id: result.id, name: 'Your Group', avatar_url: null };
        setAlreadyMemberGroup(existingGroup);
        setView('already_member');
      } else {
        handleClose();
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired')) {
        setJoinError('This code is invalid or has expired. Please double-check and try again.');
      } else {
        setJoinError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleGoToChat = () => {
    if (alreadyMemberGroup?.id) {
      setActiveGroup(alreadyMemberGroup.id);
    }
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg bg-surface-container-low p-6 md:p-10 rounded-[2rem] shadow-2xl border border-outline-variant/20 animate-in zoom-in-95 duration-200 relative text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header / Navigation */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-outline-variant/10">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all font-medium px-3 py-1.5 -ml-2 rounded-xl hover:bg-surface-container-highest active:scale-95 cursor-pointer group"
            title="Return to Dashboard"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Dashboard</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-surface-container-highest transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Choice View ────────────────────────────────────────────── */}
        {view === 'choice' && (
          <div className="text-center">
            <h2 className="text-3xl font-heading font-bold mb-2">Add a Group</h2>
            <p className="text-muted-foreground text-sm mb-8">Connect with friends by creating a new group or joining an existing one.</p>

            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setView('create')}
                className="bg-surface-container-highest hover:bg-primary/20 border border-outline-variant/20 hover:border-primary/50 group flex items-center justify-between p-5 rounded-2xl transition duration-300 text-left cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors">Create My Own</h3>
                    <p className="text-xs text-muted-foreground">Start a fresh group chat.</p>
                  </div>
                </div>
                <ArrowLeft size={20} className="rotate-180 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => setView('join')}
                className="bg-surface-container-highest hover:bg-[#2DD4BF]/20 border border-outline-variant/20 hover:border-[#2DD4BF]/50 group flex items-center justify-between p-5 rounded-2xl transition duration-300 text-left cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#2DD4BF]/10 text-[#2DD4BF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <KeyRound size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg group-hover:text-[#2DD4BF] transition-colors">Join via Code</h3>
                    <p className="text-xs text-muted-foreground">Have an invite code? Join here.</p>
                  </div>
                </div>
                <ArrowLeft size={20} className="rotate-180 text-muted-foreground group-hover:text-[#2DD4BF] group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* ── Create View ────────────────────────────────────────────── */}
        {view === 'create' && (
          <div>
            <div className="flex items-center mb-6">
              <button
                type="button"
                onClick={() => setView('choice')}
                className="text-muted-foreground hover:text-foreground mr-3 p-1 rounded-lg hover:bg-surface-container-highest transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-2xl font-heading font-bold">Create your group</h2>
            </div>
            <p className="text-muted-foreground text-xs mb-6">Give your new group a personality with a name and an icon.</p>

            <div className="flex justify-center mb-6">
              <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center cursor-pointer hover:border-primary text-muted-foreground hover:text-primary hover:bg-primary/5 transition group relative overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload size={22} className="mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files[0]) {
                      setAvatarFile(e.target.files[0]);
                      setAvatarPreview(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                />
              </label>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Group Name</label>
                <input
                  required
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  type="text"
                  placeholder="e.g. Weekend Gamers"
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What is this group about?"
                  rows="2"
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm resize-none text-sm"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setView('choice')}
                  className="flex-1 bg-surface-container-highest hover:bg-surface-bright border border-outline-variant/20 text-foreground font-semibold py-3.5 rounded-xl transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-indigo-600 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-primary/20 text-sm"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Success View ───────────────────────────────────────────── */}
        {view === 'success' && createdGroup && (
          <div className="text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <Users size={36} />
            </div>
            <h2 className="text-2xl font-heading font-bold mb-1">Group Created!</h2>
            <p className="text-muted-foreground text-sm mb-6">Welcome to your new hangout spot, <span className="font-semibold text-foreground">{createdGroup.name}</span>.</p>

            <div className="bg-surface-container-highest rounded-2xl p-5 mb-6 border border-primary/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Invite Code</h3>
              <p className="text-xs text-muted-foreground mb-3">Share this code with friends so they can join.</p>
              <div className="bg-background text-foreground font-mono text-center py-2.5 rounded-xl border border-outline-variant/30 text-xl tracking-widest uppercase font-bold select-all">
                {createdGroup.code || 'N/A'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-primary/20 text-sm"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* ── Join View ──────────────────────────────────────────────── */}
        {view === 'join' && (
          <div>
            <div className="flex items-center mb-6">
              <button
                type="button"
                onClick={() => { setView('choice'); setJoinError(''); setInviteCode(''); }}
                className="text-muted-foreground hover:text-foreground mr-3 p-1 rounded-lg hover:bg-surface-container-highest transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-2xl font-heading font-bold">Join a group</h2>
            </div>
            <p className="text-muted-foreground text-xs mb-6">Enter the invite code provided by the group creator to join.</p>

            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Invite Code</label>
                <input
                  required
                  value={inviteCode}
                  onChange={handleInviteCodeChange}
                  type="text"
                  placeholder="e.g. M8X9-4K2P"
                  maxLength={9}
                  className={`w-full bg-surface-container-lowest border rounded-xl p-3.5 text-foreground focus:outline-none focus:ring-1 shadow-sm uppercase font-mono text-center tracking-widest text-lg transition ${
                    joinError
                      ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/30'
                      : 'border-outline-variant/30 focus:border-[#2DD4BF] focus:ring-[#2DD4BF]'
                  }`}
                />
                {joinError && (
                  <p className="mt-2 text-xs text-red-400 flex items-start gap-1.5 animate-in fade-in duration-150">
                    <span className="shrink-0">⚠</span>
                    {joinError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => { setView('choice'); setJoinError(''); setInviteCode(''); }}
                  className="flex-1 bg-surface-container-highest hover:bg-surface-bright border border-outline-variant/20 text-foreground font-semibold py-3.5 rounded-xl transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isJoining || inviteCode.replace('-', '').length < 4}
                  className="flex-1 bg-[#2DD4BF] hover:bg-[#14b8a6] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition shadow-lg shadow-[#2DD4BF]/20 text-sm"
                >
                  {isJoining ? 'Joining…' : 'Join Group'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Already Member View ────────────────────────────────────── */}
        {view === 'already_member' && alreadyMemberGroup && (
          <div className="text-center animate-in zoom-in-95 duration-200">
            <div className="relative w-20 h-20 mx-auto mb-4">
              {alreadyMemberGroup.avatar_url ? (
                <img
                  src={alreadyMemberGroup.avatar_url}
                  alt={alreadyMemberGroup.name}
                  className="w-20 h-20 rounded-2xl object-cover shadow-xl"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center shadow-xl">
                  <span className="text-2xl font-bold text-primary">
                    {alreadyMemberGroup.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40 ring-2 ring-background">
                <CheckCircle2 size={16} className="text-white" strokeWidth={2.5} />
              </div>
            </div>

            <h2 className="text-xl font-heading font-bold mb-1">{alreadyMemberGroup.name}</h2>
            <p className="text-emerald-400 font-medium text-xs mb-2 flex items-center justify-center gap-1">
              <CheckCircle2 size={13} /> You are already a member.
            </p>
            <p className="text-muted-foreground text-xs mb-6">Jump back into the conversation or try another code.</p>

            <button
              type="button"
              onClick={handleGoToChat}
              className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mb-2.5 text-sm"
            >
              <MessageSquare size={16} />
              Go to Conversation
            </button>

            <button
              type="button"
              onClick={() => { setView('join'); setJoinError(''); setInviteCode(''); }}
              className="w-full bg-surface-container-highest hover:bg-surface-bright border border-outline-variant/20 text-foreground font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              <ArrowLeft size={15} />
              Try Another Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
