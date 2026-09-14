import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useRakchaStore } from '../store/useRakchaStore';
import {
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function UpdatePassword() {
  const navigate = useRakchaStore((s) => s.navigate);
  const showToast = useRakchaStore((s) => s.showToast);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // Password rules validation
  const hasMinLength = password.length >= 6;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!hasMinLength) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (!hasUpper || !hasLower || !hasNumber) {
      setError('Password must include uppercase, lowercase, and a number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your confirmation password.');
      return;
    }

    try {
      setLoading(true);
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      showToast('Password updated successfully!', 'success');
      setTimeout(() => {
        navigate('app');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to update password. Your recovery link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-clip selection:bg-primary/30 selection:text-white">
      <AnimatedBackground />

      <header className="p-6 relative z-20 flex items-center justify-between max-w-6xl mx-auto w-full">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('landing')}
        >
          <img
            src="/logo.png"
            alt="Rakcha"
            className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]"
          />
          <span className="font-heading font-black text-xl tracking-tight text-white">RAKCHA</span>
        </motion.div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative z-20 -mt-8 mb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-[#121316]/90 backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] border border-white/[0.09] relative overflow-hidden glow-border"
        >
          {/* Ambient Glows */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-secondary/15 rounded-full blur-3xl pointer-events-none" />

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="w-20 h-20 bg-emerald-500/15 border border-emerald-500/30 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.25)] relative">
                <CheckCircle2 size={40} />
                <Sparkles size={16} className="absolute top-2 right-2 text-emerald-300 animate-pulse" />
              </div>
              <h2 className="text-2xl font-heading font-black text-white mb-2">Password Updated!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your new password has been set. Redirecting you to your dashboard...
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('app')}
                className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2"
              >
                <span>Continue to Dashboard</span>
                <ArrowRight size={16} />
              </motion.button>
            </motion.div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-6 relative z-10">
                <div className="w-14 h-14 bg-primary/10 border border-primary/25 rounded-2xl flex items-center justify-center mx-auto mb-3.5 text-primary shadow-[0_0_25px_rgba(99,102,241,0.3)]">
                  <KeyRound size={26} />
                </div>
                <h2 className="text-2xl font-heading font-black tracking-tight text-white mb-1">
                  Set New Password
                </h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Create a new secure password for your Rakcha account.
                </p>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="flex items-start gap-2.5 bg-crimson/15 border border-crimson/30 text-rose-300 text-xs font-medium rounded-xl px-4 py-3 mb-4 overflow-hidden"
                  >
                    <AlertCircle size={16} className="shrink-0 text-crimson mt-0.5" />
                    <span className="leading-snug">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative z-10">
                {/* New Password */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Lock size={13} className={focusedField === 'password' ? 'text-primary' : 'text-muted-foreground'} />
                    New Password
                  </label>
                  <div
                    className={`relative rounded-xl border transition-all duration-300 flex items-center ${
                      focusedField === 'password'
                        ? 'border-primary/80 ring-2 ring-primary/20 bg-[#161820]'
                        : 'border-white/[0.08] bg-[#0E1015]/90 hover:border-white/[0.15]'
                    }`}
                  >
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Enter new password"
                      className="w-full bg-transparent p-3.5 pr-11 text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm font-medium rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 p-1.5 text-muted-foreground hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Lock size={13} className={focusedField === 'confirmPassword' ? 'text-primary' : 'text-muted-foreground'} />
                    Confirm Password
                  </label>
                  <div
                    className={`relative rounded-xl border transition-all duration-300 flex items-center ${
                      focusedField === 'confirmPassword'
                        ? 'border-primary/80 ring-2 ring-primary/20 bg-[#161820]'
                        : 'border-white/[0.08] bg-[#0E1015]/90 hover:border-white/[0.15]'
                    }`}
                  >
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError('');
                      }}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Confirm new password"
                      className="w-full bg-transparent p-3.5 pr-11 text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm font-medium rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 p-1.5 text-muted-foreground hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Password Requirements Badges */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-medium pt-1">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-muted-foreground/60'}`}>
                    <ShieldCheck size={12} />
                    <span>6+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUpper && hasLower ? 'text-emerald-400' : 'text-muted-foreground/60'}`}>
                    <ShieldCheck size={12} />
                    <span>Upper & lower case</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-muted-foreground/60'}`}>
                    <ShieldCheck size={12} />
                    <span>At least 1 number</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-400' : 'text-muted-foreground/60'}`}>
                    <ShieldCheck size={12} />
                    <span>Passwords match</span>
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-primary via-indigo-500 to-primary text-white font-bold py-4 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_45px_rgba(99,102,241,0.6)] transition-all duration-300 flex items-center justify-center gap-2 group relative overflow-hidden disabled:opacity-60"
                >
                  {loading ? (
                    <div className="flex items-center gap-2.5">
                      <Loader2 size={18} className="animate-spin text-white" />
                      <span>Updating Password...</span>
                    </div>
                  ) : (
                    <>
                      <span className="relative z-10 text-sm tracking-wide font-bold">Update Password</span>
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform relative z-10" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    </>
                  )}
                </motion.button>
              </form>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
