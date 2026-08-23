import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRakchaStore } from '../store/useRakchaStore';
import { Sparkles, Menu, X, ArrowRight, Shield, MessageSquare, Video } from 'lucide-react';

export default function Navbar() {
  const navigate = useRakchaStore((s) => s.navigate);
  const currentUser = useRakchaStore((s) => s.currentUser);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0B0E14]/90 backdrop-blur-xl border-b border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.5)] py-3.5'
          : 'bg-transparent border-b border-transparent py-5 shadow-none'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
        {/* Brand Logo */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <img
            src="/logo.png"
            alt="Rakcha"
            className="w-10 h-10 object-contain drop-shadow-[0_0_14px_rgba(99,102,241,0.55)] group-hover:drop-shadow-[0_0_22px_rgba(99,102,241,0.85)] transition-all duration-300"
          />
          <span className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white/95 to-white/75 group-hover:to-primary transition-colors">
            Rakcha
          </span>
        </motion.div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] px-4 py-1.5 rounded-full shadow-inner">
          <button
            onClick={() => scrollToSection('features')}
            className="px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/[0.06] transition-all duration-200"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection('showcase')}
            className="px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/[0.06] transition-all duration-200"
          >
            Live Showcase
          </button>
          <button
            onClick={() => scrollToSection('testimonials')}
            className="px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/[0.06] transition-all duration-200"
          >
            Community
          </button>
          <button
            onClick={() => scrollToSection('faq')}
            className="px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/[0.06] transition-all duration-200"
          >
            FAQ
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {currentUser ? (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('app')}
              className="bg-primary hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-2.5 rounded-full shadow-[0_0_25px_rgba(99,102,241,0.4)] flex items-center gap-2 group transition-all"
            >
              <span>Launch App</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </motion.button>
          ) : (
            <>
              <motion.button
                whileHover={{ scale: 1.04, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('login')}
                className="bg-white/[0.05] border border-white/[0.1] text-foreground hover:text-white font-semibold text-sm px-5 py-2.5 rounded-full backdrop-blur-md transition-all"
              >
                Sign In
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(99, 102, 241, 0.6)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('register')}
                className="bg-gradient-to-r from-primary via-indigo-500 to-secondary text-white font-semibold text-sm px-6 py-2.5 rounded-full shadow-[0_0_25px_rgba(99,102,241,0.4)] flex items-center gap-2 group transition-all"
              >
                <span>Get Started</span>
                <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
              </motion.button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </motion.button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="md:hidden bg-[#0B0E14]/95 backdrop-blur-2xl border-b border-white/[0.08] overflow-hidden"
          >
            <div className="px-6 py-6 flex flex-col gap-4">
              <button
                onClick={() => scrollToSection('features')}
                className="flex items-center gap-3 text-left py-2 text-foreground hover:text-primary transition-colors text-base font-medium"
              >
                <Video size={18} className="text-secondary" /> Features
              </button>
              <button
                onClick={() => scrollToSection('showcase')}
                className="flex items-center gap-3 text-left py-2 text-foreground hover:text-primary transition-colors text-base font-medium"
              >
                <MessageSquare size={18} className="text-primary" /> Live Showcase
              </button>
              <button
                onClick={() => scrollToSection('testimonials')}
                className="flex items-center gap-3 text-left py-2 text-foreground hover:text-primary transition-colors text-base font-medium"
              >
                <Sparkles size={18} className="text-amber-400" /> Community
              </button>
              <button
                onClick={() => scrollToSection('faq')}
                className="flex items-center gap-3 text-left py-2 text-foreground hover:text-primary transition-colors text-base font-medium"
              >
                <Shield size={18} className="text-emerald-400" /> FAQ
              </button>

              <div className="pt-4 border-t border-white/[0.08] flex flex-col gap-3">
                {currentUser ? (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('app');
                    }}
                    className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                  >
                    Open App <ArrowRight size={18} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('login');
                      }}
                      className="w-full bg-white/[0.05] border border-white/[0.1] text-white font-semibold py-3 rounded-xl transition hover:bg-white/[0.1]"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('register');
                      }}
                      className="w-full bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 rounded-xl transition shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                    >
                      Create Free Account <Sparkles size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
