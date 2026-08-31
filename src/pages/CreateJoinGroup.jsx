import React, { useState, useEffect } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { ArrowLeft, Users, KeyRound, Upload, CheckCircle2, MessageSquare, X } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';
import { DEFAULT_AVATAR } from '../lib/utils';

export default function CreateJoinGroup() {
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
  const [alreadyMemberGroup, setAlreadyMemberGroup] = useState(null); // { id, name, avatar_url }

  // Handle Escape key to dismiss view and return to dashboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleBackToDashboard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBackToDashboard = () => {
    setView('choice');
    setJoinError('');
    setInviteCode('');
    navigate('app');
  };

  // ── Code input: uppercase + XXXX-XXXX auto-format (original logic, unchanged) ─
  const handleInviteCodeChange = (e) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Exclude confusing characters
    val = val.replace(/[0O1I]/g, '');
    if (val.length > 4) {
      val = val.slice(0, 4) + '-' + val.slice(4, 8);
    } else {
      val = val.slice(0, 4);
    }
    setInviteCode(val);
    if (joinError) setJoinError(''); // clear error on new input
  };

  // ── Create group ──────────────────────────────────────────────────────────────
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
      } catch (err) {
        showToast('Failed to create group: ' + err.message, 'error');
      }
    }
  };

  // ── Join group ────────────────────────────────────────────────────────────────
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoinError('');
    setIsJoining(true);

    try {
      const result = await joinGroup(inviteCode);

      // joinGroup returns { id, success, already_member }
      if (result?.already_member) {
        // Find the full group object from the already-loaded store
        const existingGroup = groups.find(g => g.id === result.id)
          || { id: result.id, name: 'Your Group', avatar_url: null };
        setAlreadyMemberGroup(existingGroup);
        setView('already_member');
      } else {
        // Successful new join — navigate to dashboard
        handleBackToDashboard();
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

  // ── Open the group chat from already_member view ───────────────────────────
  const handleGoToChat = () => {
    if (alreadyMemberGroup?.id) {
      setActiveGroup(alreadyMemberGroup.id);
    }
    handleBackToDashboard();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans relative overflow-hidden">
      <AnimatedBackground />

      {/* Top Header with prominent, fully clickable Back to Dashboard button */}
      <header className="p-6 relative z-30 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBackToDashboard}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 font-medium px-4 py-2 rounded-xl hover:bg-surface-container-high/80 active:scale-95 cursor-pointer relative z-30 group"
          title="Return to Dashboard"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Dashboard</span>
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative z-10 -mt-10">
        <div className="w-full max-w-lg bg-surface-container-low p-8 md:p-12 rounded-[2rem] shadow-2xl border border-outline-variant/20 animate-in fade-in slide-in-from-bottom-4 duration-300">

          {/* ── Choice ──────────────────────────────────────────────────────── */}
          {view === 'choice' && (
            <div className="text-center">
              <h2 className="text-3xl font-heading font-bold mb-3">Add a Group</h2>
              <p className="text-muted-foreground mb-10">Connect with friends by creating a new group or joining an existing one.</p>

              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setView('create')}
                  className="bg-surface-container-highest hover:bg-primary/20 border border-outline-variant/20 hover:border-primary/50 group flex items-center justify-between p-6 rounded-2xl transition duration-300 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Users size={24} /></div>
                    <div className="text-left">
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors">Create My Own</h3>
                      <p className="text-sm text-muted-foreground">Start a fresh group chat.</p>
                    </div>
                  </div>
                  <ArrowLeft size={20} className="rotate-180 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition" />
                </button>

                <button
                  type="button"
                  onClick={() => setView('join')}
                  className="bg-surface-container-highest hover:bg-[#2DD4BF]/20 border border-outline-variant/20 hover:border-[#2DD4BF]/50 group flex items-center justify-between p-6 rounded-2xl transition duration-300 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#2DD4BF]/10 text-[#2DD4BF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><KeyRound size={24} /></div>
                    <div className="text-left">
                      <h3 className="font-bold text-lg group-hover:text-[#2DD4BF] transition-colors">Join via Code</h3>
                      <p className="text-sm text-muted-foreground">Have an invite code? Join here.</p>
                    </div>
                  </div>
                  <ArrowLeft size={20} className="rotate-180 text-muted-foreground group-hover:text-[#2DD4BF] group-hover:translate-x-1 transition" />
                </button>
              </div>
            </div>
          )}

          {/* ── Create ──────────────────────────────────────────────────────── */}
          {view === 'create' && (
            <div>
              <div className="flex items-center mb-8">
                <button type="button" onClick={() => setView('choice')} className="text-muted-foreground hover:text-foreground mr-4 p-1 rounded-lg hover:bg-surface-container-highest transition-colors"><ArrowLeft size={24} /></button>
                <h2 className="text-2xl font-heading font-bold">Create your group</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-8">Give your new group a personality with a name and an icon. You can always change it later.</p>

              <div className="flex justify-center mb-8">
                <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center cursor-pointer hover:border-primary text-muted-foreground hover:text-primary hover:bg-primary/5 transition group relative overflow-hidden">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload size={24} className="mb-2" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    if (e.target.files[0]) {
                      setAvatarFile(e.target.files[0]);
                      setAvatarPreview(URL.createObjectURL(e.target.files[0]));
                    }
                  }} />
                </label>
              </div>

              <form onSubmit={handleCreate} className="flex flex-col gap-6">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Group Name</label>
                  <input required value={groupName} onChange={e => setGroupName(e.target.value)} type="text" placeholder="e.g. Weekend Gamers" className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this group about?" rows="3" className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm resize-none" />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setView('choice')}
                    className="flex-1 bg-surface-container-highest hover:bg-surface-bright border border-outline-variant/20 text-foreground font-bold py-4 rounded-xl transition"
                  >
                    Back
                  </button>
                  <button type="submit" className="flex-1 bg-primary hover:bg-indigo-600 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-primary/20">
                    Create Group
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Success ─────────────────────────────────────────────────────── */}
          {view === 'success' && createdGroup && (
            <div className="text-center animate-in zoom-in duration-500">
              <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                <Users size={40} />
              </div>
              <h2 className="text-3xl font-heading font-bold mb-2">Group Created!</h2>
              <p className="text-muted-foreground mb-8">Welcome to your new hangout spot, <span className="font-semibold text-foreground">{createdGroup.name}</span>.</p>

              <div className="bg-surface-container-highest rounded-2xl p-6 mb-8 border border-primary/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Group Password / Invite Code</h3>
                <p className="text-sm text-muted-foreground mb-4">Share this code with your friends so they can join.</p>
                <div className="bg-background text-foreground font-mono text-center py-3 rounded-xl border border-outline-variant/30 text-2xl tracking-widest uppercase font-bold select-all">
                  {createdGroup.code || 'N/A'}
                </div>
              </div>

              <button type="button" onClick={handleBackToDashboard} className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-primary/20 text-lg">
                Go to Dashboard
              </button>
            </div>
          )}

          {/* ── Join ────────────────────────────────────────────────────────── */}
          {view === 'join' && (
            <div>
              <div className="flex items-center mb-8">
                <button type="button" onClick={() => { setView('choice'); setJoinError(''); setInviteCode(''); }} className="text-muted-foreground hover:text-foreground mr-4 p-1 rounded-lg hover:bg-surface-container-highest transition-colors">
                  <ArrowLeft size={24} />
                </button>
                <h2 className="text-2xl font-heading font-bold">Join a group</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-8">Enter the invite code provided by the group creator to join their space.</p>

              <form onSubmit={handleJoin} className="flex flex-col gap-6">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Invite Code</label>
                  <input
                    required
                    id="invite-code-input"
                    value={inviteCode}
                    onChange={handleInviteCodeChange}
                    type="text"
                    placeholder="e.g. M8X9-4K2P"
                    maxLength={9}
                    className={`w-full bg-surface-container-lowest border rounded-xl p-4 text-foreground focus:outline-none focus:ring-1 shadow-sm uppercase font-mono text-center tracking-widest text-lg transition ${
                      joinError
                        ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/30'
                        : 'border-outline-variant/30 focus:border-[#2DD4BF] focus:ring-[#2DD4BF]'
                    }`}
                  />
                  {/* Inline error — replaces the original alert() */}
                  {joinError && (
                    <p className="mt-2.5 text-sm text-red-400 flex items-start gap-1.5 animate-in fade-in duration-150">
                      <span className="mt-0.5 shrink-0">⚠</span>
                      {joinError}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setView('choice'); setJoinError(''); setInviteCode(''); }}
                    className="flex-1 bg-surface-container-highest hover:bg-surface-bright border border-outline-variant/20 text-foreground font-bold py-4 rounded-xl transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isJoining || inviteCode.replace('-', '').length < 4}
                    className="flex-1 bg-[#2DD4BF] hover:bg-[#14b8a6] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition shadow-lg shadow-[#2DD4BF]/20"
                  >
                    {isJoining ? 'Joining…' : 'Join Group'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Already a Member ────────────────────────────────────────────── */}
          {view === 'already_member' && alreadyMemberGroup && (
            <div className="text-center animate-in zoom-in-95 duration-300">

              {/* Group avatar with checkmark badge */}
              <div className="relative w-24 h-24 mx-auto mb-6">
                {alreadyMemberGroup.avatar_url ? (
                  <img
                    src={alreadyMemberGroup.avatar_url}
                    alt={alreadyMemberGroup.name}
                    className="w-24 h-24 rounded-2xl object-cover shadow-xl"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-primary/20 flex items-center justify-center shadow-xl">
                    <span className="text-3xl font-bold text-primary">
                      {alreadyMemberGroup.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40 ring-2 ring-background">
                  <CheckCircle2 size={18} className="text-white" strokeWidth={2.5} />
                </div>
              </div>

              {/* Group name */}
              <h2 className="text-2xl font-heading font-bold mb-1">{alreadyMemberGroup.name}</h2>

              {/* Status message */}
              <p className="text-emerald-400 font-medium text-sm mb-2 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={14} />
                You are already a member of {alreadyMemberGroup.name}. Your access is active.
              </p>
              <p className="text-muted-foreground text-sm mb-8">
                Jump back into the conversation or enter a different code.
              </p>

              {/* Primary: Open Discussion */}
              <button
                type="button"
                onClick={handleGoToChat}
                className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mb-3"
              >
                <MessageSquare size={18} />
                Go to Conversation
              </button>

              {/* Secondary: Try Another Code */}
              <button
                type="button"
                onClick={() => { setView('join'); setJoinError(''); setInviteCode(''); }}
                className="w-full bg-surface-container-highest hover:bg-surface-bright border border-outline-variant/20 text-foreground font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} />
                Try Another Code
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

