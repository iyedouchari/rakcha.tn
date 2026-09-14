import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRakchaStore } from '../store/useRakchaStore';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Upload,
  User,
  AtSign,
  FileText,
  X,
  Sparkles
} from 'lucide-react';
import AnimatedBackground from './AnimatedBackground';
import UsernameInput from './UsernameInput';
import { validateUsernameFormat, checkUsernameAvailability } from '../utils/validateUsername';

export default function AuthModal({ initialMode = 'login', isModal = false, onClose }) {
  const navigate = useRakchaStore((s) => s.navigate);
  const signIn = useRakchaStore((s) => s.signIn);
  const signUp = useRakchaStore((s) => s.signUp);
  const updateProfile = useRakchaStore((s) => s.updateProfile);
  const resetPasswordForEmail = useRakchaStore((s) => s.resetPasswordForEmail);

  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot'
  const [registerStep, setRegisterStep] = useState(1); // Step 1: Email/Password, Step 2: Avatar/Profile
  const [resetSent, setResetSent] = useState(false);

  // Step 1 Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2 Fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setRegisterStep(1);
    setResetSent(false);
    setError('');
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      await resetPasswordForEmail(email.trim());
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
        setError('');
      } else {
        setError('Please upload a valid image file (PNG, JPG, WebP).');
      }
    }
  };

  const handleRemoveAvatar = (e) => {
    e.stopPropagation();
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const validateStep1 = () => {
    if (!email.trim()) {
      setError('Please provide a valid email address.');
      return false;
    }
    if (!password) {
      setError('Please enter a password.');
      return false;
    }
    if (password.length <= 6) {
      setError('Password must be longer than 6 characters.');
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter.');
      return false;
    }
    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter.');
      return false;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number.');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please confirm your password.');
      return false;
    }
    return true;
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();
    setError('');
    if (!validateStep1()) return;

    setRegisterStep(2);
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!avatarFile) {
      setError('Please upload an avatar image before continuing.');
      return;
    }

    if (!displayName.trim()) {
      setError('Please enter your display name.');
      return;
    }

    const usernameValidation = validateUsernameFormat(username);
    if (!usernameValidation.isValid) {
      setError(usernameValidation.message);
      return;
    }

    const fullUsername = usernameValidation.fullUsername;

    if (!bio.trim()) {
      setError('Please write a short bio.');
      return;
    }

    try {
      setLoading(true);

      // Verify availability
      const availability = await checkUsernameAvailability(fullUsername);
      if (!availability.isAvailable) {
        setError(availability.message || 'This username is already taken. Please choose another.');
        setLoading(false);
        return;
      }

      const data = await signUp({
        email: email.trim(),
        password,
        username: fullUsername,
        displayName: displayName.trim()
      });

      if (data?.session) {
        useRakchaStore.setState({ session: data.session });
        await updateProfile({
          displayName: displayName.trim(),
          username: fullUsername,
          customStatus: bio.trim(),
          avatarFile
        });
        navigate('app');
      } else if (data?.user && !data?.session) {
        navigate('check-email');
      } else {
        navigate('app');
      }
    } catch (err) {
      if (err.message && err.message.includes('already registered')) {
        setError('This email is already registered. Please sign in instead.');
        setRegisterStep(1);
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      await signIn({ email, password });
      navigate('app');
    } catch (err) {
      setError(err.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const containerContent = (
    <motion.div
      layout
      transition={{ layout: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
      className="w-full max-w-md bg-[#121316]/90 backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] border border-white/[0.09] relative overflow-hidden glow-border my-6"
    >
      {/* Ambient Inner Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-crimson/15 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center mb-6 relative z-10">
        <motion.div
          whileHover={{ scale: 1.08, rotate: 3 }}
          className="w-16 h-16 mx-auto mb-3 cursor-pointer flex items-center justify-center"
          onClick={() => navigate('landing')}
        >
          <img
            src="/logo.png"
            alt="Rakcha"
            className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(99,102,241,0.65)]"
          />
        </motion.div>

        <motion.h2
          key={mode + (mode === 'register' ? registerStep : '') + '-title'}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-3xl font-heading font-black tracking-tight text-white mb-1.5"
        >
          {mode === 'login'
            ? 'Sign in to Rakcha'
            : mode === 'forgot'
            ? 'Reset Password'
            : registerStep === 1
            ? 'Create your account'
            : 'Set up your profile'}
        </motion.h2>

        <motion.p
          key={mode + (mode === 'register' ? registerStep : '') + '-subtitle'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="text-sm text-muted-foreground font-medium"
        >
          {mode === 'login'
            ? 'Enter your credentials to access your squad'
            : mode === 'forgot'
            ? 'Enter your email to receive a password reset link'
            : registerStep === 1
            ? 'Enter your email and create a secure password'
            : 'Choose your avatar, display name, username, and bio'}
        </motion.p>

        {mode === 'register' && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                registerStep === 1 ? 'w-8 bg-primary' : 'w-3 bg-white/20'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                registerStep === 2 ? 'w-8 bg-primary' : 'w-3 bg-white/20'
              }`}
            />
          </div>
        )}
      </div>

      {/* Error Alert Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0, x: [-8, 8, -6, 6, -3, 3, 0] }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className="flex items-start gap-2.5 bg-crimson/15 border border-crimson/30 text-rose-300 text-xs font-medium rounded-xl px-4 py-3 mb-4 overflow-hidden shadow-[0_0_20px_rgba(244,63,94,0.15)]"
          >
            <AlertCircle size={16} className="shrink-0 text-crimson mt-0.5" />
            <span className="leading-snug">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forms based on Mode & Step */}
      <div className="relative z-10">
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail size={13} className={focusedField === 'email' ? 'text-primary' : 'text-muted-foreground'} />
                Email Address
              </label>
              <div
                className={`rounded-xl border transition-all duration-300 ${
                  focusedField === 'email'
                    ? 'border-primary/80 ring-2 ring-primary/20 bg-[#161820]'
                    : 'border-white/[0.08] bg-[#0E1015]/90 hover:border-white/[0.15]'
                }`}
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent p-3.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm font-medium rounded-xl"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Lock size={13} className={focusedField === 'password' ? 'text-primary' : 'text-muted-foreground'} />
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setResetSent(false);
                    setMode('forgot');
                  }}
                  className="text-primary hover:text-indigo-400 text-xs font-medium transition-colors"
                >
                  Forgot?
                </button>
              </div>
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
                  placeholder="••••••••"
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
                  <span>Signing In...</span>
                </div>
              ) : (
                <>
                  <span className="relative z-10 text-sm tracking-wide font-bold">Sign In</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform relative z-10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                </>
              )}
            </motion.button>
          </form>
        )}

        {mode === 'forgot' && (
          <div className="flex flex-col gap-4">
            {resetSent ? (
              <div className="text-center py-3">
                <div className="w-14 h-14 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3.5 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  <Mail size={26} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Check your email</h3>
                <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                  We sent a recovery link to <span className="text-white font-semibold">{email}</span>. Click the link in the email to set your new password.
                </p>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('login')}
                  className="w-full bg-white/[0.06] hover:bg-white/[0.1] text-foreground font-bold py-3.5 rounded-xl transition border border-white/[0.08] text-sm flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={16} /> Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Mail size={13} className={focusedField === 'email' ? 'text-primary' : 'text-muted-foreground'} />
                    Account Email
                  </label>
                  <div
                    className={`rounded-xl border transition-all duration-300 ${
                      focusedField === 'email'
                        ? 'border-primary/80 ring-2 ring-primary/20 bg-[#161820]'
                        : 'border-white/[0.08] bg-[#0E1015]/90 hover:border-white/[0.15]'
                    }`}
                  >
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="you@example.com"
                      className="w-full bg-transparent p-3.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm font-medium rounded-xl"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1 bg-gradient-to-r from-primary via-indigo-500 to-primary text-white font-bold py-4 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_45px_rgba(99,102,241,0.6)] transition-all duration-300 flex items-center justify-center gap-2 group relative overflow-hidden disabled:opacity-60"
                >
                  {loading ? (
                    <div className="flex items-center gap-2.5">
                      <Loader2 size={18} className="animate-spin text-white" />
                      <span>Sending Link...</span>
                    </div>
                  ) : (
                    <>
                      <span className="relative z-10 text-sm tracking-wide font-bold">Send Reset Link</span>
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform relative z-10" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    </>
                  )}
                </motion.button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('login')}
                    className="text-xs text-muted-foreground hover:text-white transition-colors font-medium inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft size={13} /> Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {mode === 'register' && registerStep === 1 && (
          <form onSubmit={handleStep1Submit} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail size={13} className={focusedField === 'email' ? 'text-primary' : 'text-muted-foreground'} />
                Email Address
              </label>
              <div
                className={`rounded-xl border transition-all duration-300 ${
                  focusedField === 'email'
                    ? 'border-primary/80 ring-2 ring-primary/20 bg-[#161820]'
                    : 'border-white/[0.08] bg-[#0E1015]/90 hover:border-white/[0.15]'
                }`}
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent p-3.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm font-medium rounded-xl"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Lock size={13} className={focusedField === 'password' ? 'text-primary' : 'text-muted-foreground'} />
                Password
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
                  placeholder="Create a password"
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
                  placeholder="Confirm your password"
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

            {/* Next Step Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full mt-2 bg-gradient-to-r from-primary via-indigo-500 to-primary text-white font-bold py-4 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_45px_rgba(99,102,241,0.6)] transition-all duration-300 flex items-center justify-center gap-2 group relative overflow-hidden"
            >
              <span className="relative z-10 text-sm tracking-wide font-bold">Next</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            </motion.button>
          </form>
        )}

        {mode === 'register' && registerStep === 2 && (
          <form onSubmit={handleStep2Submit} className="flex flex-col gap-4">
            {/* Avatar Upload (Mandatory) */}
            <div className="flex flex-col items-center mb-1">
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={handleDrop}
                className={`relative w-24 h-24 rounded-full border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden group shadow-inner ${
                  isDragging
                    ? 'border-secondary bg-secondary/15 scale-105 shadow-[0_0_25px_rgba(6,182,212,0.3)]'
                    : avatarPreview
                    ? 'border-primary/50 bg-[#161822]'
                    : 'border-white/20 bg-white/[0.04] hover:border-primary/60 hover:bg-primary/5'
                }`}
              >
                {avatarPreview ? (
                  <div className="relative w-full h-full">
                    <img
                      src={avatarPreview}
                      alt="Avatar Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-crimson text-white flex items-center justify-center transition-colors"
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground group-hover:text-primary transition-colors text-center p-1">
                    <Upload size={18} className="mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold text-white/90">Add Avatar *</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </label>
              <span className="text-[11px] text-muted-foreground mt-1.5 font-medium">
                Avatar is required
              </span>
            </div>

            {/* Display Name */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User size={13} className={focusedField === 'displayName' ? 'text-primary' : 'text-muted-foreground'} />
                Display Name
              </label>
              <div
                className={`rounded-xl border transition-all duration-300 ${
                  focusedField === 'displayName'
                    ? 'border-primary/80 ring-2 ring-primary/20 bg-[#161820]'
                    : 'border-white/[0.08] bg-[#0E1015]/90 hover:border-white/[0.15]'
                }`}
              >
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setError('');
                  }}
                  onFocus={() => setFocusedField('displayName')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. Alex Vance"
                  className="w-full bg-transparent p-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm font-medium rounded-xl"
                />
              </div>
            </div>

            {/* Username */}
            <UsernameInput
              value={username}
              onChange={(val) => {
                setUsername(val);
                setError('');
              }}
              required
              id="auth-register-username"
            />

            {/* Bio */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText size={13} className={focusedField === 'bio' ? 'text-primary' : 'text-muted-foreground'} />
                Bio & Status
              </label>
              <div
                className={`rounded-xl border transition-all duration-300 ${
                  focusedField === 'bio'
                    ? 'border-primary/80 ring-2 ring-primary/20 bg-[#161820]'
                    : 'border-white/[0.08] bg-[#0E1015]/90 hover:border-white/[0.15]'
                }`}
              >
                <textarea
                  required
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value);
                    setError('');
                  }}
                  onFocus={() => setFocusedField('bio')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="What games or topics are you into?"
                  rows={2}
                  className="w-full bg-transparent p-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm font-medium rounded-xl resize-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setRegisterStep(1)}
                className="w-1/3 bg-white/[0.06] hover:bg-white/[0.1] text-foreground font-bold py-4 rounded-xl transition border border-white/[0.08] text-sm"
              >
                Back
              </button>
              <motion.button
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                type="submit"
                disabled={loading}
                className="w-2/3 bg-gradient-to-r from-primary via-indigo-500 to-primary text-white font-bold py-4 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_45px_rgba(99,102,241,0.6)] transition-all duration-300 flex items-center justify-center gap-2 group relative overflow-hidden disabled:opacity-60"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Creating Account...</span>
                  </div>
                ) : (
                  <>
                    <span className="relative z-10 text-sm tracking-wide font-bold">Complete Setup</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform relative z-10" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  </>
                )}
              </motion.button>
            </div>
          </form>
        )}
      </div>

      {/* Footer Mode Switch Link */}
      <div className="mt-6 pt-4 border-t border-white/[0.06] text-xs text-center text-muted-foreground font-medium relative z-10">
        {mode === 'login' ? (
          <p>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => handleModeSwitch('register')}
              className="text-primary hover:text-indigo-300 font-bold hover:underline transition-colors ml-1"
            >
              Sign Up free
            </button>
          </p>
        ) : mode === 'forgot' ? (
          <p>
            Remember your password?{' '}
            <button
              type="button"
              onClick={() => handleModeSwitch('login')}
              className="text-primary hover:text-indigo-300 font-bold hover:underline transition-colors ml-1"
            >
              Sign In
            </button>
          </p>
        ) : (
          <p>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => handleModeSwitch('login')}
              className="text-primary hover:text-indigo-300 font-bold hover:underline transition-colors ml-1"
            >
              Sign In
            </button>
          </p>
        )}
      </div>
    </motion.div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="relative z-10 w-full max-w-md"
        >
          {containerContent}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-clip selection:bg-primary/30 selection:text-white">
      <AnimatedBackground />

      <header className="p-6 relative z-20 flex items-center justify-between max-w-6xl mx-auto w-full">
        <motion.button
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => {
            if (mode === 'register' && registerStep === 2) {
              setRegisterStep(1);
            } else if (window.history.length > 1) {
              window.history.back();
            } else {
              navigate('landing');
            }
          }}
          className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors font-semibold text-sm bg-white/[0.04] border border-white/[0.08] px-4 py-2 rounded-xl backdrop-blur-md"
        >
          <ArrowLeft size={16} /> Back
        </motion.button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative z-20 -mt-6 mb-12">
        {containerContent}
      </main>
    </div>
  );
}
