import React, { useState } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { ArrowLeft } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function Register() {
  const navigate = useRakchaStore(s => s.navigate);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Please enter an email and password!");
      return;
    }
    navigate('create-profile');
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
        <div className="w-full max-w-md bg-surface-container-low p-8 md:p-10 rounded-[2rem] shadow-2xl border border-outline-variant/20 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          <div className="text-center mb-8">
            <h2 className="text-3xl font-heading font-bold mb-2">Create an account</h2>
            <p className="text-muted-foreground">Start your journey with Rakcha.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">Email</label>
              <input 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                type="email" 
                placeholder="you@example.com" 
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition shadow-sm" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">Password</label>
              <input 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                type="password" 
                placeholder="Create a strong password" 
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition shadow-sm" 
              />
            </div>

            <button type="submit" className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3.5 rounded-xl transition mt-4 shadow-lg shadow-primary/20">
              Continue
            </button>
          </form>

          <div className="mt-8 text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <button onClick={() => navigate('login')} className="text-primary hover:underline font-semibold">
              Log In
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
