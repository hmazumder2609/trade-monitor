/**
 * Alert Sound System — Web Audio API synthesized tones for alert notifications.
 * No audio file dependencies. Each severity level has a distinct tone.
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

// ---- Tone Definitions ----
// Each tone is a function that schedules oscillator events on an AudioContext.

type TonePlayer = (ctx: AudioContext, gain: GainNode) => void;

const TONE_LIBRARY: Record<string, { label: string; play: TonePlayer }> = {
  siren: {
    label: 'Siren',
    play(ctx, gain) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.15);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.45);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.7);
    },
  },
  'chime-double': {
    label: 'Double Chime',
    play(ctx, gain) {
      for (let i = 0; i < 2; i++) {
        const t = ctx.currentTime + i * 0.2;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.linearRampToValueAtTime(1100, t + 0.08);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.15);
      }
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
    },
  },
  chime: {
    label: 'Chime',
    play(ctx, gain) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    },
  },
  tick: {
    label: 'Tick',
    play(ctx, gain) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    },
  },
  bell: {
    label: 'Bell',
    play(ctx, gain) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(523, ctx.currentTime);
      osc2.frequency.setValueAtTime(784, ctx.currentTime);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    },
  },
  'alert-up': {
    label: 'Alert Up',
    play(ctx, gain) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    },
  },
  pulse: {
    label: 'Pulse',
    play(ctx, gain) {
      for (let i = 0; i < 3; i++) {
        const t = ctx.currentTime + i * 0.12;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.06);
      }
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    },
  },
  klaxon: {
    label: 'Klaxon',
    play(ctx, gain) {
      // Two-tone alternating alarm
      for (let i = 0; i < 4; i++) {
        const t = ctx.currentTime + i * 0.18;
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(i % 2 === 0 ? 500 : 700, t);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.14);
      }
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.75);
    },
  },
  'warning-buzz': {
    label: 'Warning Buzz',
    play(ctx, gain) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + 0.3);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    },
  },
  emergency: {
    label: 'Emergency',
    play(ctx, gain) {
      // Fast descending sweep
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.4);
      osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.5);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.9);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.0);
    },
  },
  'soft-ping': {
    label: 'Soft Ping',
    play(ctx, gain) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    },
  },
  escalate: {
    label: 'Escalate',
    play(ctx, gain) {
      // Rising three-note sequence
      const notes = [440, 660, 880];
      for (let i = 0; i < notes.length; i++) {
        const t = ctx.currentTime + i * 0.15;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[i], t);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.12);
      }
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    },
  },
};

// ---- State ----

let audioCtx: AudioContext | null = null;
let globalMute = false;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

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

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.connect(ctx.destination);

  // Scale volume (0–100 → 0–1 multiplier applied inside tone)
  const vol = cfg.volume / 100;
  const scaledGain = ctx.createGain();
  scaledGain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.connect(scaledGain);
  scaledGain.connect(ctx.destination);
  gain.disconnect(ctx.destination);

  tone.play(ctx, gain);
}

/** Play a specific tone at a specific volume — used for the "test" button in settings */
export function playTestTone(toneId: string, volume: number): void {
  const tone = TONE_LIBRARY[toneId];
  if (!tone) return;

  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const gain = ctx.createGain();
  const vol = Math.max(0, Math.min(1, volume / 100));
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.connect(ctx.destination);

  tone.play(ctx, gain);
}

export const ALERT_LEVELS: { id: AlertLevel; label: string; color: string }[] = [
  { id: 'critical', label: 'Critical', color: 'var(--red)' },
  { id: 'high', label: 'High', color: 'var(--semantic-high)' },
  { id: 'medium', label: 'Medium', color: 'var(--yellow)' },
  { id: 'low', label: 'Low / Info', color: 'var(--blue)' },
];
