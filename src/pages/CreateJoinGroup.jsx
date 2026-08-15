import React, { useState } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { ArrowLeft, Users, KeyRound, Upload } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function CreateJoinGroup() {
  const { navigate, createGroup, joinGroupByCode } = useRakchaStore();
  const [view, setView] = useState('choice'); // 'choice', 'create', 'join'
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [createdGroup, setCreatedGroup] = useState(null);

  const handleCreate = (e) => {
    e.preventDefault();
    if (groupName.trim()) {
      const newGroup = createGroup(groupName, description);
      setCreatedGroup(newGroup);
      setView('success');
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (inviteCode.trim()) {
      joinGroupByCode(inviteCode);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans relative overflow-hidden">
      <AnimatedBackground />

      <header className="p-6 relative z-10 flex items-center">
        <button type="button" onClick={() => navigate('app')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition font-medium">
          <ArrowLeft size={20} /> Back to Dashboard
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative z-10 -mt-16">
        <div className="w-full max-w-lg bg-surface-container-low p-8 md:p-12 rounded-[2rem] shadow-2xl border border-outline-variant/20 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {view === 'choice' && (
            <div className="text-center">
              <h2 className="text-3xl font-heading font-bold mb-3">Add a Group</h2>
              <p className="text-muted-foreground mb-10">Connect with friends by creating a new group or joining an existing one.</p>
              
              <div className="flex flex-col gap-4">
                <button onClick={() => setView('create')} className="bg-surface-container-highest hover:bg-primary/20 border border-outline-variant/20 hover:border-primary/50 group flex items-center justify-between p-6 rounded-2xl transition duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Users size={24} /></div>
                    <div className="text-left">
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors">Create My Own</h3>
                      <p className="text-sm text-muted-foreground">Start a fresh group chat.</p>
                    </div>
                  </div>
                  <ArrowLeft size={20} className="rotate-180 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition" />
                </button>

                <button onClick={() => setView('join')} className="bg-surface-container-highest hover:bg-[#2DD4BF]/20 border border-outline-variant/20 hover:border-[#2DD4BF]/50 group flex items-center justify-between p-6 rounded-2xl transition duration-300">
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

          {view === 'create' && (
            <div>
              <div className="flex items-center mb-8">
                <button type="button" onClick={() => setView('choice')} className="text-muted-foreground hover:text-foreground mr-4"><ArrowLeft size={24} /></button>
                <h2 className="text-2xl font-heading font-bold">Create your group</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-8">Give your new group a personality with a name and an icon. You can always change it later.</p>
              
              <div className="flex justify-center mb-8">
                <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center cursor-pointer hover:border-primary text-muted-foreground hover:text-primary hover:bg-primary/5 transition group relative overflow-hidden">
                  <Upload size={24} className="mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                  <input type="file" accept="image/*" className="hidden" />
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
                <button type="submit" className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-primary/20">
                  Create Group
                </button>
              </form>
            </div>
          )}

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
                  {createdGroup.inviteCode}
                </div>
              </div>

              <button type="button" onClick={() => { setView('choice'); navigate('app'); }} className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-primary/20 text-lg">
                Go to Dashboard
              </button>
            </div>
          )}

          {view === 'join' && (
            <div>
              <div className="flex items-center mb-8">
                <button type="button" onClick={() => setView('choice')} className="text-muted-foreground hover:text-foreground mr-4"><ArrowLeft size={24} /></button>
                <h2 className="text-2xl font-heading font-bold">Join a group</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-8">Enter the invite code provided by the group creator to join their space.</p>
              
              <form onSubmit={handleJoin} className="flex flex-col gap-6">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Invite Code</label>
                  <input required value={inviteCode} onChange={e => setInviteCode(e.target.value)} type="text" placeholder="e.g. WIZARDS-2026" className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 text-foreground focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF] shadow-sm uppercase font-mono text-center tracking-widest text-lg" />
                </div>
                <button type="submit" className="w-full bg-[#2DD4BF] hover:bg-[#14b8a6] text-black font-bold py-4 rounded-xl transition shadow-lg shadow-[#2DD4BF]/20 mt-2">
                  Join Group
                </button>
              </form>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
