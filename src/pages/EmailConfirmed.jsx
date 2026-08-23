import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRakchaStore } from '../store/useRakchaStore';
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function EmailConfirmed() {
  const navigate = useRakchaStore((s) => s.navigate);

  useEffect(() => {
    // Automatically transition to the app after 4.5 seconds if untouched
    const timer = setTimeout(() => {
      navigate('app');
    }, 4500);
    return () => clearTimeout(timer);
  }, [navigate]);

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
          {/* Success Check Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 20, delay: 0.15 }}
            className="w-24 h-24 bg-gradient-to-tr from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/30 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.3)] relative"
          >
            <CheckCircle2 size={44} />
            <Sparkles size={16} className="absolute top-2 right-2 text-secondary animate-bounce" />
          </motion.div>

          <h2 className="text-3xl font-heading font-black tracking-tight text-white mb-3">
            Email Confirmed!
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8 font-medium">
            Your account is verified and ready. Redirecting you to your dashboard...
          </p>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('app')}
            className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white font-bold py-4 rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] transition-all duration-300 flex items-center justify-center gap-2 group"
          >
            <span>Continue to Dashboard</span>
            <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>
      </main>
    </div>
  );
}
