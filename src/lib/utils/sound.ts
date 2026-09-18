"use client";

// Web Audio synthesiser for AuraMint haptics — zero asset downloads (important on
// Indian mobile data). Every sound is gated behind a persisted mute preference so a
// user who is done with the noise never hears it again, and no call can ever throw an
// unhandled rejection (resume() and oscillator scheduling used to be fire-and-forget).

const MUTE_KEY = "auramint:sound-muted";

let audioCtx: AudioContext | null = null;
const listeners = new Set<(muted: boolean) => void>();

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Persisted mute preference. Defaults to sound ON. */
export function isSoundMuted(): boolean {
  const store = safeStorage();
  if (!store) return false;
  try {
    return store.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  const store = safeStorage();
  try {
    store?.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* storage unavailable — keep the in-memory behaviour */
  }
  listeners.forEach((fn) => {
    try {
      fn(muted);
    } catch {
      /* listener errors must not break audio control */
    }
  });
}

export function toggleSoundMuted(): boolean {
  const next = !isSoundMuted();
  setSoundMuted(next);
  return next;
}

/** Subscribe to mute changes (used by the toggle UI). Returns an unsubscribe fn. */
export function subscribeSoundMuted(fn: (muted: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (isSoundMuted()) return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {
      /* autoplay policy — silently stay suspended */
    });
  }
  return audioCtx;
}

type ToneOptions = {
  type: OscillatorType;
  freq: number;
  endFreq?: number;
  at: number;
  duration: number;
  peak: number;
  detune?: number;
};

function scheduleTone(ctx: AudioContext, tone: ToneOptions): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = tone.type;
  if (tone.detune) osc.detune.setValueAtTime(tone.detune, tone.at);
  osc.frequency.setValueAtTime(tone.freq, tone.at);
  if (tone.endFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endFreq), tone.at + tone.duration);
  }

  gain.gain.setValueAtTime(0.0001, tone.at);
  gain.gain.exponentialRampToValueAtTime(tone.peak, tone.at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, tone.at + tone.duration);

  osc.start(tone.at);
  osc.stop(tone.at + tone.duration + 0.02);
}

/** Run a sound only when sound is enabled; never let Web Audio errors escape. */
function play(build: (ctx: AudioContext, now: number) => void): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    build(ctx, ctx.currentTime + 0.005);
  } catch {
    /* audio is decoration — never break the interaction */
  }
}

/** Short struck-brass ping. Use for presses, chips, navigation. */
export function playHapticPop(): void {
  play((ctx, now) => {
    scheduleTone(ctx, { type: "triangle", freq: 1180, endFreq: 720, at: now, duration: 0.11, peak: 0.045 });
    scheduleTone(ctx, { type: "sine", freq: 2360, at: now, duration: 0.06, peak: 0.02 });
  });
}

/** Rising major arpeggio for a positive mint. */
export function playAuraGainSound(): void {
  play((ctx, now) => {
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25]; // C4 E4 G4 C5 E5
    notes.forEach((freq, i) => {
      scheduleTone(ctx, {
        type: "triangle",
        freq,
        at: now + i * 0.075,
        duration: 0.24,
        peak: 0.06,
      });
    });
  });
}

/** Dull thud + downward slide for a loss. */
export function playAuraLossSound(): void {
  play((ctx, now) => {
    scheduleTone(ctx, { type: "sine", freq: 150, endFreq: 70, at: now, duration: 0.3, peak: 0.09 });
    scheduleTone(ctx, { type: "sawtooth", freq: 220, endFreq: 90, at: now, duration: 0.26, peak: 0.035 });
  });
}

/** Detuned rising sweep for the premium certificate. */
export function playPremiumUpgradeSound(): void {
  play((ctx, now) => {
    [-10, 0, 10].forEach((detune) => {
      scheduleTone(ctx, {
        type: "sine",
        freq: 330,
        endFreq: 880,
        at: now,
        duration: 1.2,
        peak: 0.055,
        detune,
      });
    });
  });
}
