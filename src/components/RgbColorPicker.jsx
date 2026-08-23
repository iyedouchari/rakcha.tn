import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sliders, Copy, Check, Sparkles, X, Palette, RefreshCw } from 'lucide-react';

// Color conversion helpers
function parseColorToRgb(colorStr) {
  if (!colorStr) return { r: 99, g: 102, b: 241, a: 1 };
  
  // Handle Hex
  if (colorStr.startsWith('#')) {
    let c = colorStr.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (!isNaN(num)) {
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
        a: 1
      };
    }
  }

  // Handle rgb / rgba
  const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d\.]+))?\)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
    };
  }

  // Fallback
  return { r: 99, g: 102, b: 241, a: 1 };
}

function rgbToHex(r, g, b) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToRgb(h, s, l) {
  h = h / 360; s = s / 100; l = l / 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

const PRESET_GRADIENTS = [
  { label: 'Cyber Violet', value: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)' },
  { label: 'Indigo Bloom', value: 'linear-gradient(135deg, #6366F1 0%, #3B82F6 100%)' },
  { label: 'Crimson Ember', value: 'linear-gradient(135deg, #F43F5E 0%, #FB923C 100%)' },
  { label: 'Neon Emerald', value: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)' },
  { label: 'Midnight Ocean', value: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #06B6D4 100%)' },
  { label: 'Solar Gold', value: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #EF4444 100%)' },
  { label: 'Synthwave Neon', value: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 50%, #3B82F6 100%)' },
  { label: 'OLED Noir', value: 'linear-gradient(135deg, #18181B 0%, #09090B 100%)' }
];

export default function RgbColorPicker({ value, onChange, onClose }) {
  const [rgb, setRgb] = useState(() => parseColorToRgb(value));
  const [hexInput, setHexInput] = useState(() => rgbToHex(rgb.r, rgb.g, rgb.b));
  const [activeModel, setActiveModel] = useState('rgb'); // 'rgb' | 'hex' | 'hsl' | 'presets'
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (value && !value.includes('gradient')) {
      const parsed = parseColorToRgb(value);
      setRgb(parsed);
      setHexInput(rgbToHex(parsed.r, parsed.g, parsed.b));
    }
  }, [value]);

  const updateRgb = (newRgb) => {
    const clamped = {
      r: Math.max(0, Math.min(255, Math.round(newRgb.r ?? rgb.r))),
      g: Math.max(0, Math.min(255, Math.round(newRgb.g ?? rgb.g))),
      b: Math.max(0, Math.min(255, Math.round(newRgb.b ?? rgb.b)))
    };
    setRgb(clamped);
    const hex = rgbToHex(clamped.r, clamped.g, clamped.b);
    setHexInput(hex);
    onChange(hex);
  };

  const handleHexChange = (e) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#?[0-9A-Fa-f]{6}$/.test(val)) {
      const parsed = parseColorToRgb(val.startsWith('#') ? val : `#${val}`);
      setRgb(parsed);
      onChange(rgbToHex(parsed.r, parsed.g, parsed.b));
    }
  };

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const handleHueChange = (newHue) => {
    const newRgb = hslToRgb(newHue, hsl.s || 80, hsl.l || 50);
    updateRgb(newRgb);
  };

  const handleCopyCode = () => {
    const str = activeModel === 'rgb' 
      ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` 
      : rgbToHex(rgb.r, rgb.g, rgb.b);
    navigator.clipboard.writeText(str);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentColorHex = rgbToHex(rgb.r, rgb.g, rgb.b);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="bg-[#121318]/95 backdrop-blur-2xl border border-white/[0.12] rounded-3xl p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] max-w-md w-full relative overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
            <Sliders size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">RGB Color Studio</h3>
            <p className="text-[11px] text-muted-foreground font-medium">Precision channel & model tuning</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/[0.08] transition"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Live Color Swatch & Output Box */}
      <div className="flex items-center gap-3.5 mb-5 p-3 rounded-2xl bg-[#0B0E14]/80 border border-white/[0.08]">
        {/* Dynamic Color Tile */}
        <div
          className="w-14 h-14 rounded-xl border border-white/20 shadow-inner shrink-0 relative overflow-hidden transition-colors duration-150"
          style={{ background: value || currentColorHex }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none" />
        </div>

        {/* Color Value Strings & Copy */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono font-bold text-white tracking-wider truncate">
            {value?.includes('gradient') ? 'Custom Gradient' : currentColorHex}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground truncate">
            rgb({rgb.r}, {rgb.g}, {rgb.b})
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyCode}
          className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-muted-foreground hover:text-white transition flex items-center gap-1.5 text-xs font-medium shrink-0"
          title="Copy color code"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Model Mode Navigation Pills */}
      <div className="flex items-center gap-1.5 p-1 bg-[#0B0E14] rounded-xl border border-white/[0.06] mb-5">
        {[
          { id: 'rgb', label: 'RGB Channels' },
          { id: 'hsl', label: 'Hue & Spectrum' },
          { id: 'presets', label: 'Presets & Gradients' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveModel(tab.id)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              activeModel === tab.id
                ? 'bg-primary text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                : 'text-muted-foreground hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Model 1: RGB Sliders ────────────────────────────────────── */}
      {activeModel === 'rgb' && (
        <div className="space-y-4">
          {/* Red Channel */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-red-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Red (R)
              </span>
              <input
                type="number"
                min="0"
                max="255"
                value={rgb.r}
                onChange={(e) => updateRgb({ r: parseInt(e.target.value || '0', 10) })}
                className="w-14 bg-[#0B0E14] border border-white/[0.1] rounded-lg px-2 py-0.5 text-right font-mono text-xs font-bold text-white focus:outline-none focus:border-red-400"
              />
            </div>
            <input
              type="range"
              min="0"
              max="255"
              value={rgb.r}
              onChange={(e) => updateRgb({ r: parseInt(e.target.value, 10) })}
              style={{
                background: `linear-gradient(to right, rgb(0, ${rgb.g}, ${rgb.b}), rgb(255, ${rgb.g}, ${rgb.b}))`
              }}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer border border-white/10 shadow-inner"
            />
          </div>

          {/* Green Channel */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Green (G)
              </span>
              <input
                type="number"
                min="0"
                max="255"
                value={rgb.g}
                onChange={(e) => updateRgb({ g: parseInt(e.target.value || '0', 10) })}
                className="w-14 bg-[#0B0E14] border border-white/[0.1] rounded-lg px-2 py-0.5 text-right font-mono text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
            <input
              type="range"
              min="0"
              max="255"
              value={rgb.g}
              onChange={(e) => updateRgb({ g: parseInt(e.target.value, 10) })}
              style={{
                background: `linear-gradient(to right, rgb(${rgb.r}, 0, ${rgb.b}), rgb(${rgb.r}, 255, ${rgb.b}))`
              }}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer border border-white/10 shadow-inner"
            />
          </div>

          {/* Blue Channel */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-blue-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Blue (B)
              </span>
              <input
                type="number"
                min="0"
                max="255"
                value={rgb.b}
                onChange={(e) => updateRgb({ b: parseInt(e.target.value || '0', 10) })}
                className="w-14 bg-[#0B0E14] border border-white/[0.1] rounded-lg px-2 py-0.5 text-right font-mono text-xs font-bold text-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <input
              type="range"
              min="0"
              max="255"
              value={rgb.b}
              onChange={(e) => updateRgb({ b: parseInt(e.target.value, 10) })}
              style={{
                background: `linear-gradient(to right, rgb(${rgb.r}, ${rgb.g}, 0), rgb(${rgb.r}, ${rgb.g}, 255))`
              }}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer border border-white/10 shadow-inner"
            />
          </div>

          {/* Hex Input Direct */}
          <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">HEX Code:</span>
            <div className="flex items-center gap-1 bg-[#0B0E14] border border-white/[0.1] rounded-xl px-3 py-1.5 font-mono text-xs font-bold text-white">
              <span>#</span>
              <input
                type="text"
                value={hexInput.replace('#', '')}
                onChange={handleHexChange}
                placeholder="RRGGBB"
                maxLength={6}
                className="bg-transparent uppercase focus:outline-none w-20"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Model 2: Hue & Spectrum Slider ──────────────────────────── */}
      {activeModel === 'hsl' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className="text-white">Rainbow Hue Spectrum</span>
              <span className="text-muted-foreground font-mono">{hsl.h}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={hsl.h}
              onChange={(e) => handleHueChange(parseInt(e.target.value, 10))}
              style={{
                background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
              }}
              className="w-full h-4 rounded-xl appearance-none cursor-pointer border border-white/20 shadow-inner"
            />
          </div>

          {/* Lightness Quick Bar */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className="text-white">Brightness / Tone</span>
              <span className="text-muted-foreground font-mono">{hsl.l}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              value={hsl.l}
              onChange={(e) => {
                const newRgb = hslToRgb(hsl.h, hsl.s || 80, parseInt(e.target.value, 10));
                updateRgb(newRgb);
              }}
              style={{
                background: `linear-gradient(to right, #000 0%, hsl(${hsl.h}, 100%, 50%) 50%, #fff 100%)`
              }}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer border border-white/10 shadow-inner"
            />
          </div>
        </div>
      )}

      {/* ── Model 3: Presets & Gradients ────────────────────────────── */}
      {activeModel === 'presets' && (
        <div className="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
          {PRESET_GRADIENTS.map((p) => {
            const isSelected = value === p.value;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.value)}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/40 bg-white/[0.08]'
                    : 'border-white/[0.08] hover:border-white/[0.2] bg-white/[0.02]'
                }`}
              >
                <div
                  className="w-6 h-6 rounded-lg shrink-0 shadow border border-white/20"
                  style={{ background: p.value }}
                />
                <span className="text-xs font-semibold text-white truncate">{p.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
