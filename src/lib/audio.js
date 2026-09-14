// Synthetic ringtones using Web Audio API

let audioCtx = null;
let incomingOscillator = null;
let incomingGain = null;
let callingOscillator = null;
let callingGain = null;
let isIncomingPlaying = false;
let isCallingPlaying = false;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function playIncomingRingtone() {
  if (isIncomingPlaying) return;
  initAudio();
  isIncomingPlaying = true;

  try {
    incomingOscillator = audioCtx.createOscillator();
    incomingGain = audioCtx.createGain();

    incomingOscillator.type = 'sine';
    incomingOscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
    incomingOscillator.frequency.setValueAtTime(480, audioCtx.currentTime); // Dual tone feel

    incomingGain.gain.setValueAtTime(0, audioCtx.currentTime);

    // US Ringtone cadence: 2s on, 4s off
    const loopLength = 6;
    const loopCount = 100; // loop for a while

    for (let i = 0; i < loopCount; i++) {
      const time = audioCtx.currentTime + i * loopLength;
      incomingGain.gain.setValueAtTime(0.5, time);
      incomingGain.gain.setValueAtTime(0, time + 2);
    }

    incomingOscillator.connect(incomingGain);
    incomingGain.connect(audioCtx.destination);
    incomingOscillator.start();
  } catch (err) {
    console.warn('[Audio] playIncomingRingtone failed:', err);
    isIncomingPlaying = false;
  }
}

export function stopIncomingRingtone() {
  isIncomingPlaying = false;
  if (incomingOscillator) {
    try { incomingOscillator.stop(); } catch { /* ignore */ }
    try { incomingOscillator.disconnect(); } catch { /* ignore */ }
    incomingOscillator = null;
  }
  if (incomingGain) {
    try { incomingGain.disconnect(); } catch { /* ignore */ }
    incomingGain = null;
  }
}

export function playCallingSound() {
  if (isCallingPlaying) return;
  initAudio();
  isCallingPlaying = true;

  try {
    callingOscillator = audioCtx.createOscillator();
    callingGain = audioCtx.createGain();

    callingOscillator.type = 'sine';
    callingOscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
    callingOscillator.frequency.setValueAtTime(480, audioCtx.currentTime);

    callingGain.gain.setValueAtTime(0, audioCtx.currentTime);

    // EU/UK Ringback tone: 0.4s on, 0.2s off, 0.4s on, 2s off
    const loopLength = 3;
    const loopCount = 100;

    for (let i = 0; i < loopCount; i++) {
      const time = audioCtx.currentTime + i * loopLength;
      callingGain.gain.setValueAtTime(0.1, time);
      callingGain.gain.setValueAtTime(0, time + 0.4);
      callingGain.gain.setValueAtTime(0.1, time + 0.6);
      callingGain.gain.setValueAtTime(0, time + 1.0);
    }

    callingOscillator.connect(callingGain);
    callingGain.connect(audioCtx.destination);
    callingOscillator.start();
  } catch (err) {
    console.warn('[Audio] playCallingSound failed:', err);
    isCallingPlaying = false;
  }
}

export function stopCallingSound() {
  isCallingPlaying = false;
  if (callingOscillator) {
    try { callingOscillator.stop(); } catch { /* ignore */ }
    try { callingOscillator.disconnect(); } catch { /* ignore */ }
    callingOscillator = null;
  }
  if (callingGain) {
    try { callingGain.disconnect(); } catch { /* ignore */ }
    callingGain = null;
  }
}
