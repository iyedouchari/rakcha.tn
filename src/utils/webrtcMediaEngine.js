/**
 * Rakcha WebRTC High-Fidelity Audio & Video Media Engine
 * 
 * Pipeline Architecture:
 * 1. Ingest & Capture: 1080p 16:9 30fps HD Video + 48kHz Mono Mic (with 720p fallback)
 * 2. 3-Stage Web Audio DSP: 85Hz Rumble Cut -> 3kHz Presence EQ -> Tuned Dynamics Compressor
 * 3. Video Transceiver & Sender Tuning: VP9 / H.264 High Profile prioritization + 2.5 Mbps allocation
 * 4. Programmatic SDP Optimizer: 64kbps CBR Opus + In-Band FEC injection
 * 
 * Pure JavaScript / JSX implementation with zero external dependencies.
 */

// ── Standard WebRTC Configuration ───────────────────────────────────────────
export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

// ── 1. Ingest & Capture Layer (1080p 16:9 + 48kHz Mono Studio Mic) ───────────

/**
 * Capture high-definition video and studio-quality microphone streams
 * with a graceful fallback to 720p and standard constraints if hardware is limited.
 * 
 * @param {Object} options
 * @param {boolean} [options.audio=true]
 * @param {boolean} [options.video=false]
 * @param {Object} [options.audioConstraints={}]
 * @param {Object} [options.videoConstraints={}]
 * @returns {Promise<MediaStream>}
 */
export async function getOptimalUserMedia({
  audio = true,
  video = false,
  audioConstraints = {},
  videoConstraints = {}
} = {}) {
  // Studio Microphone Constraints: 48kHz mono capture prevents laptop phase cancellation
  const optimalAudio = audio
    ? {
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...audioConstraints
      }
    : false;

  // Enforced 1080p 16:9 30fps Video Constraints
  const optimalVideo = video
    ? {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        aspectRatio: 1.777777778, // 16:9 Widescreen
        frameRate: { ideal: 30, max: 60 },
        ...videoConstraints
      }
    : false;

  try {
    // Attempt 1: Full 1080p + 48kHz Studio constraints
    return await navigator.mediaDevices.getUserMedia({
      audio: optimalAudio,
      video: optimalVideo
    });
  } catch (err1) {
    console.warn('[Rakcha MediaEngine] 1080p capture failed, falling back to 720p HD...', err1);
    
    try {
      // Attempt 2: 720p HD fallback
      const fallbackVideo = video
        ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: 1.777777778,
            frameRate: { ideal: 30 },
            ...videoConstraints
          }
        : false;

      return await navigator.mediaDevices.getUserMedia({
        audio: optimalAudio,
        video: fallbackVideo
      });
    } catch (err2) {
      console.warn('[Rakcha MediaEngine] 720p capture failed, falling back to standard userMedia...', err2);
      
      // Attempt 3: Basic permissive fallback, guaranteeing echo cancellation and noise suppression
      return await navigator.mediaDevices.getUserMedia({
        audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
        video: video ? true : false
      });
    }
  }
}

// ── 2. 3-Stage Web Audio DSP Graph ──────────────────────────────────────────

/**
 * Constructs a real-time Web Audio API DSP signal chain:
 * Raw Mic -> 85Hz Highpass (Rumble Cut) -> 3kHz Peaking EQ (Presence) -> Dynamics Compressor -> Output Destination
 * 
 * IMPORTANT: Microphone input is routed ONLY to MediaStreamDestinationNode for WebRTC transmission.
 * It is NEVER connected to audioCtx.destination (hardware speakers) to prevent local acoustic feedback loopback.
 * 
 * @param {MediaStream} rawStream - MediaStream containing a raw audio track
 * @returns {{
 *   cleanStream: MediaStream,
 *   cleanAudioTrack: MediaStreamTrack,
 *   audioContext: AudioContext,
 *   rawAudioTrack: MediaStreamTrack,
 *   resume: Function,
 *   cleanup: Function,
 *   setFilterEnabled: Function
 * }}
 */
export function createStudioAudioDSP(rawStream) {
  const rawAudioTrack = rawStream.getAudioTracks()[0];
  if (!rawAudioTrack) {
    throw new Error('[Rakcha DSP] Provided MediaStream does not contain an audio track.');
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    console.warn('[Rakcha DSP] Web Audio API not supported in this environment.');
    return {
      cleanStream: rawStream,
      cleanAudioTrack: rawAudioTrack,
      audioContext: null,
      rawAudioTrack,
      resume: () => Promise.resolve(),
      cleanup: () => {},
      setFilterEnabled: () => {}
    };
  }

  const audioCtx = new AudioContextClass({ sampleRate: 48000 });
  const sourceStream = new MediaStream([rawAudioTrack]);
  const sourceNode = audioCtx.createMediaStreamSource(sourceStream);

  // Stage 1: 85Hz Butterworth Highpass Filter (Cuts AC hum, desk bumps, mechanical keyboard rumble)
  const highpassFilter = audioCtx.createBiquadFilter();
  highpassFilter.type = 'highpass';
  highpassFilter.frequency.setValueAtTime(85, audioCtx.currentTime);
  highpassFilter.Q.setValueAtTime(0.707, audioCtx.currentTime);

  // Stage 2: 3kHz Vocal Presence Peaking EQ (+2.5dB boost for vocal definition & consonant clarity)
  const presenceFilter = audioCtx.createBiquadFilter();
  presenceFilter.type = 'peaking';
  presenceFilter.frequency.setValueAtTime(3000, audioCtx.currentTime);
  presenceFilter.gain.setValueAtTime(2.5, audioCtx.currentTime);
  presenceFilter.Q.setValueAtTime(1.0, audioCtx.currentTime);

  // Stage 3: Tuned Dynamics Compressor (Normalizes vocal levels, tames shouting, boosts soft speech)
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
  compressor.knee.setValueAtTime(25, audioCtx.currentTime);
  compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
  compressor.attack.setValueAtTime(0.003, audioCtx.currentTime); // 3ms fast attack
  compressor.release.setValueAtTime(0.20, audioCtx.currentTime); // 200ms smooth release

  // Destination Node to output processed stream for WebRTC
  const destination = audioCtx.createMediaStreamDestination();

  // Connect Audio Graph: Source -> Highpass -> Presence EQ -> Compressor -> Destination
  sourceNode.connect(highpassFilter);
  highpassFilter.connect(presenceFilter);
  presenceFilter.connect(compressor);
  compressor.connect(destination);

  const cleanAudioTrack = destination.stream.getAudioTracks()[0];
  if (cleanAudioTrack) {
    cleanAudioTrack.enabled = rawAudioTrack.enabled;
  }

  // Helper to resume audio context on user interaction (satisfies browser autoplay policies)
  const resume = async () => {
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
        console.log('[Rakcha DSP] AudioContext resumed successfully.');
      } catch (err) {
        console.warn('[Rakcha DSP] Failed to resume AudioContext:', err);
      }
    }
  };

  // Helper to toggle 85Hz highpass filter
  const setFilterEnabled = (enabled) => {
    highpassFilter.frequency.setValueAtTime(enabled ? 85 : 10, audioCtx.currentTime);
  };

  // Comprehensive cleanup
  const cleanup = () => {
    try {
      sourceNode.disconnect();
      highpassFilter.disconnect();
      presenceFilter.disconnect();
      compressor.disconnect();
      destination.disconnect();
      if (audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    } catch (e) {
      console.warn('[Rakcha DSP] Cleanup notice:', e);
    }
  };

  return {
    cleanStream: destination.stream,
    cleanAudioTrack,
    audioContext: audioCtx,
    rawAudioTrack,
    resume,
    cleanup,
    setFilterEnabled
  };
}

// ── 3. Video Transceiver & Sender Tuning ─────────────────────────────────────

/**
 * Configure RTCPeerConnection codec preferences and transceiver parameters
 * to prioritize VP9 and H.264 High Profile over standard VP8.
 * 
 * @param {RTCPeerConnection} peerConnection
 */
export function tuneRTCPeerConnection(peerConnection) {
  if (!peerConnection) return;

  try {
    if (typeof RTCRtpReceiver !== 'undefined' && typeof RTCRtpReceiver.getCapabilities === 'function') {
      const videoCapabilities = RTCRtpReceiver.getCapabilities('video');
      
      if (videoCapabilities && videoCapabilities.codecs && Array.isArray(videoCapabilities.codecs)) {
        // Prioritize VP9, then H.264, then VP8
        const prioritizedCodecs = videoCapabilities.codecs.slice().sort((a, b) => {
          const getScore = (codec) => {
            const mime = (codec.mimeType || '').toLowerCase();
            if (mime.includes('vp9')) return 3;
            if (mime.includes('h264')) return 2;
            if (mime.includes('vp8')) return 1;
            return 0;
          };
          return getScore(b) - getScore(a);
        });

        const transceivers = peerConnection.getTransceivers ? peerConnection.getTransceivers() : [];
        transceivers.forEach(transceiver => {
          if (
            transceiver.receiver &&
            transceiver.receiver.track &&
            transceiver.receiver.track.kind === 'video' &&
            typeof transceiver.setCodecPreferences === 'function'
          ) {
            try {
              transceiver.setCodecPreferences(prioritizedCodecs);
            } catch (err) {
              console.warn('[Rakcha MediaEngine] setCodecPreferences notice:', err);
            }
          }
        });
      }
    }
  } catch (err) {
    console.warn('[Rakcha MediaEngine] tuneRTCPeerConnection notice:', err);
  }
}

/**
 * Tune RTCRtpSender encoding parameters for crisp 1080p transmission:
 * - 2.5 Mbps (2,500,000 bps) max bitrate allocation
 * - 1.0 scaleResolutionDownBy (full native sharpness)
 * - degradationPreference = 'maintain-resolution' (prevents text/face blurring during network dips)
 * 
 * @param {RTCPeerConnection} peerConnection
 */
export async function tuneVideoSender(peerConnection) {
  if (!peerConnection) return;

  try {
    const senders = peerConnection.getSenders ? peerConnection.getSenders() : [];
    const videoSender = senders.find(s => s.track && s.track.kind === 'video');

    if (videoSender && typeof videoSender.getParameters === 'function') {
      const params = videoSender.getParameters() || {};
      
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      // 2.5 Mbps allocation for crisp 1080p
      params.encodings[0].maxBitrate = 2500000;
      params.encodings[0].scaleResolutionDownBy = 1.0;
      params.degradationPreference = 'maintain-resolution';

      if (typeof videoSender.setParameters === 'function') {
        await videoSender.setParameters(params);
        console.log('[Rakcha MediaEngine] Video sender tuned: 2.5Mbps, maintain-resolution');
      }
    }
  } catch (err) {
    console.warn('[Rakcha MediaEngine] tuneVideoSender notice:', err);
  }
}

// ── 4. Programmatic SDP Optimizer Layer ──────────────────────────────────────

/**
 * Optimizes the SDP Offer/Answer by modifying the Opus audio payload parameters:
 * - maxaveragebitrate=65536 (64 kbps studio quality voice)
 * - useinbandfec=1 (In-Band Forward Error Correction to eliminate packet drop stutter)
 * - cbr=1 (Constant Bitrate mode)
 * - stereo=0;sprop-stereo=0 (Mono encoding prevents laptop mic phase cancellation)
 * 
 * @param {string} sdp - The raw SDP description string
 * @returns {string} The optimized SDP string
 */
export function boostSDPAudioQuality(sdp) {
  if (!sdp || typeof sdp !== 'string') return sdp;

  try {
    const lines = sdp.split('\r\n');
    let opusPayloadType = null;

    // Step 1: Find Opus payload type identifier (typically 111)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('a=rtpmap:') && line.toLowerCase().includes('opus/48000')) {
        const match = line.match(/^a=rtpmap:(\d+)\s+opus\/48000/i);
        if (match && match[1]) {
          opusPayloadType = match[1];
          break;
        }
      }
    }

    if (!opusPayloadType) {
      opusPayloadType = '111'; // Default WebRTC Opus payload ID
    }

    let fmtpFound = false;
    const targetFmtpPrefix = `a=fmtp:${opusPayloadType} `;

    // Step 2: Inject or modify fmtp parameters for Opus
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(targetFmtpPrefix)) {
        fmtpFound = true;
        let params = lines[i].substring(targetFmtpPrefix.length).trim();
        
        // Ensure maxaveragebitrate=65536
        if (/maxaveragebitrate=\d+/i.test(params)) {
          params = params.replace(/maxaveragebitrate=\d+/i, 'maxaveragebitrate=65536');
        } else {
          params += ';maxaveragebitrate=65536';
        }

        // Ensure useinbandfec=1
        if (/useinbandfec=\d+/i.test(params)) {
          params = params.replace(/useinbandfec=\d+/i, 'useinbandfec=1');
        } else {
          params += ';useinbandfec=1';
        }

        // Ensure cbr=1
        if (/cbr=\d+/i.test(params)) {
          params = params.replace(/cbr=\d+/i, 'cbr=1');
        } else {
          params += ';cbr=1';
        }

        // Ensure stereo=0
        if (/stereo=\d+/i.test(params)) {
          params = params.replace(/stereo=\d+/i, 'stereo=0');
        } else {
          params += ';stereo=0;sprop-stereo=0';
        }

        // Clean up any double semicolons or leading semicolons
        params = params.replace(/;;+/g, ';').replace(/^;/, '');
        lines[i] = `${targetFmtpPrefix}${params}`;
        break;
      }
    }

    // If no existing fmtp line was found, insert one right after rtpmap
    if (!fmtpFound) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(`a=rtpmap:${opusPayloadType}`)) {
          lines.splice(
            i + 1,
            0,
            `a=fmtp:${opusPayloadType} minptime=10;useinbandfec=1;maxaveragebitrate=65536;cbr=1;stereo=0;sprop-stereo=0`
          );
          break;
        }
      }
    }

    return lines.join('\r\n');
  } catch (err) {
    console.warn('[Rakcha MediaEngine] boostSDPAudioQuality error, returning raw SDP:', err);
    return sdp;
  }
}

// ── 5. Dynamic Track Replacement Helper ─────────────────────────────────────

/**
 * Hot-swaps an active sender track mid-call without triggering SDP renegotiation.
 * 
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStreamTrack} newTrack
 * @param {'audio'|'video'} kind
 * @returns {Promise<boolean>}
 */
export async function replaceSenderTrack(peerConnection, newTrack, kind = 'video') {
  if (!peerConnection) return false;

  try {
    const senders = peerConnection.getSenders ? peerConnection.getSenders() : [];
    const sender = senders.find(s => s.track && s.track.kind === kind);

    if (sender && typeof sender.replaceTrack === 'function') {
      await sender.replaceTrack(newTrack);
      console.log(`[Rakcha MediaEngine] Live ${kind} track swapped successfully.`);
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`[Rakcha MediaEngine] Failed to replace ${kind} track:`, err);
    return false;
  }
}
