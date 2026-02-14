// ── Audio zone & emitter types for the Spatial Audio Scene Painter ──

export type AudioZoneShape = 'rect' | 'circle';
export type ReverbPreset =
  | 'none'
  | 'small-room'
  | 'large-hall'
  | 'cave'
  | 'outdoor'
  | 'underwater'
  | 'metal-corridor'
  | 'stone-chamber'
  | 'forest'
  | 'custom';

export type EmitterType =
  | 'ambient'
  | 'point'
  | 'loop'
  | 'oneshot'
  | 'music';

export type OcclusionMode = 'none' | 'low' | 'medium' | 'high' | 'full';

export interface AudioZone {
  id: string;
  name: string;
  /** Visual shape on the 2D canvas */
  shape: AudioZoneShape;
  /** Position in the painter canvas */
  x: number;
  y: number;
  /** Width (rect) or diameter (circle) */
  width: number;
  /** Height (rect only, ignored for circle) */
  height: number;
  /** Natural language soundscape description */
  soundscapeDescription: string;
  /** Reverb preset for this zone */
  reverbPreset: ReverbPreset;
  /** Custom reverb parameters (when preset is 'custom') */
  reverbDecayTime: number;
  reverbDiffusion: number;
  reverbWetDry: number;
  /** Attenuation — max distance in UE units */
  attenuationRadius: number;
  /** Occlusion configuration */
  occlusionMode: OcclusionMode;
  /** Priority (0=lowest, 10=highest) */
  priority: number;
  /** Accent color for visual display */
  color: string;
  /** Linked C++ files */
  linkedFiles: string[];
}

export interface SoundEmitter {
  id: string;
  name: string;
  type: EmitterType;
  /** Position in the painter canvas */
  x: number;
  y: number;
  /** Sound Cue asset reference */
  soundCueRef: string;
  /** Attenuation radius (visual circle on canvas) */
  attenuationRadius: number;
  /** Volume multiplier (0-2) */
  volumeMultiplier: number;
  /** Pitch range for randomization */
  pitchMin: number;
  pitchMax: number;
  /** Spawn probability per trigger (0-1) */
  spawnChance: number;
  /** Cooldown between triggers in seconds */
  cooldownSeconds: number;
  /** Zone this emitter belongs to (optional) */
  zoneId: string | null;
}

// ── Audio Scene Document ──

export interface AudioSceneDocument {
  id: number;
  name: string;
  description: string;
  zones: AudioZone[];
  emitters: SoundEmitter[];
  /** Global settings */
  globalReverbPreset: ReverbPreset;
  soundPoolSize: number;
  maxConcurrentSounds: number;
  /** Generation tracking */
  lastGeneratedAt: string | null;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

// ── Summary ──

export interface AudioSceneSummary {
  totalScenes: number;
  totalZones: number;
  totalEmitters: number;
  zonesByReverb: Record<string, number>;
  emittersByType: Record<EmitterType, number>;
}

// ── API payloads ──

export interface CreateAudioScenePayload {
  name: string;
  description?: string;
}

export interface UpdateAudioScenePayload {
  id: number;
  name?: string;
  description?: string;
  zones?: AudioZone[];
  emitters?: SoundEmitter[];
  globalReverbPreset?: ReverbPreset;
  soundPoolSize?: number;
  maxConcurrentSounds?: number;
  lastGeneratedAt?: string;
}
