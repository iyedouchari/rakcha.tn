import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRakchaStore, DEFAULT_SETTINGS } from '../store/useRakchaStore';
import RgbColorPicker from '../components/RgbColorPicker';
import {
  ArrowLeft,
  User,
  Palette,
  Mic,
  MicOff,
  Volume2,
  Video,
  Shield,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Trash2,
  Sparkles,
  Camera,
  Sliders,
  Radio,
  Eye,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DEFAULT_AVATAR, normalizeUsername } from '../lib/utils';

const BANNER_PRESETS = [
  { id: 'indigo', label: 'Indigo Core', value: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)', color: '#6366F1' },
  { id: 'violet', label: 'Cyber Violet', value: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', color: '#8B5CF6' },
  { id: 'crimson', label: 'Crimson Ember', value: 'linear-gradient(135deg, #F43F5E 0%, #FB923C 100%)', color: '#F43F5E' },
  { id: 'emerald', label: 'Emerald Jade', value: 'linear-gradient(135deg, #10B981 0%, #064E3B 100%)', color: '#10B981' },
  { id: 'ocean', label: 'Midnight Ocean', value: 'linear-gradient(135deg, #0EA5E9 0%, #1E1B4B 100%)', color: '#0EA5E9' },
  { id: 'amber', label: 'Solar Gold', value: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)', color: '#F59E0B' },
  { id: 'noir', label: 'OLED Noir', value: 'linear-gradient(135deg, #27272A 0%, #09090B 100%)', color: '#27272A' },
  { id: 'synth', label: 'Synthwave', value: 'linear-gradient(135deg, #06B6D4 0%, #7C3AED 50%, #F43F5E 100%)', color: '#06B6D4' }
];

export default function Settings() {
  const {
    currentUser,
    updateProfile,
    navigate,
    showToast,
    settings,
    updateSettings,
    blockedUsers,
    fetchBlockedUsers,
    unblockUser,
    clearLocalMediaCache
  } = useRakchaStore();

  const [activeTab, setActiveTab] = useState('account'); // 'account' | 'appearance' | 'voice-video' | 'privacy'

  // ── Account State ──────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    bio: '',
    bannerColor: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)'
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRgbStudio, setShowRgbStudio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.display_name || '',
        username: currentUser.username || '',
        bio: currentUser.custom_status || '',
        bannerColor: currentUser.banner_color || 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)'
      });
    }
  }, [currentUser]);

  // ── Voice & Video Hardware Enumeration & Testing ───────────────────────────
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [micTesting, setMicTesting] = useState(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState(0); // 0 to 100
  const [cameraActive, setCameraActive] = useState(false);

  const videoPreviewRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const cameraStreamRef = useRef(null);

  // Enumerate hardware devices
  const enumerateHardware = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputDevices(devices.filter(d => d.kind === 'audioinput'));
      setAudioOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
    } catch (e) {
      console.warn('Could not enumerate hardware devices', e);
    }
  };

  useEffect(() => {
    enumerateHardware();
    fetchBlockedUsers();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showConfirmModal) {
          setShowConfirmModal(false);
        } else {
          navigate('app');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      stopMicTest();
      stopCameraPreview();
    };
  }, [showConfirmModal, navigate]);

  // ── Real Web Audio Mic Tester ──────────────────────────────────────────────
  const startMicTest = async () => {
    try {
      const constraints = {
        audio: {
          deviceId: settings.selectedAudioInputId ? { exact: settings.selectedAudioInputId } : undefined,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = (settings.micGain || 100) / 100;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      source.connect(gainNode);
      gainNode.connect(analyser);

      // Loopback to output with master volume
      const loopGain = audioCtx.createGain();
      loopGain.gain.value = (settings.masterVolume || 100) / 100;
      gainNode.connect(loopGain);
      loopGain.connect(audioCtx.destination);

      setMicTesting(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        // Normalize to 0-100 level
        const level = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolumeLevel(level);
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      showToast('Could not access microphone: ' + err.message, 'error');
      setMicTesting(false);
    }
  };

  const stopMicTest = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setMicTesting(false);
    setMicVolumeLevel(0);
  };

  // ── Instant Audio Chime Output Tester ──────────────────────────────────────
  const playTestChime = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const masterVol = (settings.masterVolume || 100) / 100;

      const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const now = audioCtx.currentTime;

      chord.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        gain.gain.setValueAtTime(0, now + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.18 * masterVol, now + index * 0.08 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.8);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.85);
      });

      showToast('Playing audio test chime', 'info');
    } catch (err) {
      showToast('Audio test error: ' + err.message, 'error');
    }
  };

  // ── Camera Preview ─────────────────────────────────────────────────────────
  const startCameraPreview = async () => {
    try {
      stopCameraPreview();
      const constraints = {
        video: {
          deviceId: settings.selectedVideoInputId ? { exact: settings.selectedVideoInputId } : undefined,
          width: settings.videoResolution === '1080p' ? 1920 : settings.videoResolution === '480p' ? 640 : 1280,
          height: settings.videoResolution === '1080p' ? 1080 : settings.videoResolution === '480p' ? 480 : 720,
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      showToast('Could not start camera preview: ' + err.message, 'error');
      setCameraActive(false);
    }
  };

  const stopCameraPreview = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // ── Account Save Logic ─────────────────────────────────────────────────────
  const hasChanges =
    formData.name !== (currentUser?.display_name || '') ||
    formData.username !== (currentUser?.username || '') ||
    formData.bio !== (currentUser?.custom_status || '') ||
    formData.bannerColor !== (currentUser?.banner_color || 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)');

  const handleCancel = () => {
    setFormData({
      name: currentUser?.display_name || '',
      username: currentUser?.username || '',
      bio: currentUser?.custom_status || '',
      bannerColor: currentUser?.banner_color || 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)'
    });
    setShowConfirmModal(false);
    showToast('Changes discarded.', 'info');
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!hasChanges) return;

    const rawUsername = formData.username;
    if (rawUsername) {
      const cleanUsername = rawUsername.trim().replace(/^@+/, '');
      if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        showToast('Username must be 3-20 chars (lowercase letters, numbers, underscores).', 'error');
        return;
      }
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    const rawUsername = formData.username;
    let cleanUsername = undefined;
    if (rawUsername) {
      cleanUsername = rawUsername.trim().replace(/^@+/, '');
      if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        showToast('Username must be 3-20 chars (lowercase letters, numbers, underscores).', 'error');
        setShowConfirmModal(false);
        return;
      }
    }

    try {
      setIsSaving(true);
      await updateProfile({
        displayName: formData.name,
        username: cleanUsername,
        customStatus: formData.bio,
        bannerColor: formData.bannerColor
      });
      setShowConfirmModal(false);
      showToast('Settings saved successfully!', 'success');
    } catch (err) {
      showToast('Error saving settings: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, file);
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await updateProfile({ avatarUrl: publicUrlData.publicUrl });
      showToast('Avatar updated successfully!', 'success');
    } catch (err) {
      showToast('Error updating avatar: ' + err.message, 'error');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-[280px] bg-surface-container-low shrink-0 border-r border-outline-variant/10 flex flex-col h-full">
        <header className="p-6 pb-2">
          <button
            onClick={() => navigate('app')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition font-medium mb-8 text-sm"
          >
            <ArrowLeft size={18} /> Back to App
          </button>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">User Settings</h2>
        </header>

        <nav className="flex-1 px-4 flex flex-col gap-1 overflow-y-auto">
          {[
            { id: 'account', label: 'My Account', icon: User },
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'voice-video', label: 'Voice & Video', icon: Mic },
            { id: 'privacy', label: 'Privacy & Safety', icon: Shield }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'voice-video') {
                    stopMicTest();
                    stopCameraPreview();
                  }
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition ${
                  isActive
                    ? 'bg-surface-container-highest font-bold text-foreground'
                    : 'text-muted-foreground hover:bg-surface-container hover:text-foreground font-medium'
                }`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Settings Content */}
      <main className="flex-1 overflow-y-auto p-8 md:p-12 relative bg-surface">
        <div className="max-w-3xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-heading font-bold text-foreground">
              {activeTab === 'account' && 'My Account'}
              {activeTab === 'appearance' && 'Appearance'}
              {activeTab === 'voice-video' && 'Voice & Video'}
              {activeTab === 'privacy' && 'Privacy & Safety'}
            </h1>
            <button
              type="button"
              onClick={() => navigate('app')}
              className="flex flex-col items-center justify-center p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-container-high transition"
              title="Close Settings (ESC)"
            >
              <X size={20} />
              <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">ESC</span>
            </button>
          </div>

          {/* ── Tab 1: My Account ────────────────────────────────────────────── */}
          {activeTab === 'account' && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              {/* Profile Banner & Avatar Card */}
              <div className="bg-surface-container rounded-2xl border border-outline-variant/20 overflow-hidden mb-8 shadow-sm">
                {/* Banner with customizable background */}
                <div
                  className="h-36 w-full relative transition-all duration-300"
                  style={{ background: formData.bannerColor }}
                />

                <div className="px-8 pb-8 relative">
                  <div className="absolute -top-12 left-8 rounded-full border-8 border-surface-container bg-surface-container shadow-md group">
                    <img
                      src={currentUser?.avatar_url || DEFAULT_AVATAR}
                      className="w-24 h-24 rounded-full object-cover"
                      alt="Avatar"
                    />
                    <label className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition text-white">
                      <Camera size={20} />
                      <input type="file" accept="image/*" onChange={handleChangeAvatar} className="hidden" />
                    </label>
                  </div>
                  <div className="pt-16 flex justify-between items-start flex-wrap gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{currentUser?.display_name || 'User'}</h2>
                      <p className="text-muted-foreground font-medium font-mono text-sm">@{normalizeUsername(currentUser?.username)}</p>
                    </div>
                    <label className="bg-primary hover:bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium transition cursor-pointer text-sm shadow">
                      Change Avatar
                      <input type="file" accept="image/*" onChange={handleChangeAvatar} className="hidden" />
                    </label>
                  </div>

                  {/* Banner Background Theme Presets */}
                  <div className="mt-6 pt-6 border-t border-outline-variant/15">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Banner Background Theme</span>
                      <button
                        type="button"
                        onClick={() => setShowRgbStudio(true)}
                        className="text-xs text-primary font-bold flex items-center gap-1.5 hover:underline cursor-pointer bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 hover:bg-primary/20 transition"
                      >
                        <Sliders size={13} />
                        <span>RGB Color Studio</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {BANNER_PRESETS.map(preset => {
                        const isSelected = formData.bannerColor === preset.value;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, bannerColor: preset.value })}
                            className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                              isSelected
                                ? 'border-primary ring-2 ring-primary/40 bg-surface-container-highest shadow-sm'
                                : 'border-outline-variant/20 hover:border-outline-variant/50 bg-surface-container-lowest'
                            }`}
                          >
                            <div className="w-5 h-5 rounded-full shrink-0 shadow-inner border border-white/20" style={{ background: preset.value }} />
                            <span className="text-xs font-semibold truncate text-foreground">{preset.label}</span>
                            {isSelected && <Check size={13} className="text-primary ml-auto shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Details */}
              <form onSubmit={handleFormSubmit} className="bg-surface-container rounded-2xl border border-outline-variant/20 p-8 flex flex-col gap-6">
                <h3 className="text-lg font-bold text-foreground">Profile Details</h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Display Name</label>
                    <input
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                      placeholder="Display Name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Username</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-muted-foreground font-mono font-bold">@</span>
                      <input
                        value={formData.username}
                        onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                        className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 pl-8 text-foreground font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                        placeholder="username"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                    rows="4"
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition resize-none"
                    placeholder="Write something about yourself..."
                  />
                  <p className="text-xs text-muted-foreground mt-2">Any details such as age, occupation or city.</p>
                </div>

                <div className="pt-4 border-t border-outline-variant/10 flex justify-end">
                  <button
                    type="submit"
                    disabled={!hasChanges || isSaving}
                    className="bg-primary hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-primary/20 flex items-center gap-2"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ── Tab 2: Appearance ────────────────────────────────────────────── */}
          {activeTab === 'appearance' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">Appearance</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Customize theme palettes, accent colors, and chat layout</p>
              </div>

              {/* Theme Modes */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-3">Theme Presets</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'dark-slate', label: 'Dark Slate', desc: 'Deep subtle charcoal', bg: '#0B0E14', border: '#1E293B' },
                    { id: 'oled-black', label: 'OLED Pure Black', desc: '100% true pitch black', bg: '#000000', border: '#18181B' },
                    { id: 'midnight-purple', label: 'Midnight Purple', desc: 'Rich indigo amethyst', bg: '#0D0B18', border: '#2D1F4F' }
                  ].map(t => {
                    const isSelected = settings.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updateSettings({ theme: t.id })}
                        className={`p-4 rounded-2xl text-left border transition-all relative overflow-hidden flex flex-col justify-between h-28 ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/30 shadow-[0_0_20px_var(--color-primary-glow)] scale-[1.02]'
                            : 'border-white/[0.08] hover:border-white/20'
                        }`}
                        style={{ backgroundColor: t.bg }}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-sm text-white">{t.label}</span>
                          {isSelected && <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white"><Check size={12} /></div>}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent Colors */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-3">Accent Color Presets</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'indigo', label: 'Indigo', color: '#6366F1' },
                    { id: 'crimson', label: 'Crimson', color: '#F43F5E' },
                    { id: 'emerald', label: 'Emerald', color: '#10B981' },
                    { id: 'violet', label: 'Cyberpunk Violet', color: '#A855F7' }
                  ].map(c => {
                    const isSelected = settings.accentColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => updateSettings({ accentColor: c.id })}
                        className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all ${
                          isSelected
                            ? 'border-white bg-white/[0.08] ring-2 ring-white/20'
                            : 'border-white/[0.08] hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full shrink-0 shadow" style={{ backgroundColor: c.color }} />
                        <span className="font-bold text-xs text-foreground truncate">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chat Density */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-3">Chat Density</label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  {[
                    { id: 'cozy', label: 'Cozy', desc: 'Spacious padding & larger avatars' },
                    { id: 'compact', label: 'Compact', desc: 'Condensed feed & more messages' }
                  ].map(d => {
                    const isSelected = settings.chatDensity === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => updateSettings({ chatDensity: d.id })}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                            : 'border-white/[0.08] bg-surface-container-high/40 hover:bg-surface-container-high'
                        }`}
                      >
                        <span className="font-bold text-sm block mb-1">{d.label}</span>
                        <span className="text-[11px] text-muted-foreground">{d.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Size Scaling Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Font Scaling</label>
                  <span className="text-xs font-mono font-bold text-primary">{settings.fontSize || 15}px</span>
                </div>
                <input
                  type="range"
                  min="13"
                  max="18"
                  step="1"
                  value={settings.fontSize || 15}
                  onChange={e => updateSettings({ fontSize: Number(e.target.value) })}
                  className="w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="mt-3 p-3.5 rounded-xl bg-surface-container-high/60 border border-white/[0.06] text-muted-foreground" style={{ fontSize: `${settings.fontSize || 15}px` }}>
                  Sample message preview: <span className="text-foreground font-semibold">"Hey squad, jumping on voice in 5 mins! 🎮"</span>
                </div>
              </div>

              {/* Reduced Motion Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-high/40 border border-white/[0.06]">
                <div>
                  <span className="font-bold text-sm block">Reduced Motion</span>
                  <span className="text-xs text-muted-foreground">Disables ambient canvas drift and background animations</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    settings.reducedMotion ? 'bg-primary' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.reducedMotion ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Tab 3: Voice & Video ─────────────────────────────────────────── */}
          {activeTab === 'voice-video' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">Voice & Video</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configure hardware devices, audio levels, and WebRTC streaming</p>
              </div>

              {/* Audio Input (Microphone) */}
              <div className="space-y-4 p-5 rounded-2xl bg-surface-container-high/50 border border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Mic size={18} className="text-primary" />
                  <h3 className="font-bold text-sm text-foreground">Audio Input (Microphone)</h3>
                </div>

                <select
                  value={settings.selectedAudioInputId || ''}
                  onChange={e => updateSettings({ selectedAudioInputId: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-white/[0.1] rounded-xl p-3 text-sm focus:outline-none focus:border-primary font-medium"
                >
                  <option value="">Default Microphone</option>
                  {audioInputDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </select>

                {/* Input Gain Slider */}
                <div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground mb-1 font-semibold">
                    <span>Input Sensitivity Gain</span>
                    <span>{settings.micGain ?? 100}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.micGain ?? 100}
                    onChange={e => updateSettings({ micGain: Number(e.target.value) })}
                    className="w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Real-time Decibel Level Meter */}
                <div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground mb-1.5 font-semibold">
                    <span>Input Volume Level Meter</span>
                    <span className="font-mono text-[11px]">{micVolumeLevel}%</span>
                  </div>
                  <div className="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-white/[0.08] flex items-center">
                    <div
                      className="h-full rounded-full transition-all duration-75"
                      style={{
                        width: `${micVolumeLevel}%`,
                        backgroundColor: micVolumeLevel > 85 ? '#EF4444' : micVolumeLevel > 65 ? '#F59E0B' : 'var(--color-primary, #10B981)'
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={micTesting ? stopMicTest : startMicTest}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                      micTesting
                        ? 'bg-crimson text-white shadow-lg shadow-crimson/30 animate-pulse'
                        : 'bg-primary text-white hover:opacity-90 shadow-md shadow-primary/20'
                    }`}
                  >
                    {micTesting ? <MicOff size={14} /> : <Mic size={14} />}
                    {micTesting ? 'Stop Mic Test' : 'Test Microphone'}
                  </button>
                </div>
              </div>

              {/* Audio Output (Speakers / Headphones) */}
              <div className="space-y-4 p-5 rounded-2xl bg-surface-container-high/50 border border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Volume2 size={18} className="text-primary" />
                  <h3 className="font-bold text-sm text-foreground">Audio Output (Speakers / Headphones)</h3>
                </div>

                <select
                  value={settings.selectedAudioOutputId || ''}
                  onChange={e => updateSettings({ selectedAudioOutputId: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-white/[0.1] rounded-xl p-3 text-sm focus:outline-none focus:border-primary font-medium"
                >
                  <option value="">Default Audio Output</option>
                  {audioOutputDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Speaker / Headphone ${i + 1}`}
                    </option>
                  ))}
                </select>

                <div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground mb-1 font-semibold">
                    <span>Master Voice & Call Volume</span>
                    <span>{settings.masterVolume ?? 100}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.masterVolume ?? 100}
                    onChange={e => updateSettings({ masterVolume: Number(e.target.value) })}
                    className="w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                <button
                  type="button"
                  onClick={playTestChime}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white/[0.08] hover:bg-white/[0.14] text-foreground border border-white/[0.1] flex items-center gap-2 transition"
                >
                  <Volume2 size={14} /> Test Audio Output
                </button>
              </div>

              {/* Voice Processing Toggles */}
              <div className="space-y-3 p-5 rounded-2xl bg-surface-container-high/50 border border-white/[0.06]">
                <h3 className="font-bold text-sm text-foreground mb-1">Voice Audio Processing</h3>
                {[
                  { key: 'echoCancellation', label: 'Echo Cancellation', desc: 'Prevents feedback and room echo from audio output' },
                  { key: 'noiseSuppression', label: 'Noise Suppression', desc: 'Filters out background fans, keystrokes, and hiss' },
                  { key: 'autoGainControl', label: 'Automatic Gain Control (AGC)', desc: 'Balances microphone volume dynamically' }
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between py-1.5">
                    <div>
                      <span className="font-bold text-xs text-foreground block">{item.label}</span>
                      <span className="text-[11px] text-muted-foreground">{item.desc}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSettings({ [item.key]: !settings[item.key] })}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                        settings[item.key] ? 'bg-primary' : 'bg-white/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          settings[item.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {/* Video & Camera Setup */}
              <div className="space-y-4 p-5 rounded-2xl bg-surface-container-high/50 border border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Video size={18} className="text-primary" />
                  <h3 className="font-bold text-sm text-foreground">Video & Camera</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Camera Device</label>
                    <select
                      value={settings.selectedVideoInputId || ''}
                      onChange={e => {
                        updateSettings({ selectedVideoInputId: e.target.value });
                        if (cameraActive) startCameraPreview();
                      }}
                      className="w-full bg-surface-container-lowest border border-white/[0.1] rounded-xl p-3 text-sm focus:outline-none focus:border-primary font-medium"
                    >
                      <option value="">Default Camera</option>
                      {videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Quality Resolution</label>
                    <select
                      value={settings.videoResolution || '720p'}
                      onChange={e => {
                        updateSettings({ videoResolution: e.target.value });
                        if (cameraActive) startCameraPreview();
                      }}
                      className="w-full bg-surface-container-lowest border border-white/[0.1] rounded-xl p-3 text-sm focus:outline-none focus:border-primary font-medium"
                    >
                      <option value="720p">720p (HD 30fps)</option>
                      <option value="1080p">1080p (FHD 60fps)</option>
                      <option value="480p">480p (Bandwidth Saver)</option>
                    </select>
                  </div>
                </div>

                {/* Live Video Mirror Preview */}
                <div className="mt-3">
                  <div className="aspect-video bg-surface-container-lowest rounded-2xl overflow-hidden relative border border-white/[0.08] flex items-center justify-center">
                    <video
                      ref={videoPreviewRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover scale-x-[-1] ${cameraActive ? 'block' : 'hidden'}`}
                    />
                    {!cameraActive && (
                      <div className="text-center p-4">
                        <Video size={36} className="text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Camera preview is inactive</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={cameraActive ? stopCameraPreview : startCameraPreview}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs bg-primary hover:opacity-90 text-white shadow-md shadow-primary/20 transition flex items-center gap-2"
                  >
                    <Camera size={14} />
                    {cameraActive ? 'Stop Camera Preview' : 'Test Video Camera'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Tab 4: Privacy & Safety ──────────────────────────────────────── */}
          {activeTab === 'privacy' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">Privacy & Safety</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Control direct messaging permissions, receipts, and blocked accounts</p>
              </div>

              {/* Direct Messaging Permissions */}
              <div className="space-y-3 p-5 rounded-2xl bg-surface-container-high/50 border border-white/[0.06]">
                <h3 className="font-bold text-sm text-foreground">Direct Messaging Scope</h3>
                <div className="space-y-2">
                  {[
                    { id: 'all', label: 'Allow DMs from mutual group members', desc: 'Anyone in a shared squad can message you' },
                    { id: 'friends_only', label: 'Only confirmed friends', desc: 'Direct messages restricted strictly to accepted friends' }
                  ].map(opt => {
                    const isSelected = (settings.dmScope || 'all') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateSettings({ dmScope: opt.id })}
                        className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 transition ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'border-white/[0.06] hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <span className="font-bold text-xs text-foreground block">{opt.label}</span>
                          <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Presence & Receipts */}
              <div className="space-y-3 p-5 rounded-2xl bg-surface-container-high/50 border border-white/[0.06]">
                <h3 className="font-bold text-sm text-foreground">Presence & Receipts</h3>
                {[
                  { key: 'showCallPresence', label: 'Display Active Call Presence', desc: 'Shows green indicator when in an active voice room' },
                  { key: 'showTypingIndicators', label: 'Typing Indicators', desc: 'Displays live typing bubble to conversation partners' },
                  { key: 'showVoiceReceipts', label: 'Voice Note Listened Receipts', desc: 'Marks voice messages as listened for senders' }
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between py-1.5">
                    <div>
                      <span className="font-bold text-xs text-foreground block">{item.label}</span>
                      <span className="text-[11px] text-muted-foreground">{item.desc}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSettings({ [item.key]: !settings[item.key] })}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                        settings[item.key] ? 'bg-primary' : 'bg-white/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          settings[item.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {/* Blocked Users Manager */}
              <div className="space-y-4 p-5 rounded-2xl bg-surface-container-high/50 border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={18} className="text-crimson" />
                    <h3 className="font-bold text-sm text-foreground">Blocked Users ({blockedUsers.length})</h3>
                  </div>
                  <button
                    type="button"
                    onClick={fetchBlockedUsers}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                    title="Refresh"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Blocked accounts cannot call or message you, and are masked as 'Rakcha User' in mutual groups.
                </p>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {blockedUsers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground bg-surface-container-lowest/50 rounded-xl border border-white/[0.04]">
                      No blocked users.
                    </div>
                  ) : (
                    blockedUsers.map(b => {
                      const prof = b.profile || {};
                      return (
                        <div
                          key={b.id || b.blocked_id}
                          className="flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest border border-white/[0.06]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={prof.avatar_url || DEFAULT_AVATAR}
                              alt={prof.display_name}
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-foreground block truncate">
                                {prof.display_name || 'Rakcha User'}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono truncate block">
                                @{normalizeUsername(prof.username)} • Blocked {new Date(b.created_at || Date.now()).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => unblockUser(b.blocked_id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/[0.08] hover:bg-crimson hover:text-white text-muted-foreground transition shrink-0 ml-2"
                          >
                            Unblock
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Storage & Local Cache */}
              <div className="p-5 rounded-2xl bg-surface-container-high/50 border border-white/[0.06] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <HardDrive size={16} className="text-primary" />
                    <span className="font-bold text-xs text-foreground">Local Cache & Audio Storage</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Purge cached voice note audio waveforms and temporary session storage</span>
                </div>
                <button
                  type="button"
                  onClick={clearLocalMediaCache}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/[0.08] hover:bg-white/[0.14] text-foreground border border-white/[0.08] transition shrink-0"
                >
                  Clear Local Cache
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Confirmation Modal for Profile Changes */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-surface-container-high border border-white/[0.1] p-6 rounded-3xl max-w-sm w-full shadow-2xl relative z-10"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-center mb-2">Confirm Profile Changes</h3>
              <p className="text-muted-foreground text-xs text-center mb-6 leading-relaxed">
                Are you sure you want to update your profile details? If you confirm, your new settings will be saved.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-foreground font-bold text-xs border border-white/[0.08] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white font-bold text-xs shadow-lg shadow-primary/30 transition flex items-center justify-center gap-1.5"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* RGB Color Studio Modal */}
        {showRgbStudio && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRgbStudio(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />
            <div className="relative z-10 w-full max-w-md">
              <RgbColorPicker
                value={formData.bannerColor}
                onChange={(color) => setFormData({ ...formData, bannerColor: color })}
                onClose={() => setShowRgbStudio(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
