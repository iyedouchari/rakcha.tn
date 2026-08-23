import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRakchaStore } from '../store/useRakchaStore';
import { Upload, ArrowRight, ArrowLeft, User, AtSign, FileText, Loader2, Sparkles, X, Check } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function CreateProfile() {
  const { navigate, updateProfile, showToast } = useRakchaStore();
  const currentUser = useRakchaStore((s) => s.currentUser);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleAvatarChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
      } else {
        showToast('Please upload a valid image file (PNG, JPG, WebP).', 'error');
      }
    }
  };

  const handleRemoveAvatar = (e) => {
    e.stopPropagation();
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!avatarFile) {
      showToast('Error: Please upload an avatar image before continuing.', 'error');
      return;
    }
    if (name.trim() && username.trim()) {
      const cleanUsername = username.trim().replace(/^@+/, '');
      if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        showToast(
          'Username must be 3-20 characters long and contain only lowercase letters, numbers, and underscores.',
          'error'
        );
        return;
      }
      try {
        setLoading(true);
        await updateProfile({
          displayName: name.trim(),
          username: cleanUsername,
          customStatus: bio.trim(),
          avatarFile: avatarFile
        });
        navigate('app');
      } catch (err) {
        showToast('Failed to update profile: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-clip selection:bg-primary/30 selection:text-white">
      <AnimatedBackground />

      <header className="p-6 relative z-20 flex items-center justify-between max-w-6xl mx-auto w-full">
        <motion.button
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => navigate(currentUser ? 'app' : 'landing')}
          className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors font-semibold text-sm bg-white/[0.04] border border-white/[0.08] px-4 py-2 rounded-xl backdrop-blur-md"
        >
          <ArrowLeft size={16} /> Back
        </motion.button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative z-20 -mt-8 mb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg bg-[#121318]/85 backdrop-blur-2xl p-8 md:p-12 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] border border-white/[0.09] glow-border relative overflow-hidden"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold font-mono uppercase tracking-wider mb-3">
              <Sparkles size={13} /> Step 2: Identity
            </div>
            <h2 className="text-3xl font-heading font-black tracking-tight text-white mb-2">
              Setup your profile
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              How should squad members recognize you across stages & chats?
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Interactive Drag & Drop Avatar Upload */}
            <div className="flex flex-col items-center mb-2">
              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative w-32 h-32 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden group shadow-inner ${
                  isDragging
                    ? 'border-secondary bg-secondary/15 scale-105 shadow-[0_0_30px_rgba(6,182,212,0.3)]'
                    : avatarPreview
                    ? 'border-primary/50 bg-[#161822]'
                    : 'border-white/15 bg-white/[0.03] hover:border-primary/60 hover:bg-primary/5'
                }`}
              >
                <AnimatePresence mode="wait">
                  {avatarPreview ? (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative w-full h-full"
                    >
                      <img
                        src={avatarPreview}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold gap-1">
                        <Upload size={18} />
                        <span>Change</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-crimson text-white flex items-center justify-center transition-colors"
                        title="Remove avatar"
                      >
                        <X size={13} />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center text-muted-foreground group-hover:text-primary transition-colors p-2 text-center"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-white/[0.05] group-hover:bg-primary/20 flex items-center justify-center mb-2 transition-colors">
                        <Upload size={20} className="group-hover:scale-110 transition-transform" />
                      </div>
                      <span className="text-[11px] font-bold tracking-wide text-white/90">
                        {isDragging ? 'Drop Image Here' : 'Upload Avatar'}
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">
                        Required • PNG/JPG
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </label>
            </div>

            {/* Display Name Field */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User size={13} className={focusedField === 'name' ? 'text-primary' : 'text-muted-foreground'} />
                Display Name
              </label>
              <div
                className={`rounded-xl border transition-all duration-300 ${
                  focusedField === 'name'
                    ? 'border-primary/80 ring-2 ring-primary/20 bg-[#161820]'
                    : 'border-white/[0.08] bg-[#0E1015]/90 hover:border-white/[0.15]'
                }`}
              >
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  type="text"
                  placeholder="e.g. Alex Vance"
                  className="w-full bg-transparent p-3.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm font-medium rounded-xl"
                />
              </div>
            </div>

            {/* Username Field */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <AtSign size={13} className={focusedField === 'username' ? 'text-primary' : 'text-muted-foreground'} />
                Username Handle
              </label>
              <div
                className={`relative rounded-xl border transition-all duration-300 flex items-center ${
                  focusedField === 'username'
                    ? 'border-primary/80 ring-2 ring-primary/20 bg-[#161820]'
                    : 'border-white/[0.08] bg-[#0E1015]/90 hover:border-white/[0.15]'
                }`}
              >
                <span className="pl-3.5 text-muted-foreground font-mono text-sm font-bold select-none">
                  @
                </span>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  type="text"
                  placeholder="alex_vance"
                  className="w-full bg-transparent p-3.5 pl-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm font-mono font-medium rounded-xl"
                />
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-1 font-mono">
                3-20 characters: lowercase letters, numbers, and underscores.
              </p>
            </div>

            {/* Bio Field */}
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
                  onChange={(e) => setBio(e.target.value)}
                  onFocus={() => setFocusedField('bio')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="What games or topics are you into?"
                  rows={2}
                  className="w-full bg-transparent p-3.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-sm font-medium rounded-xl resize-none"
                />
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-primary via-indigo-500 to-secondary text-white font-bold py-4 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_45px_rgba(99,102,241,0.6)] transition-all duration-300 flex items-center justify-center gap-2 group relative overflow-hidden disabled:opacity-60"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span>Saving Profile...</span>
                </div>
              ) : (
                <>
                  <span className="relative z-10 text-sm tracking-wide font-bold">
                    Complete Setup & Enter Rakcha
                  </span>
                  <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform relative z-10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
