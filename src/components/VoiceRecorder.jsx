import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, Send, Loader2, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRakchaStore } from '../store/useRakchaStore';

/**
 * Dynamically selects the best supported audio MIME type
 */
function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac'
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return 'audio/webm';
}

/**
 * VoiceRecorder Component for Rakcha
 * Messenger/Instagram style voice note recorder with live audio wave animation,
 * elapsed timer, discard and send controls.
 * Pure JavaScript / JSX.
 */
export default function VoiceRecorder({ onSend, onCancel }) {
  const showToast = useRakchaStore((s) => s.showToast);

  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [visualLevels, setVisualLevels] = useState([0.15, 0.3, 0.6, 0.8, 0.4, 0.2, 0.5, 0.3, 0.7, 0.4]);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Live visualizer loop
  const updateVisualizer = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Pick 10 sample bands for the visualizer
    const step = Math.floor(dataArray.length / 10);
    const levels = [];
    for (let i = 0; i < 10; i++) {
      const val = dataArray[i * step] / 255;
      levels.push(Math.max(0.12, Math.min(1, val * 1.5)));
    }
    setVisualLevels(levels);
    animFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, []);

  // Cleanup all audio resources
  const cleanupAudio = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  // Start recording on mount
  useEffect(() => {
    let isMounted = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Setup Web Audio Analyser for live wave animation
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;
          animFrameRef.current = requestAnimationFrame(updateVisualizer);
        }

        const mimeType = getSupportedMimeType();
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start(100); // 100ms timeslice for smoother data capture
        setRecordingTime(0);
        timerRef.current = setInterval(() => {
          setRecordingTime((t) => t + 1);
        }, 1000);
      } catch (err) {
        console.error('Microphone access failed:', err);
        showToast('Microphone access denied or unavailable.', 'error');
        if (onCancel) onCancel();
      }
    }

    start();

    return () => {
      isMounted = false;
      cleanupAudio();
    };
  }, [showToast, onCancel, updateVisualizer, cleanupAudio]);

  // Handle Cancel / Discard
  const handleCancel = () => {
    cleanupAudio();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (onCancel) onCancel();
  };

  // Handle Send
  const handleSend = async () => {
    if (!mediaRecorderRef.current || isProcessing) return;
    setIsProcessing(true);

    const recorder = mediaRecorderRef.current;
    const finalDuration = Math.max(1, recordingTime);

    recorder.onstop = async () => {
      try {
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const audioFile = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: mimeType });

        // Extract 30-sample waveform from the recorded audio buffer
        let waveform = [];
        let computedDuration = finalDuration;

        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const decodeCtx = new AudioContextClass();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
            computedDuration = audioBuffer.duration || finalDuration;

            const channelData = audioBuffer.getChannelData(0);
            const samplesCount = 30;
            const blockSize = Math.floor(channelData.length / samplesCount);

            for (let i = 0; i < samplesCount; i++) {
              let sum = 0;
              for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(channelData[i * blockSize + j]);
              }
              waveform.push(sum / Math.max(1, blockSize));
            }

            const maxAmp = Math.max(...waveform, 0.001);
            waveform = waveform.map((amp) => Math.max(0.08, Math.min(1, amp / maxAmp)));
            decodeCtx.close().catch(() => {});
          }
        } catch (waveErr) {
          console.warn('Waveform calculation fallback:', waveErr);
          // Fallback natural wave
          waveform = Array.from({ length: 30 }, (_, i) => {
            const x = i / 29;
            return Math.max(0.1, Math.sin(x * Math.PI) * 0.7 + ((i * 7) % 11) / 33);
          });
        }

        cleanupAudio();

        if (onSend) {
          await onSend({
            audioFile,
            waveform,
            duration: computedDuration
          });
        }
      } catch (err) {
        console.error('Error finalizing voice recording:', err);
        showToast('Failed to process voice note.', 'error');
        if (onCancel) onCancel();
      } finally {
        setIsProcessing(false);
      }
    };

    recorder.stop();
  };

  const minutes = Math.floor(recordingTime / 60);
  const seconds = (recordingTime % 60).toString().padStart(2, '0');

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="w-full bg-[#12141A]/95 border border-rose-500/30 rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-[0_0_20px_rgba(244,63,94,0.15)] backdrop-blur-md"
    >
      {/* Left: Pulsing Red Dot & Timer */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative flex items-center justify-center">
          <div className="w-3 h-3 bg-rose-500 rounded-full animate-ping opacity-75" />
          <div className="w-2.5 h-2.5 bg-rose-500 rounded-full absolute" />
        </div>
        <span className="font-mono text-sm font-bold text-rose-400 tracking-wider">
          {minutes}:{seconds}
        </span>
      </div>

      {/* Center: Live Bouncing Audio Wave Visualizer */}
      <div className="flex items-center gap-1 px-4 py-1 flex-1 max-w-[200px] sm:max-w-[280px] justify-center mx-2 overflow-hidden">
        {visualLevels.map((lvl, idx) => (
          <motion.div
            key={idx}
            animate={{ height: Math.max(4, Math.round(lvl * 24)) }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-1 bg-gradient-to-t from-rose-500 via-primary to-indigo-400 rounded-full shrink-0"
          />
        ))}
      </div>

      {/* Right: Actions (Discard & Send) */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isProcessing}
          className="p-2 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition duration-200"
          title="Discard recording"
        >
          <Trash2 size={18} />
        </button>

        <button
          type="button"
          onClick={handleSend}
          disabled={isProcessing}
          className="p-2.5 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white rounded-full transition duration-200 shadow-md shadow-primary/30 flex items-center justify-center disabled:opacity-50"
          title="Send voice message"
        >
          {isProcessing ? (
            <Loader2 size={16} className="animate-spin text-white" />
          ) : (
            <Send size={15} className="translate-x-[0.5px]" />
          )}
        </button>
      </div>
    </motion.div>
  );
}
