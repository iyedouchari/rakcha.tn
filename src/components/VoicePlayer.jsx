/**
 * VoicePlayer.jsx
 * Instagram/Messenger-style waveform voice message player.
 * Uses a real <audio> DOM element, pure inline styles, no external CSS deps.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// ─── Global: only one player plays at a time ───────────────────────────────
const registry = new Set();
function pauseAll(exceptId) {
  registry.forEach(p => { if (p.id !== exceptId) p.pause(); });
}

let uid = 0;

export function VoicePlayer({ audioUrl, waveform, duration: propDuration, isMe }) {
  const instanceId = useRef(++uid);
  const audioRef   = useRef(null);
  const waveRef    = useRef(null);
  const rafRef     = useRef(null);

  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [dur,      setDur]      = useState(propDuration > 0 ? propDuration : 0);
  const [rate,     setRate]     = useState(1);

  // Register in global registry
  useEffect(() => {
    const id = instanceId.current;
    const entry = {
      id,
      pause: () => {
        const a = audioRef.current;
        if (a && !a.paused) a.pause();
        cancelAnimationFrame(rafRef.current);
        setPlaying(false);
      },
    };
    registry.add(entry);
    return () => registry.delete(entry);
  }, []);

  // On audio element mount / URL change
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onMeta = () => {
      if (isFinite(a.duration) && a.duration > 0) setDur(a.duration);
    };
    const onEnd = () => {
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
      setCurrent(0);
    };

    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);

    // If metadata already available
    if (isFinite(a.duration) && a.duration > 0) setDur(a.duration);

    return () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, [audioUrl]);

  // Sync playback rate
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  // rAF loop — only active while playing
  const tick = useCallback(() => {
    const a = audioRef.current;
    if (a) setCurrent(a.currentTime);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;

    if (playing) {
      a.pause();
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
    } else {
      pauseAll(instanceId.current);
      a.play()
        .then(() => {
          setPlaying(true);
          rafRef.current = requestAnimationFrame(tick);
        })
        .catch(err => console.warn('VoicePlayer play failed:', err));
    }
  };

  // Seek by click / drag
  const seekTo = useCallback((clientX) => {
    const a  = audioRef.current;
    const el = waveRef.current;
    if (!a || !el) return;
    const { left, width } = el.getBoundingClientRect();
    const ratio  = Math.max(0, Math.min(1, (clientX - left) / width));
    const target = ratio * (dur || a.duration || 1);
    a.currentTime = target;
    setCurrent(target);
  }, [dur]);

  const onWaveDown = (e) => {
    e.preventDefault();
    seekTo(e.clientX);

    const onMove = (ev) => seekTo(ev.clientX);
    const onUp   = ()  => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  };

  // ── Build 30 bars (memoised, deterministic fallback) ──────────────────────
  const bars = useMemo(() => {
    if (Array.isArray(waveform) && waveform.length > 0) {
      const len = waveform.length;
      return Array.from({ length: 30 }, (_, i) => {
        const src = Math.round((i / 29) * (len - 1));
        return Math.max(0.08, Math.min(1, Number(waveform[src]) || 0.3));
      });
    }
    // Deterministic bell-curve + noise — looks natural
    return Array.from({ length: 30 }, (_, i) => {
      const x    = i / 29;
      const bell = Math.sin(x * Math.PI);
      const det  = ((i * 7 + 13) % 17) / 34; // [0, 0.5), no Math.random()
      return Math.max(0.08, Math.min(1, bell * 0.60 + det * 0.40));
    });
  }, [waveform]);

  const progress = dur > 0 ? Math.min(1, current / dur) : 0;

  const fmtTime = (s) => {
    const safe = isFinite(s) && s >= 0 ? s : 0;
    const m    = Math.floor(safe / 60);
    const sec  = Math.floor(safe % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Colours ────────────────────────────────────────────────────────────────
  const FILL_ACTIVE   = isMe ? '#fff'                    : 'var(--waveform-active, #6366f1)';
  const FILL_INACTIVE = isMe ? 'rgba(255,255,255,0.32)'  : 'rgba(99,102,241,0.25)';
  const TEXT_COLOR    = isMe ? 'rgba(255,255,255,0.75)'  : '#9ca3af';
  const BTN_BG        = isMe ? 'rgba(255,255,255,0.22)'  : 'var(--color-primary, #6366f1)';
  const BTN_BG_HOVER  = isMe ? 'rgba(255,255,255,0.38)'  : 'var(--color-primary-hover, #4f46e5)';

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        10,
      width:      248,
      minWidth:   248,
      userSelect: 'none',
    }}>

      {/* ── Real audio element (invisible, stays in DOM) ── */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
      />

      {/* ── Play / Pause ── */}
      <button
        onClick={togglePlay}
        title={playing ? 'Pause' : 'Play'}
        style={{
          width:           38,
          height:          38,
          borderRadius:    '50%',
          flexShrink:      0,
          border:          'none',
          cursor:          'pointer',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          background:      BTN_BG,
          color:           '#fff',
          boxShadow:       '0 2px 6px rgba(0,0,0,0.22)',
          transition:      'background 120ms',
          outline:         'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = BTN_BG_HOVER; }}
        onMouseLeave={e => { e.currentTarget.style.background = BTN_BG; }}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* ── Waveform column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>

        {/* bars */}
        <div
          ref={waveRef}
          onMouseDown={onWaveDown}
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        2,
            height:     34,
            cursor:     'pointer',
            width:      '100%',
          }}
        >
          {bars.map((amp, i) => {
            const filled = (i / bars.length) <= progress;
            const h      = Math.round(Math.max(5, amp * 28)); // 5–28 px
            return (
              <div
                key={i}
                style={{
                  width:           3,
                  height:          h,
                  borderRadius:    99,
                  flexShrink:      0,
                  backgroundColor: filled ? FILL_ACTIVE : FILL_INACTIVE,
                  transition:      'background-color 50ms linear',
                }}
              />
            );
          })}
        </div>

        {/* time + speed */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontSize:           11,
            fontWeight:         500,
            fontVariantNumeric: 'tabular-nums',
            color:              TEXT_COLOR,
            lineHeight:         1,
          }}>
            {fmtTime(current)} / {fmtTime(dur)}
          </span>
          <button
            onClick={() => setRate(r => r === 1 ? 1.5 : r === 1.5 ? 2 : 1)}
            style={{
              fontSize:   10,
              fontWeight: 700,
              color:      TEXT_COLOR,
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              padding:    '2px 4px',
              borderRadius: 4,
              lineHeight: 1,
              outline:    'none',
            }}
          >
            {rate}x
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline SVG icons (no lucide import needed — avoids any tree-shaking issue) ─
function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}
