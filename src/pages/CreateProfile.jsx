import React, { useState } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { Upload, ArrowRight, ArrowLeft } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function CreateProfile() {
  const { navigate, updateProfile } = useRakchaStore();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim() && username.trim()) {
      const formattedUsername = username.startsWith('@') ? username : `@${username}`;
      updateProfile({
        name: name,
        username: formattedUsername.toLowerCase().replace(/\s+/g, '_'),
        bio: bio
      });
      navigate('app'); // Finish onboarding, go to Dashboard
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans relative overflow-hidden">
      <AnimatedBackground />

      <header className="p-6 relative z-10 flex items-center justify-between">
        <button onClick={() => navigate('landing')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition font-medium">
          <ArrowLeft size={20} /> Back
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative z-10 -mt-16">
        <div className="w-full max-w-lg bg-surface-container-low p-8 md:p-12 rounded-[2rem] shadow-2xl border border-outline-variant/20 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          <div className="text-center mb-10">
            <h2 className="text-3xl font-heading font-bold mb-2">Setup your profile</h2>
            <p className="text-muted-foreground">How should people recognize you on Rakcha?</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex justify-center mb-4">
              <div className="w-28 h-28 rounded-full border-4 border-surface-container-highest flex flex-col items-center justify-center cursor-pointer hover:border-primary text-muted-foreground hover:text-primary hover:bg-primary/5 transition group relative overflow-hidden shadow-inner bg-surface-container">
                <Upload size={28} className="mb-2" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Avatar</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Display Name</label>
              <input required value={name} onChange={e => setName(e.target.value)} type="text" placeholder="What should we call you?" className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm text-lg font-medium" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">@</span>
                <input required pattern="[a-zA-Z0-9]+_[a-zA-Z0-9]+" title="Username must be in the format name_secondname (e.g., john_doe)" value={username} onChange={e => setUsername(e.target.value)} type="text" placeholder="name_secondname" className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 pl-9 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm text-lg font-medium" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Bio</label>
              <textarea required value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us a bit about yourself..." rows="3" className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm resize-none" />
            </div>

            <button type="submit" className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-4 rounded-xl transition mt-4 shadow-lg shadow-primary/20 flex justify-center items-center gap-2 group">
              Complete Setup <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

        </div>
      </main>
    </div>
  );
}
