import { storageGet, storageSet } from "./useRoom";

/**
 * Small synthesized sound effects (Web Audio, no files to download).
 * iOS only allows audio after a user gesture, so the context is created on
 * the first tap. The "ambient" session respects the phone's silent switch.
 */

const KEY = "sh:sound";
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let enabled = storageGet(KEY) !== "off";
const listeners = new Set<(on: boolean) => void>();

export function soundEnabled() {
  return enabled;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  storageSet(KEY, on ? "on" : "off");
  listeners.forEach((l) => l(on));
  if (on) unlock();
}

export function onSoundChange(l: (on: boolean) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function unlock() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "ambient";
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
  } catch {
    ctx = null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlock, { capture: true });
}

function ready(): AudioContext | null {
  return enabled && ctx && ctx.state === "running" ? ctx : null;
}

/** A filtered noise burst: card flicks, slides, shuffles. */
function noiseBurst(opts: { at?: number; dur: number; freq: number; q?: number; gain: number; sweepTo?: number }) {
  const c = ready();
  if (!c || !noise) return;
  const t = c.currentTime + (opts.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noise;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(opts.freq, t);
  if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
  filter.Q.value = opts.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + opts.dur + 0.05);
}

/** A pitched tone with a quick envelope. */
function tone(opts: { at?: number; dur: number; freq: number; to?: number; type?: OscillatorType; gain: number }) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + (opts.at ?? 0);
  const osc = c.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + opts.dur + 0.05);
}

export const sfx = {
  flip(at = 0) {
    noiseBurst({ at, dur: 0.07, freq: 2800, q: 0.8, gain: 0.35 });
  },
  slide(at = 0) {
    noiseBurst({ at, dur: 0.22, freq: 1800, sweepTo: 700, q: 0.7, gain: 0.18 });
  },
  deal(count: number) {
    for (let i = 0; i < count; i++) noiseBurst({ at: i * 0.08, dur: 0.09, freq: 2400, q: 0.9, gain: 0.2 });
  },
  shuffle() {
    for (let i = 0; i < 14; i++) noiseBurst({ at: i * 0.035, dur: 0.05, freq: 2000 + Math.random() * 1500, gain: 0.15 });
  },
  stamp(at = 0) {
    tone({ at, dur: 0.25, freq: 120, to: 45, type: "sine", gain: 0.9 });
    noiseBurst({ at, dur: 0.08, freq: 600, q: 0.6, gain: 0.5 });
  },
  chime() {
    tone({ dur: 0.5, freq: 880, gain: 0.18 });
    tone({ at: 0.12, dur: 0.6, freq: 1318.5, gain: 0.14 });
  },
  shot() {
    noiseBurst({ dur: 0.35, freq: 900, sweepTo: 200, q: 0.4, gain: 1 });
    tone({ dur: 0.3, freq: 90, to: 30, gain: 0.8 });
  },
  rumble() {
    tone({ dur: 1.0, freq: 55, to: 35, type: "sawtooth", gain: 0.25 });
    noiseBurst({ dur: 0.9, freq: 200, q: 0.5, gain: 0.4 });
  },
  fanfare(happy: boolean) {
    const notes = happy ? [523.25, 659.25, 783.99, 1046.5] : [440, 415.3, 392, 293.66];
    notes.forEach((f, i) => tone({ at: i * 0.16, dur: 0.45, freq: f, type: "triangle", gain: 0.25 }));
  },
};
