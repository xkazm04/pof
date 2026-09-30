import type { ReverbPreset, OcclusionMode } from '@/types/audio-scene';

/**
 * The audio scene's acoustics tables — ONE authority per quantity. The UE codegen
 * (`audio-codegen.ts`) ships these rows as UReverbEffect / AAudioVolume settings,
 * and the painter's LISTEN mode (`audio-scene-audition.ts`) auditions the same
 * numbers, so what the designer hears is what UE is given.
 */

export interface ReverbParams {
  decayTime: number;
  diffusion: number;
  density: number;
  wetDry: number;
  earlyDelay: number;
  lateDelay: number;
}

// ─── Reverb parameter mapping ─────────────────────────────────────────────────

export const REVERB_PARAMS: Record<ReverbPreset, ReverbParams> = {
  'none':             { decayTime: 0.0, diffusion: 0.0, density: 0.0, wetDry: 0.0, earlyDelay: 0.0, lateDelay: 0.0 },
  'small-room':       { decayTime: 0.8, diffusion: 0.7, density: 0.8, wetDry: 0.3, earlyDelay: 0.005, lateDelay: 0.012 },
  'large-hall':       { decayTime: 2.5, diffusion: 0.9, density: 0.6, wetDry: 0.5, earlyDelay: 0.02, lateDelay: 0.04 },
  'cave':             { decayTime: 3.5, diffusion: 0.5, density: 0.9, wetDry: 0.6, earlyDelay: 0.03, lateDelay: 0.06 },
  'outdoor':          { decayTime: 0.3, diffusion: 1.0, density: 0.2, wetDry: 0.15, earlyDelay: 0.001, lateDelay: 0.005 },
  'underwater':       { decayTime: 4.0, diffusion: 0.3, density: 1.0, wetDry: 0.8, earlyDelay: 0.04, lateDelay: 0.08 },
  'metal-corridor':   { decayTime: 1.8, diffusion: 0.4, density: 0.7, wetDry: 0.45, earlyDelay: 0.008, lateDelay: 0.02 },
  'stone-chamber':    { decayTime: 2.2, diffusion: 0.6, density: 0.85, wetDry: 0.5, earlyDelay: 0.015, lateDelay: 0.035 },
  'forest':           { decayTime: 0.6, diffusion: 0.95, density: 0.3, wetDry: 0.2, earlyDelay: 0.002, lateDelay: 0.008 },
  'custom':           { decayTime: 1.0, diffusion: 0.5, density: 0.5, wetDry: 0.3, earlyDelay: 0.01, lateDelay: 0.02 },
};

// ─── Occlusion mapping ────────────────────────────────────────────────────────

/** Per occlusion mode: the volume factor AND the lowpass cutoff, moved as one row. */
export const OCCLUSION_VALUES: Record<OcclusionMode, { volume: number; lpf: number }> = {
  'none':   { volume: 1.0, lpf: 20000.0 },
  'low':    { volume: 0.85, lpf: 12000.0 },
  'medium': { volume: 0.6, lpf: 5000.0 },
  'high':   { volume: 0.35, lpf: 2000.0 },
  'full':   { volume: 0.1, lpf: 500.0 },
};
