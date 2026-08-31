/**
 * VoicePlayer.jsx
 * Instagram / Messenger-style waveform voice message player.
 * Features interactive seeking, 1x/1.5x/2x multi-speed selector,
 * dynamic played/unplayed waveform highlighting, and single-concurrency playback.
 * Pure JavaScript / JSX.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

// ── Global Registry: Ensures only one voice note plays at any time ──────────
const activePlayersRegistry = new Set();
function pauseAllExcept(activeId) {
  activePlayersRegistry.forEach((player) => {
    if (player.id !== activeId) {
      player.pause();
    }
  });
}

let playerInstanceCounter = 0;

export function VoicePlayer({ audioUrl, waveform, duration: propDuration, isMe = false }) {
  const instanceId = useRef(++playerInstanceCounter);
  const audioRef = useRef(null);
  const waveRef = useRef(null);
  const rafRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(propDuration > 0 ? propDuration : 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // Register in global registry for single concurrency
  useEffect(() => {
    const id = instanceId.current;
    const entry = {
      id,
      pause: () => {
        const audio = audioRef.current;
        if (audio && !audio.paused) {
          audio.pause();
        }
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setIsPlaying(false);
      }
    };
    activePlayersRegistry.add(entry);
    return () => {
      activePlayersRegistry.delete(entry);
    };
  }, []);

  // Sync audio metadata & duration
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    if (isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [audioUrl, isDragging]);

  // Sync playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Animation frame ticker for smooth progress update
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused && !isDragging) {
      setCurrentTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [isDragging]);

  // Play / Pause Toggle
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setIsPlaying(false);
    } else {
      pauseAllExcept(instanceId.current);
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          rafRef.current = requestAnimationFrame(tick);
        })
        .catch((err) => {
          console.warn('VoicePlayer play failed:', err);
        });
    }
  };

  // Speed Toggle: 1x -> 1.5x -> 2x -> 1x
  const handleSpeedToggle = (e) => {
    e.stopPropagation();
    setPlaybackRate((prev) => {
      if (prev === 1) return 1.5;
      if (prev === 1.5) return 2;
      return 1;
    });
  };

  // Seek / Scrubbing handler
  const seekToClientX = useCallback(
    (clientX) => {
      const audio = audioRef.current;
      const el = waveRef.current;
      if (!audio || !el) return;

      const rect = el.getBoundingClientRect();
      const clickRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const totalDur = duration > 0 ? duration : audio.duration || 1;
      const targetTime = clickRatio * totalDur;

      audio.currentTime = targetTime;
      setCurrentTime(targetTime);
    },
    [duration]
  );

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    seekToClientX(e.clientX);

    const onMouseMove = (ev) => {
      seekToClientX(ev.clientX);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // 30 bars waveform resolution
  const bars = useMemo(() => {
    const BAR_COUNT = 30;
    if (Array.isArray(waveform) && waveform.length > 0) {
      const len = waveform.length;
      return Array.from({ length: BAR_COUNT }, (_, i) => {
        const srcIdx = Math.round((i / (BAR_COUNT - 1)) * (len - 1));
        const val = Number(waveform[srcIdx]);
        return Math.max(0.1, Math.min(1, isNaN(val) ? 0.35 : val));
      });
    }

    // Natural fallback bell curve with subtle variance
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const x = i / (BAR_COUNT - 1);
      const bell = Math.sin(x * Math.PI);
      const det = ((i * 7 + 11) % 17) / 34;
      return Math.max(0.12, Math.min(1, bell * 0.65 + det * 0.35));
    });
  }, [waveform]);

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  const formatTime = (seconds) => {
    const s = isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
    const m = Math.floor(s / 60);
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <div className="flex items-center gap-2.5 w-full max-w-[260px] sm:max-w-[280px] select-none py-0.5">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
      />

      {/* Round Play / Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        title={isPlaying ? 'Pause' : 'Play'}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95 focus:outline-none ${
          isMe
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-primary hover:bg-primary/90 text-white'
        }`}
      >
        {isPlaying ? (
          <Pause size={16} className="fill-current" />
        ) : (
          <Play size={16} className="fill-current translate-x-[1px]" />
        )}
      </button>

      {/* Waveform & Details Container */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Interactive Waveform Bar Strip */}
        <div
          ref={waveRef}
          onMouseDown={handleMouseDown}
          className="flex items-center gap-[2px] h-8 cursor-pointer w-full group py-1"
          title="Click or drag to seek"
        >
          {bars.map((amp, idx) => {
            const isPlayed = idx / bars.length <= progress;
            const barHeight = Math.max(4, Math.round(amp * 26)); // 4px to 26px height

            return (
              <div
                key={idx}
                style={{ height: `${barHeight}px` }}
                className={`w-[3px] rounded-full transition-colors duration-75 shrink-0 ${
                  isPlayed
                    ? isMe
                      ? 'bg-white'
                      : 'bg-primary'
                    : isMe
                    ? 'bg-white/30 group-hover:bg-white/40'
                    : 'bg-primary/25 group-hover:bg-primary/35'
                }`}
              />
            );
          })}
        </div>

        {/* Time Counter & Multi-Speed Selector */}
        <div className="flex items-center justify-between text-[11px] font-mono leading-none">
          <span
            className={
              isMe ? 'text-white/80 font-medium' : 'text-muted-foreground font-medium'
            }
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Speed Modifier Button: 1x / 1.5x / 2x */}
          <button
            type="button"
            onClick={handleSpeedToggle}
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition ${
              isMe
                ? 'bg-white/15 hover:bg-white/25 text-white'
                : 'bg-surface-container hover:bg-surface-container-high text-foreground/80'
            }`}
            title="Toggle playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}

export default VoicePlayer;
