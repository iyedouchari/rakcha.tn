import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { useRakchaStore } from '../store/useRakchaStore';
import {
  Video,
  MessageSquare,
  Shield,
  Zap,
  Sparkles,
  Users,
  Mic,
  MicOff,
  Volume2,
  Share2,
  Lock,
  ChevronDown,
  ArrowRight,
  Smile,
  Send,
  PhoneCall,
  CheckCircle,
  Headphones,
  Compass
} from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';
import Navbar from '../components/Navbar';
import { DEFAULT_AVATAR } from '../lib/utils';

// Stagger Animation Variants
const heroContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.1
    }
  }
};

const heroItemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
  }
};

// 3D Tilt App Preview Mockup Component
function InteractiveTiltMockup() {
  const cardRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 200, damping: 25 });
  const mouseYSpring = useSpring(y, { stiffness: 200, damping: 25 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['10deg', '-10deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-12deg', '12deg']);
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ['0%', '100%']);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ['0%', '100%']);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      style={{ perspective: 1200 }}
      className="w-full max-w-5xl mx-auto mt-8 px-4"
    >
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d'
        }}
        className="relative rounded-3xl bg-[#12141A]/90 border border-white/[0.12] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85),0_0_50px_rgba(99,102,241,0.2)] overflow-hidden backdrop-blur-2xl transition-shadow duration-500 hover:shadow-[0_30px_90px_-15px_rgba(99,102,241,0.35)]"
      >
        {/* Dynamic Glare Overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay z-30"
          style={{
            background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.4), transparent 60%)`
          }}
        />

        {/* Window Controls Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-[#0E1015]/90">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-crimson/80" />
            <div className="w-3 h-3 rounded-full bg-amber-400/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
            <span className="text-xs font-mono text-muted-foreground ml-3 hidden sm:inline">
              rakcha.app / squad-hangout #general-stage
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Stage Active
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-white/[0.05] px-2.5 py-1 rounded-lg border border-white/[0.06]">
              CODE: SQUAD-7782
            </div>
          </div>
        </div>

        {/* Realistic Rakcha Discord-style Hangout Interface */}
        <div className="grid grid-cols-12 min-h-[380px] sm:min-h-[460px] text-left">
          {/* Left Sidebar (Group Channels) */}
          <div className="col-span-3 sm:col-span-3 bg-[#0D0F14]/95 p-3 sm:p-4 border-r border-white/[0.06] flex flex-col justify-between hidden xs:flex">
            <div>
              <div className="flex items-center gap-2.5 px-2 py-2 mb-4 bg-white/[0.04] rounded-xl border border-white/[0.06]">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-white text-xs">
                  🎮
                </div>
                <div className="min-w-0 flex-1 hidden sm:block">
                  <h4 className="text-xs font-bold text-white truncate">Cyber Squad HQ</h4>
                  <p className="text-[10px] text-muted-foreground truncate">14 Members Online</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
                  Stages & Voice
                </div>
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-primary/20 text-white font-medium text-xs border border-primary/30">
                  <Volume2 size={14} className="text-secondary animate-pulse" />
                  <span className="truncate">General Stage</span>
                  <span className="ml-auto text-[10px] bg-primary px-1.5 py-0.5 rounded-full font-bold">4</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-muted-foreground hover:text-white hover:bg-white/[0.03] transition text-xs">
                  <Headphones size={14} />
                  <span className="truncate">Music & Chill</span>
                </div>

                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 pt-3">
                  Text Channels
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-muted-foreground hover:text-white hover:bg-white/[0.03] transition text-xs">
                  <MessageSquare size={14} />
                  <span className="truncate"># chat-lounge</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-muted-foreground hover:text-white hover:bg-white/[0.03] transition text-xs">
                  <Share2 size={14} />
                  <span className="truncate"># clips-and-memes</span>
                </div>
              </div>
            </div>

            {/* User Mini Bar */}
            <div className="bg-[#141720] p-2 rounded-xl border border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative">
                  <img
                    src={DEFAULT_AVATAR}
                    alt="Current user"
                    className="w-7 h-7 rounded-full border border-white/20"
                  />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-1 ring-black" />
                </div>
                <div className="min-w-0 hidden sm:block">
                  <p className="text-[11px] font-bold text-white truncate">Alex Vance</p>
                  <p className="text-[9px] text-emerald-400 truncate">Connected</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Mic size={14} className="text-white/70 hover:text-white cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Central Stage & Chat Area */}
          <div className="col-span-12 xs:col-span-9 flex flex-col bg-[#12141C]/80">
            {/* Active Video & Voice Grid */}
            <div className="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 bg-[#0A0C10]/50 border-b border-white/[0.06]">
              {/* Participant 1 (Speaking) */}
              <div className="relative aspect-video sm:aspect-square bg-gradient-to-b from-[#1E2333] to-[#131622] rounded-2xl border-2 border-primary shadow-[0_0_20px_rgba(99,102,241,0.4)] flex flex-col items-center justify-center p-2 group overflow-hidden">
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] text-white">
                  <Mic size={11} className="text-secondary animate-pulse" />
                  <span>Sarah M.</span>
                </div>
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
                  alt="Sarah"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-primary object-cover shadow-lg"
                />
                <div className="absolute inset-x-0 bottom-2 flex justify-center">
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-3 bg-secondary rounded-full animate-bounce" />
                    <span className="w-1 h-5 bg-primary rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1 h-4 bg-secondary rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              </div>

              {/* Participant 2 */}
              <div className="relative aspect-video sm:aspect-square bg-[#151924] rounded-2xl border border-white/[0.08] flex flex-col items-center justify-center p-2 overflow-hidden">
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] text-white/90">
                  <Mic size={11} className="text-muted-foreground" />
                  <span>Karim T.</span>
                </div>
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80"
                  alt="Karim"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/20 object-cover"
                />
              </div>

              {/* Participant 3 */}
              <div className="relative aspect-video sm:aspect-square bg-[#151924] rounded-2xl border border-white/[0.08] flex flex-col items-center justify-center p-2 overflow-hidden">
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] text-white/90">
                  <Mic size={11} className="text-muted-foreground" />
                  <span>Elena R.</span>
                </div>
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80"
                  alt="Elena"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/20 object-cover"
                />
              </div>

              {/* Participant 4 (Screen Share Preview) */}
              <div className="relative aspect-video sm:aspect-square bg-gradient-to-br from-indigo-900/40 to-slate-900 rounded-2xl border border-secondary/30 flex flex-col items-center justify-center p-2 overflow-hidden">
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] text-secondary font-semibold">
                  <Share2 size={11} />
                  <span>4K Stream</span>
                </div>
                <div className="text-center">
                  <Zap size={24} className="text-secondary mx-auto mb-1 animate-pulse" />
                  <span className="text-[10px] text-white/80 font-mono">Game Feed 60FPS</span>
                </div>
              </div>
            </div>

            {/* Chat Messages Stream */}
            <div className="flex-1 p-4 space-y-3 overflow-hidden flex flex-col justify-end">
              <div className="flex items-start gap-2.5">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80"
                  alt="Sarah"
                  className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                />
                <div className="bg-[#181B24] border border-white/[0.06] rounded-2xl rounded-tl-sm px-3.5 py-2 max-w-sm">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-primary">Sarah M.</span>
                    <span className="text-[10px] text-muted-foreground">Just now</span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    Voice quality on this stage is ridiculously crisp! 🔥 No lag at all.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80"
                  alt="Karim"
                  className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                />
                <div className="bg-[#181B24] border border-white/[0.06] rounded-2xl rounded-tl-sm px-3.5 py-2 max-w-sm">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-secondary">Karim T.</span>
                    <span className="text-[10px] text-muted-foreground">1 min ago</span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    Shared the invite code <code className="text-amber-300 font-mono bg-white/[0.05] px-1 rounded">SQUAD-7782</code> with the crew!
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 bg-[#0E1017] border-t border-white/[0.06] flex items-center gap-2">
              <div className="flex-1 bg-[#151821] border border-white/[0.08] rounded-xl px-3 py-2 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value="Hyped for the weekend tournament! 🚀"
                  className="w-full bg-transparent text-xs text-foreground focus:outline-none cursor-default"
                />
                <Smile size={16} className="text-muted-foreground" />
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-indigo-500 transition shadow-md shadow-primary/30"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Interactive Spotlight Feature Card Component
function FeatureCard({ icon, title, desc, tag, gradient, delay = 0 }) {
  const cardRef = useRef(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, scale: 1.01 }}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative rounded-[2rem] bg-[#121318]/80 backdrop-blur-xl border border-white/[0.09] p-8 overflow-hidden transition-all duration-300 shadow-[0_15px_35px_rgba(0,0,0,0.5)] group"
    >
      {/* Light-Tracking Cursor Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.15), transparent 40%)`
        }}
      />

      {/* Top Accent Line */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient}`}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-inner">
            {icon}
          </div>
          {tag && (
            <span className="text-[11px] font-bold font-mono tracking-wider uppercase px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-muted-foreground group-hover:text-white transition-colors">
              {tag}
            </span>
          )}
        </div>

        <h3 className="text-2xl font-heading font-bold text-white mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-indigo-300 transition-colors">
          {title}
        </h3>

        <p className="text-muted-foreground leading-relaxed text-sm sm:text-base font-medium">
          {desc}
        </p>
      </div>
    </motion.div>
  );
}

// Live Showcase Tabs Component
function ShowcaseSection() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      id: 0,
      title: 'Instant Stages',
      subtitle: 'Crystal-Clear Voice & Video Stages',
      icon: <Video size={18} />,
      badge: 'Zero Configuration',
      desc: 'Jump instantly into crisp 60 FPS video & spatial audio with zero configuration and seamless screen sharing.',
      highlights: [
        'Crystal clear WebRTC spatial audio',
        'One-click screen sharing in 1080p/4K',
        'Automatic noise cancellation & speech detection',
        'Dynamic speaker focus highlighting'
      ]
    },
    {
      id: 1,
      title: 'Fluid Messaging',
      subtitle: 'Lightning Fast Real-time Sync',
      icon: <MessageSquare size={18} />,
      badge: 'Sub-10ms Latency',
      desc: 'Blazing fast messaging powered by Supabase Realtime and socket sync. Rich emojis, seamless media sharing, and instant delivery.',
      highlights: [
        'Instant typing indicators & presence status',
        'Rich media previews & avatar customizations',
        'Distraction-free, dark glass interface',
        'Direct messages and custom group rooms'
      ]
    },
    {
      id: 2,
      title: 'Protected Access',
      subtitle: 'Your Squad, Your Rules',
      icon: <Shield size={18} />,
      badge: 'Invite Codes (XXXX-XXXX)',
      desc: 'Control who joins your inner circle with cryptographic invite codes. Full admin governance with kick, mute, and role permissions.',
      highlights: [
        'Unique 8-character squad invite codes',
        'Complete admin control over memberships',
        'Instant user mute and privacy protection',
        'Zero tracking, zero intrusive advertisement'
      ]
    }
  ];

  return (
    <section id="showcase" className="py-24 px-4 max-w-7xl mx-auto w-full relative z-20">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-secondary mb-4 uppercase tracking-widest"
        >
          <Sparkles size={14} className="text-secondary" /> Experience The Difference
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-3xl sm:text-5xl font-heading font-black tracking-tight text-white mb-4"
        >
          Engineered for smoothness.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg"
        >
          Every pixel, animation, and stage is tuned to feel fluid, responsive, and ultra-modern.
        </motion.p>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap justify-center gap-2 mb-12">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center gap-2.5 ${
              activeTab === tab.id
                ? 'text-white shadow-lg'
                : 'text-muted-foreground hover:text-white bg-white/[0.03] border border-white/[0.06]'
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="showcase-tab-active"
                className="absolute inset-0 bg-gradient-to-r from-primary to-indigo-600 rounded-2xl shadow-[0_0_25px_rgba(99,102,241,0.4)]"
                transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.icon}</span>
            <span className="relative z-10">{tab.title}</span>
          </button>
        ))}
      </div>

      {/* Tab Content Showcase Card */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="rounded-[2.5rem] bg-[#12141C]/80 backdrop-blur-2xl border border-white/[0.09] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.6)] glow-border grid md:grid-cols-2 gap-8 items-center"
          >
            <div>
              <div className="inline-block px-3.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold font-mono uppercase tracking-wider mb-4">
                {tabs[activeTab].badge}
              </div>
              <h3 className="text-3xl sm:text-4xl font-heading font-black text-white mb-3">
                {tabs[activeTab].subtitle}
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-8 text-base">
                {tabs[activeTab].desc}
              </p>

              <div className="space-y-3">
                {tabs[activeTab].highlights.map((item, idx) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-center gap-3 text-sm font-medium text-foreground/90"
                  >
                    <CheckCircle size={17} className="text-secondary shrink-0" />
                    <span>{item}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Showcase Visual Card */}
            <div className="bg-[#0D0E13] rounded-3xl p-6 border border-white/[0.08] shadow-inner relative overflow-hidden flex flex-col items-center justify-center min-h-[280px]">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-primary to-indigo-400 flex items-center justify-center text-white mb-4 shadow-[0_0_30px_rgba(99,102,241,0.5)] animate-bounce [animation-duration:3s]">
                {tabs[activeTab].icon}
              </div>
              <h4 className="text-xl font-heading font-bold text-white mb-1">
                {tabs[activeTab].title}
              </h4>
              <p className="text-xs text-muted-foreground text-center max-w-xs font-mono">
                Built natively for Web & Mobile with zero latency bottleneck.
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

// Interactive FAQ Accordion Component
function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      q: 'What makes Rakcha unique for squads?',
      a: 'Rakcha is built from the ground up for simplicity, speed, and privacy. Simply create your squad, share a clean 8-character invite code (XXXX-XXXX), and immediately enjoy instant high-def stages, fluid real-time messaging, and spatial voice.'
    },
    {
      q: 'Are the voice and video stages free to use?',
      a: 'Yes, Rakcha offers free, unlimited peer-to-peer and mesh voice/video stages with crystal-clear audio and screen-sharing support.'
    },
    {
      q: 'How do the group invite codes work?',
      a: 'Every squad group generates a secure, unique alphanumeric invite code (format: XXXX-XXXX). Friends enter this code to join in one click without complicated onboarding.'
    },
    {
      q: 'Can I customize my profile and status?',
      a: 'Absolutely! You can upload custom avatars, set your handle (@username), write a personal bio, and showcase your online status in real-time.'
    }
  ];

  return (
    <section id="faq" className="py-24 px-4 max-w-4xl mx-auto w-full relative z-20">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-primary mb-4 uppercase tracking-widest"
        >
          <Shield size={14} /> Clear Answers
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-3xl sm:text-5xl font-heading font-black tracking-tight text-white mb-4"
        >
          Frequently Asked Questions
        </motion.h2>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <motion.div
              key={faq.q}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-2xl bg-[#121318]/70 backdrop-blur-xl border border-white/[0.08] overflow-hidden transition-all duration-300"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full p-6 text-left flex items-center justify-between gap-4 text-white hover:text-primary transition-colors font-heading font-bold text-base sm:text-lg"
              >
                <span>{faq.q}</span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                  className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0 text-muted-foreground"
                >
                  <ChevronDown size={18} />
                </motion.div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <div className="px-6 pb-6 text-muted-foreground text-sm sm:text-base leading-relaxed border-t border-white/[0.05] pt-4 font-medium">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// Testimonials Section
function TestimonialsSection() {
  const reviews = [
    {
      name: 'Yassine M.',
      role: 'Esports Squad Captain',
      comment: 'Rakcha is our go-to hub for all gaming sessions and tournaments. Zero voice delay, crisp video, and getting the squad together takes 5 seconds.',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'
    },
    {
      name: 'Nour K.',
      role: 'Digital Creator',
      comment: 'The interface is breathtaking. The dark glass aesthetics and smooth micro-animations make chatting with my community feel luxury.',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80'
    },
    {
      name: 'Adam B.',
      role: 'Fullstack Dev',
      comment: 'Instant stages with invite codes are pure genius. We hold all our daily standups and pair-programming sessions right here.',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80'
    }
  ];

  return (
    <section id="testimonials" className="py-24 px-4 max-w-7xl mx-auto w-full relative z-20">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-amber-400 mb-4 uppercase tracking-widest"
        >
          <Sparkles size={14} /> Loved by squads worldwide
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-3xl sm:text-5xl font-heading font-black tracking-tight text-white mb-4"
        >
          What creators & squads say
        </motion.h2>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {reviews.map((rev, i) => (
          <motion.div
            key={rev.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15, duration: 0.6 }}
            whileHover={{ y: -6 }}
            className="rounded-3xl bg-[#121318]/70 backdrop-blur-xl border border-white/[0.08] p-8 flex flex-col justify-between shadow-xl"
          >
            <p className="text-foreground/90 text-base leading-relaxed mb-6 font-medium">
              "{rev.comment}"
            </p>
            <div className="flex items-center gap-3.5 pt-4 border-t border-white/[0.06]">
              <img
                src={rev.avatar}
                alt={rev.name}
                className="w-11 h-11 rounded-full object-cover border border-primary/40"
              />
              <div>
                <h4 className="text-sm font-heading font-bold text-white">{rev.name}</h4>
                <p className="text-xs text-muted-foreground">{rev.role}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export default function Landing() {
  const navigate = useRakchaStore((s) => s.navigate);
  const currentUser = useRakchaStore((s) => s.currentUser);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-clip selection:bg-primary/30 selection:text-white">
      {/* Dynamic Ambient Glowing Mesh Background */}
      <AnimatedBackground />

      {/* Sticky Glass Navigation Bar */}
      <Navbar />

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-20 pt-32 sm:pt-40 pb-20">
        <motion.div
          variants={heroContainerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center max-w-5xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            variants={heroItemVariants}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] backdrop-blur-xl border border-white/[0.12] text-xs font-semibold text-secondary mb-8 hover:scale-105 transition-transform cursor-default shadow-[0_0_25px_rgba(6,182,212,0.15)]"
          >
            <Zap size={14} className="fill-secondary text-secondary animate-pulse" />
            <span>Next-Gen Communication Hub</span>
            <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
            <span className="text-white/80">Version 1.0 Live</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            variants={heroItemVariants}
            className="text-5xl sm:text-7xl md:text-8xl font-heading font-black tracking-tighter leading-[1.06] mb-8 text-white max-w-5xl"
          >
            Your new <br className="hidden sm:block" />
            <span className="relative inline-block mt-1">
              <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-400 to-secondary animate-gradient-x">
                hangout spot.
              </span>
              <span className="absolute inset-0 blur-3xl bg-gradient-to-r from-primary/40 via-indigo-500/30 to-crimson/20 -z-10" />
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={heroItemVariants}
            className="text-lg sm:text-2xl text-muted-foreground max-w-3xl mb-10 leading-relaxed font-medium"
          >
            Create your squad, grab a link, and start chilling instantly with crystal-clear voice, video, and fluid chat.
          </motion.p>

          {/* Action Buttons & Social Proof */}
          <motion.div
            variants={heroItemVariants}
            className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-16 w-full sm:w-auto"
          >
            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(currentUser ? 'app' : 'register')}
              className="w-full sm:w-auto bg-gradient-to-r from-primary via-indigo-500 to-secondary text-white px-9 py-4 rounded-2xl font-bold text-lg shadow-[0_0_40px_rgba(99,102,241,0.5)] hover:shadow-[0_0_60px_rgba(99,102,241,0.75)] transition-all duration-300 group relative overflow-hidden flex items-center justify-center gap-2.5"
            >
              <span className="relative z-10">
                {currentUser ? 'Open Dashboard' : 'Start Your Squad Free'}
              </span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            </motion.button>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-3.5 text-sm font-medium text-muted-foreground bg-white/[0.04] px-5 py-3 rounded-2xl border border-white/[0.08] backdrop-blur-md"
            >
              <div className="flex -space-x-2.5">
                {[
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80',
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80',
                  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&auto=format&fit=crop&q=80'
                ].map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt="Active squad user"
                    className="w-8 h-8 rounded-full border-2 border-[#0B0E14] object-cover"
                  />
                ))}
              </div>
              <span className="text-xs sm:text-sm text-foreground/90 font-semibold">
                Join <strong className="text-white">10,000+</strong> active squads
              </span>
            </motion.div>
          </motion.div>

          {/* Interactive 3D Tilt App Preview */}
          <motion.div variants={heroItemVariants} className="w-full">
            <InteractiveTiltMockup />
          </motion.div>
        </motion.div>

        {/* Feature Cards Grid (Scroll Triggered) */}
        <section id="features" className="max-w-7xl mx-auto w-full mt-32 px-4">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-secondary mb-4 uppercase tracking-widest"
            >
              <Zap size={14} /> Built For Connection
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl sm:text-5xl font-heading font-black tracking-tight text-white mb-4"
            >
              Everything you need to hang out.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg"
            >
              No complicated onboarding. No bots crashing. Just pure, immediate communication.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            <FeatureCard
              icon={<Video className="text-secondary" size={28} />}
              title="Instant Stages"
              desc="Jump straight into high-definition group video and spatial audio stages. Zero waiting rooms."
              tag="WebRTC"
              gradient="bg-gradient-to-r from-secondary to-primary"
              delay={0}
            />
            <FeatureCard
              icon={<MessageSquare className="text-primary" size={28} />}
              title="Fluid Realtime Chat"
              desc="Blazing fast text messaging with rich media, real-time typing cues, and emojis wrapped in dark glassmorphism."
              tag="Sub-10ms"
              gradient="bg-gradient-to-r from-primary to-indigo-400"
              delay={0.15}
            />
            <FeatureCard
              icon={<Shield className="text-crimson" size={28} />}
              title="Squad Privacy Shield"
              desc="Lock down your group with clean 8-character invite codes (XXXX-XXXX). You control who enters."
              tag="Invite Lock"
              gradient="bg-gradient-to-r from-crimson to-amber-500"
              delay={0.3}
            />
          </div>
        </section>

        {/* Live Interactive Showcase Section */}
        <ShowcaseSection />

        {/* Testimonials */}
        <TestimonialsSection />

        {/* FAQ Accordion */}
        <FAQSection />

        {/* Bottom CTA Banner */}
        <section className="max-w-6xl mx-auto w-full mt-16 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-[3rem] bg-gradient-to-br from-primary/30 via-[#151824]/90 to-secondary/20 border border-white/[0.12] p-10 sm:p-16 text-center relative overflow-hidden backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.7)] glow-border"
          >
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-crimson/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-5xl font-heading font-black text-white mb-6 tracking-tight">
                Ready to upgrade your squad hangout?
              </h2>
              <p className="text-base sm:text-xl text-foreground/80 mb-8 font-medium">
                Create a squad in under 10 seconds. Free forever, no credit card required.
              </p>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(currentUser ? 'app' : 'register')}
                className="bg-white text-black font-extrabold text-lg px-9 py-4 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:shadow-[0_0_60px_rgba(255,255,255,0.6)] transition-all duration-300 inline-flex items-center gap-2 group"
              >
                <span>{currentUser ? 'Go To App' : 'Get Started Now'}</span>
                <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
              </motion.button>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="mt-28 mb-8 text-center text-muted-foreground/60 text-xs font-mono tracking-widest uppercase">
          <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto mb-6" />
          <p>Rakcha © 2026 • Elevated Motion & Voice Communication</p>
        </footer>
      </main>
    </div>
  );
}
