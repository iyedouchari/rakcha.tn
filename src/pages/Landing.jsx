import React from 'react';
import { useRakchaStore } from '../store/useRakchaStore';
import { Video, MessageSquare, Shield, Zap } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function Landing() {
  const navigate = useRakchaStore(s => s.navigate);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-hidden selection:bg-primary/30 selection:text-white">
      <AnimatedBackground />

      <header className="flex items-center justify-between px-6 md:px-12 py-6 max-w-7xl mx-auto w-full relative z-20">
        <div className="flex items-center gap-3 group cursor-default">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-[0_0_20px_rgba(99,102,241,0.5)] group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">R</div>
          <span className="font-heading font-bold text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80 group-hover:to-primary transition-colors">Rakcha</span>
        </div>
        
        <div className="flex gap-4">
          <button onClick={() => navigate('login')} className="bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 px-6 py-2.5 rounded-full font-semibold transition-all duration-300 text-sm hover:scale-105">
            Log In
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-20 mt-12 mb-20">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-xs font-semibold text-secondary mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 hover:scale-105 transition-transform cursor-default shadow-[0_0_20px_rgba(45,212,191,0.1)]">
          <Zap size={14} className="fill-secondary animate-pulse" /> Welcome to Rakcha
        </div>
        
        <h1 className="text-5xl md:text-8xl font-heading font-black max-w-5xl tracking-tighter mb-8 leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          Your new <br className="hidden md:block" />
          <span className="relative inline-block">
            <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-400 to-secondary animate-gradient-x">hangout spot.</span>
            <span className="absolute inset-0 blur-2xl bg-gradient-to-r from-primary to-secondary opacity-30 z-0"></span>
          </span>
        </h1>
        
        <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 font-medium">
          Ditch the complex servers. Create your group, grab a link, and start chilling instantly. The most elegant way to talk, watch, and game together.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-6 mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
          <button onClick={() => navigate('register')} className="bg-primary hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-[0_0_40px_rgba(99,102,241,0.4)] hover:shadow-[0_0_60px_rgba(99,102,241,0.6)] hover:-translate-y-1 group relative overflow-hidden">
            <span className="relative z-10">Start Your Group</span>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          </button>
          
          <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground bg-white/5 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="flex -space-x-3">
              {[1,2,3,4].map(i => (
                <img key={i} src={`https://i.pravatar.cc/100?img=${i+20}`} alt="User" className="w-8 h-8 rounded-full border-2 border-[#0B0E14] hover:-translate-y-1 hover:scale-110 transition-transform cursor-pointer relative z-10 hover:z-20" />
              ))}
            </div>
            <span>Join 10,000+ active users</span>
          </div>
        </div>

        {/* Floating Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-12 text-left relative z-20 px-4">
          <div className="animate-in fade-in slide-in-from-bottom-12 duration-700 delay-500">
            <FeatureCard 
              icon={<Video className="text-secondary" size={28} />}
              title="Instant Stages"
              desc="Jump into high-def video calls instantly. No confusing voice channels."
              delay="0s"
            />
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-12 duration-700 delay-[600ms]">
            <FeatureCard 
              icon={<MessageSquare className="text-primary" size={28} />}
              title="Fluid Chat"
              desc="Blazing fast text messaging wrapped in a gorgeous, distraction-free interface."
              delay="0.2s"
            />
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-12 duration-700 delay-[700ms]">
            <FeatureCard 
              icon={<Shield className="text-[#2DD4BF]" size={28} />}
              title="Your Rules"
              desc="You're the admin. Lock down your group with invite codes and custom settings."
              delay="0.4s"
            />
          </div>
        </div>

        <div className="mt-24 mb-10 text-center animate-in fade-in duration-1000 delay-1000">
          <div className="w-[1px] h-24 bg-gradient-to-b from-primary/50 to-transparent mx-auto mb-8"></div>
          <p className="text-muted-foreground/50 text-sm tracking-widest uppercase font-bold">Rakcha © 2026</p>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc, delay }) {
  return (
    <div 
      className="bg-white/5 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] group relative overflow-hidden animate-float"
      style={{ animationDelay: delay }}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/5 group-hover:border-white/10 transition-colors shadow-inner">
        <div className="group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">{icon}</div>
      </div>
      <h3 className="text-2xl font-heading font-bold mb-3 text-white/90 group-hover:text-white transition-colors">{title}</h3>
      <p className="text-muted-foreground leading-relaxed font-medium">{desc}</p>
    </div>
  );
}
