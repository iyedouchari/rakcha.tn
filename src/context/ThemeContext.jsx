import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useRakchaStore, DEFAULT_SETTINGS } from '../store/useRakchaStore';
import { supabase } from '../lib/supabase';

export const ACCENT_PRESETS = {
  indigo: {
    id: 'indigo',
    label: 'Indigo',
    color: '#6366F1',
    hover: '#4F46E5',
    glow: 'rgba(99, 102, 241, 0.35)',
  },
  crimson: {
    id: 'crimson',
    label: 'Crimson',
    color: '#F43F5E',
    hover: '#E11D48',
    glow: 'rgba(244, 63, 94, 0.35)',
  },
  emerald: {
    id: 'emerald',
    label: 'Emerald',
    color: '#10B981',
    hover: '#059669',
    glow: 'rgba(16, 185, 129, 0.35)',
  },
  violet: {
    id: 'violet',
    label: 'Cyberpunk Violet',
    color: '#A855F7',
    hover: '#9333EA',
    glow: 'rgba(168, 85, 247, 0.35)',
  },
};

/**
 * Helper to dynamically convert hex to rgba with alpha
 */
function hexToRgba(hex, alpha = 0.35) {
  if (!hex || typeof hex !== 'string') return `rgba(99, 102, 241, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(99, 102, 241, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Apply dynamic CSS variables & data attributes directly to document.documentElement
 */
export function applyThemeToDOM(theme = 'dark-slate', accent = 'indigo', fontSize = 13.5) {
  if (typeof document === 'undefined') return;

  const docEl = document.documentElement;

  // 1. Theme Attribute
  docEl.setAttribute('data-theme', theme || 'dark-slate');

  // 2. Accent Color Application
  const preset = ACCENT_PRESETS[accent];
  if (preset) {
    docEl.setAttribute('data-accent', preset.id);
    docEl.style.setProperty('--color-primary', preset.color);
    docEl.style.setProperty('--color-primary-hover', preset.hover);
    docEl.style.setProperty('--color-primary-glow', preset.glow);
    docEl.style.setProperty('--waveform-active', preset.color);
  } else if (accent && accent.startsWith('#')) {
    // Custom hex support
    docEl.setAttribute('data-accent', 'custom');
    docEl.style.setProperty('--color-primary', accent);
    docEl.style.setProperty('--color-primary-hover', accent);
    docEl.style.setProperty('--color-primary-glow', hexToRgba(accent, 0.35));
    docEl.style.setProperty('--waveform-active', accent);
  } else {
    // Default Indigo Fallback
    const def = ACCENT_PRESETS.indigo;
    docEl.setAttribute('data-accent', 'indigo');
    docEl.style.setProperty('--color-primary', def.color);
    docEl.style.setProperty('--color-primary-hover', def.hover);
    docEl.style.setProperty('--color-primary-glow', def.glow);
    docEl.style.setProperty('--waveform-active', def.color);
  }

  // 3. Dynamic Font Size Variable
  docEl.style.setProperty('--font-size-chat', `${fontSize || 13.5}px`);
}

/**
 * Reset DOM back to clean unauthenticated system defaults
 */
export function resetThemeToDefault() {
  if (typeof document === 'undefined') return;

  const docEl = document.documentElement;
  const def = ACCENT_PRESETS.indigo;

  docEl.setAttribute('data-theme', 'dark-slate');
  docEl.setAttribute('data-accent', 'indigo');
  docEl.style.setProperty('--color-primary', def.color);
  docEl.style.setProperty('--color-primary-hover', def.hover);
  docEl.style.setProperty('--color-primary-glow', def.glow);
  docEl.style.setProperty('--waveform-active', def.color);
  docEl.style.setProperty('--font-size-chat', '13.5px');
}

const ThemeContext = createContext({
  theme: 'dark-slate',
  accentColor: 'indigo',
  setAccentColor: () => {},
  setTheme: () => {},
  resetTheme: () => {},
});

export function ThemeProvider({ children }) {
  const currentUser = useRakchaStore((s) => s.currentUser);
  const settings = useRakchaStore((s) => s.settings);
  const updateSettings = useRakchaStore((s) => s.updateSettings);

  const activeTheme = settings?.theme || 'dark-slate';
  const activeAccent = settings?.accentColor || 'indigo';
  const activeFontSize = settings?.fontSize || 13.5;

  // Sync DOM with current active theme/accent
  useEffect(() => {
    if (currentUser) {
      applyThemeToDOM(activeTheme, activeAccent, activeFontSize);
    } else {
      resetThemeToDefault();
    }
  }, [currentUser, activeTheme, activeAccent, activeFontSize]);

  const setAccentColor = useCallback(async (newAccent) => {
    updateSettings({ accentColor: newAccent });
    if (currentUser?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ accent_color: newAccent })
          .eq('id', currentUser.id);
      } catch (err) {
        console.warn('Failed to persist accent_color to Supabase:', err);
      }
    }
  }, [currentUser, updateSettings]);

  const setTheme = useCallback(async (newTheme) => {
    updateSettings({ theme: newTheme });
    if (currentUser?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ theme: newTheme })
          .eq('id', currentUser.id);
      } catch (err) {
        console.warn('Failed to persist theme to Supabase:', err);
      }
    }
  }, [currentUser, updateSettings]);

  const resetTheme = useCallback(() => {
    resetThemeToDefault();
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme: activeTheme,
        accentColor: activeAccent,
        setAccentColor,
        setTheme,
        resetTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
