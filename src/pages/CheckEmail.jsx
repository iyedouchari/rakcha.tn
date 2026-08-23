import React from 'react';
import { motion } from 'framer-motion';
import { useRakchaStore } from '../store/useRakchaStore';
import { Mail, ArrowRight, Sparkles } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function CheckEmail() {
  const navigate = useRakchaStore((s) => s.navigate);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-clip selection:bg-primary/30 selection:text-white">
      <AnimatedBackground />

      <main className="flex-1 flex items-center justify-center p-6 relative z-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-[#121318]/85 backdrop-blur-2xl p-8 md:p-12 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] border border-white/[0.09] glow-border text-center relative overflow-hidden"
        >
          {/* Glowing Animated Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 20, delay: 0.15 }}
            className="w-24 h-24 bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-3xl flex items-center justify-center mx-auto mb-6 text-primary shadow-[0_0_35px_rgba(99,102,241,0.3)] relative"
          >
            <Mail size={44} className="animate-pulse" />
            <Sparkles size={16} className="absolute top-2 right-2 text-secondary animate-bounce" />
          </motion.div>

          <h2 className="text-3xl font-heading font-black tracking-tight text-white mb-3">
            Check your email
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8 font-medium">
            We've sent a magic confirmation link to your inbox. Click the link to instantly activate your Rakcha squad account.
          </p>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('login')}
            className="w-full bg-gradient-to-r from-primary to-indigo-600 text-white font-bold py-4 rounded-xl shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] transition-all duration-300 flex items-center justify-center gap-2 group"
          >
            <span>Return to Sign In</span>
            <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>
      </main>
    </div>
  );
}
