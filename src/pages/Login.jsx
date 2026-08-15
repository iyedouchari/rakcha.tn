import React, { useState } from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { ArrowLeft } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function Login() {
  const navigate = useRakchaStore(s => s.navigate);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Please enter an email and password!");
      return;
    }
    navigate('app');
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
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center font-bold text-white text-2xl mx-auto mb-4 shadow-lg shadow-primary/30">R</div>
            <h2 className="text-3xl font-heading font-bold mb-2">Welcome back</h2>
            <p className="text-muted-foreground">Enter your details to sign in.</p>
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
              <div className="flex justify-between mb-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block">Password</label>
                <a href="#" className="text-primary text-xs font-medium hover:underline">Forgot password?</a>
              </div>
              <input 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                type="password" 
                placeholder="••••••••" 
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition shadow-sm" 
              />
            </div>

            <button type="submit" className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3.5 rounded-xl transition mt-4 shadow-lg shadow-primary/20">
              Log In
            </button>
          </form>

          <div className="mt-8 text-sm text-center text-muted-foreground">
            Don't have an account?{' '}
            <button onClick={() => navigate('register')} className="text-primary hover:underline font-semibold">
              Sign Up
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
