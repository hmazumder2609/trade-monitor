/**
 * Alert Sound System — Modern Web Audio API synthesized tones.
 * Features: smooth waveforms, volume normalization, fade-in/out, reverb effects.
 * No audio file dependencies.
 */

export type AlertLevel = 'critical' | 'high' | 'medium' | 'low';

export interface AlertSoundConfig {
  enabled: boolean;
  volume: number; // 0–100
  tone: string; // tone preset name
}

export type AlertSoundPrefs = Record<AlertLevel, AlertSoundConfig>;

const STORAGE_KEY = 'mdm-alert-sounds';

const DEFAULT_PREFS: AlertSoundPrefs = {
  critical: { enabled: true, volume: 80, tone: 'siren' },
  high: { enabled: true, volume: 60, tone: 'chime-double' },
  medium: { enabled: true, volume: 40, tone: 'chime' },
  low: { enabled: true, volume: 25, tone: 'tick' },
};

// ---- Audio Context & Effects ----

let audioCtx: AudioContext | null = null;
let globalMute = false;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/** Create a reverb convolution (simple room reverb) */
function createReverb(ctx: AudioContext, duration = 0.5, decay = 2): ConvolverNode {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }

  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

/** Create a master gain chain with optional reverb */
function createMasterChain(ctx: AudioContext, vol: number): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const reverb = createReverb(ctx, 0.3, 3);
  const reverbGain = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();

  // Dry/wet mix: 70% dry, 30% wet
  dryGain.gain.setValueAtTime(0.7, ctx.currentTime);
  wetGain.gain.setValueAtTime(0.3 * vol, ctx.currentTime);

  input.connect(dryGain);
  input.connect(reverb);
  reverb.connect(reverbGain);
  reverbGain.gain.setValueAtTime(vol, ctx.currentTime);

  dryGain.connect(output);
  reverbGain.connect(wetGain);
  wetGain.connect(output);

  return { input, output };
}

/** Apply smooth fade-in and fade-out to a gain node */
function applyEnvelope(
  gain: GainNode,
  ctx: AudioContext,
  attackMs: number,
  decayMs: number,
  peakVol: number
): void {
  const now = ctx.currentTime;
  const attack = attackMs / 1000;
  const decay = decayMs / 1000;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peakVol, now + attack);
  gain.gain.setValueAtTime(peakVol, now + attack + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);
}

// ---- Tone Definitions (Modern, Smooth) ----

type TonePlayer = (ctx: AudioContext, master: GainNode) => void;

const TONE_LIBRARY: Record<string, { label: string; play: TonePlayer }> = {
  siren: {
    label: 'Siren',
    play(ctx, master) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; // smoother than sawtooth
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.2);
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.4);
      osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.6);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.8);
      applyEnvelope(gain, ctx, 10, 800, 0.4);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.85);
    },
  },
  'chime-double': {
    label: 'Double Chime',
    play(ctx, master) {
      for (let i = 0; i < 2; i++) {
        const t = ctx.currentTime + i * 0.25;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
        applyEnvelope(gain, ctx, 5, 400, 0.3);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.45);
      }
    },
  },
  chime: {
    label: 'Chime',
    play(ctx, master) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.2);
      applyEnvelope(gain, ctx, 5, 500, 0.25);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.55);
    },
  },
  tick: {
    label: 'Tick',
    play(ctx, master) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
      applyEnvelope(gain, ctx, 2, 100, 0.15);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    },
  },
  bell: {
    label: 'Bell',
    play(ctx, master) {
      const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5 major chord
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        applyEnvelope(gain, ctx, 5, 800, 0.15);
        osc.connect(gain);
        gain.connect(master);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.85);
      }
    },
  },
  'alert-up': {
    label: 'Alert Up',
    play(ctx, master) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.25);
      applyEnvelope(gain, ctx, 5, 350, 0.25);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    },
  },
  pulse: {
    label: 'Pulse',
    play(ctx, master) {
      for (let i = 0; i < 3; i++) {
        const t = ctx.currentTime + i * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, t);
        applyEnvelope(gain, ctx, 2, 80, 0.2);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.1);
      }
    },
  },
  klaxon: {
    label: 'Klaxon',
    play(ctx, master) {
      for (let i = 0; i < 4; i++) {
        const t = ctx.currentTime + i * 0.15;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(i % 2 === 0 ? 440 : 660, t);
        applyEnvelope(gain, ctx, 3, 120, 0.2);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.15);
      }
    },
  },
  'warning-buzz': {
    label: 'Warning Buzz',
    play(ctx, master) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      // Amplitude modulation for buzz effect
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(12, ctx.currentTime);
      lfoGain.gain.setValueAtTime(0.2, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      applyEnvelope(gain, ctx, 10, 500, 0.25);
      osc.connect(gain);
      gain.connect(master);
      lfo.start(ctx.currentTime);
      osc.start(ctx.currentTime);
      lfo.stop(ctx.currentTime + 0.55);
      osc.stop(ctx.currentTime + 0.55);
    },
  },
  emergency: {
    label: 'Emergency',
    play(ctx, master) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.7);
      applyEnvelope(gain, ctx, 10, 900, 0.35);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.95);
    },
  },
  'soft-ping': {
    label: 'Soft Ping',
    play(ctx, master) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.15);
      applyEnvelope(gain, ctx, 3, 300, 0.12);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    },
  },
  escalate: {
    label: 'Escalate',
    play(ctx, master) {
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      for (let i = 0; i < notes.length; i++) {
        const t = ctx.currentTime + i * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[i], t);
        applyEnvelope(gain, ctx, 3, 200, 0.2);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.2);
      }
    },
  },
  // New modern tones
  sonar: {
    label: 'Sonar',
    play(ctx, master) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
      applyEnvelope(gain, ctx, 5, 600, 0.2);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.65);
    },
  },
  glass: {
    label: 'Glass',
    play(ctx, master) {
      const freqs = [1046.5, 1318.51, 1567.98]; // C6, E6, G6
      for (let i = 0; i < freqs.length; i++) {
        const t = ctx.currentTime + i * 0.05;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freqs[i], t);
        applyEnvelope(gain, ctx, 2, 500, 0.1);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.55);
      }
    },
  },
  subtle: {
    label: 'Subtle',
    play(ctx, master) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(520, ctx.currentTime + 0.2);
      applyEnvelope(gain, ctx, 20, 400, 0.1);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    },
  },
};

// ---- State ----

// ---- Public API ----

export function getAlertSoundPrefs(): AlertSoundPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setAlertSoundPrefs(prefs: AlertSoundPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function isGlobalMute(): boolean {
  return globalMute || localStorage.getItem('mdm-alert-mute') === '1';
}

export function setGlobalMute(muted: boolean): void {
  globalMute = muted;
  localStorage.setItem('mdm-alert-mute', muted ? '1' : '0');
}

export function getToneNames(): Array<{ id: string; label: string }> {
  return Object.entries(TONE_LIBRARY).map(([id, t]) => ({ id, label: t.label }));
}

export function playAlertSound(level: AlertLevel): void {
  if (isGlobalMute()) return;
  const prefs = getAlertSoundPrefs();
  const cfg = prefs[level];
  if (!cfg.enabled || cfg.volume === 0) return;

  const tone = TONE_LIBRARY[cfg.tone];
  if (!tone) return;

  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const vol = cfg.volume / 100;
  const { input, output } = createMasterChain(ctx, vol);

  tone.play(ctx, input);

  output.connect(ctx.destination);
}

/** Play a specific tone at a specific volume — used for the "test" button in settings */
export function playTestTone(toneId: string, volume: number): void {
  const tone = TONE_LIBRARY[toneId];
  if (!tone) return;

  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const vol = Math.max(0, Math.min(1, volume / 100));
  const { input, output } = createMasterChain(ctx, vol);

  tone.play(ctx, input);

  output.connect(ctx.destination);
}

/** Get waveform data for visualization */
export function getWaveform(toneId: string): Float32Array | null {
  const tone = TONE_LIBRARY[toneId];
  if (!tone) return null;

  const ctx = getCtx();
  const sampleRate = ctx.sampleRate;
  const duration = 0.5;
  const length = Math.floor(sampleRate * duration);
  const data = new Float32Array(length);

  // Generate a simple waveform representation
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Combine multiple sine waves for a richer waveform
    data[i] =
      0.3 * Math.sin(2 * Math.PI * 440 * t) +
      0.2 * Math.sin(2 * Math.PI * 880 * t) +
      0.1 * Math.sin(2 * Math.PI * 1320 * t);
  }

  return data;
}

export const ALERT_LEVELS: { id: AlertLevel; label: string; color: string }[] = [
  { id: 'critical', label: 'Critical', color: 'var(--red)' },
  { id: 'high', label: 'High', color: 'var(--semantic-high)' },
  { id: 'medium', label: 'Medium', color: 'var(--yellow)' },
  { id: 'low', label: 'Low / Info', color: 'var(--blue)' },
];
