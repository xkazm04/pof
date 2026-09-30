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
  /**
   * The level-design room this zone was generated from (level -> audio sync).
   * Additive and optional: a hand-drawn zone has none, and rows written before
   * the field existed read unchanged.
   */
  sourceRoomId?: string;
  /**
   * What the generator derived when it last wrote this zone. The sync compares
   * the zone against it to tell a hand-tuned field (zone != stamp: kept) from a
   * level edit (stamp != new derivation: updated). See `spatial-audio-sync.ts`.
   */
  derivedFrom?: ZoneDerivation;
  // NOTE: `linkedFiles` was DELETED 2026-08-19. It was a previous attempt at the
  // asset↔scene edge — written (`[]`, or copied off a level-design room) by the
  // painter and the spatial-audio generator, then never read by anything. The
  // real edge is `SoundEmitter.assetSetId`. Zone blobs already on disk still
  // carry the key; `rowToDoc` JSON.parses the blob as-is, so extra keys are
  // simply not surfaced (proved by audio-zone-legacy-blob.test.ts). Do not
  // reintroduce it — bind assets through the emitter.
}

export interface SoundEmitter {
  id: string;
  name: string;
  type: EmitterType;
  /** Position in the painter canvas */
  x: number;
  y: number;
  /**
   * Sound Cue asset path, typed by hand. The MANUAL OVERRIDE: it wins over
   * {@link assetSetId} in codegen, and is not verified against anything.
   */
  soundCueRef: string;
  /**
   * The generated audio set (`audio_sets.id`) this emitter is bound to.
   *
   * Additive and nullable — scenes written before this field read unchanged, and
   * an emitter with no binding behaves exactly as it always did. Codegen resolves
   * the bound set's last recorded UE import to a REAL cue path; when the set has
   * never been imported it says so rather than emitting a guess as if it were an
   * asset that exists.
   */
  assetSetId?: string | null;
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
  /** The level-design room this emitter was generated from (level -> audio sync). */
  sourceRoomId?: string;
  /** What the generator derived when it last wrote this emitter (see AudioZone.derivedFrom). */
  derivedFrom?: EmitterDerivation;
}

// ── Level -> audio sync (spatial-audio-sync.ts) ──

/** Zone fields the level derives; everything else on a zone is the painter's alone. */
export type SyncedZoneField =
  | 'name' | 'shape' | 'x' | 'y' | 'width' | 'height' | 'soundscapeDescription'
  | 'reverbPreset' | 'reverbDecayTime' | 'reverbDiffusion' | 'reverbWetDry'
  | 'attenuationRadius' | 'occlusionMode' | 'priority' | 'color';
/** Emitter fields the level derives (`assetSetId` and `zoneId` never are). */
export type SyncedEmitterField =
  | 'name' | 'type' | 'x' | 'y' | 'soundCueRef' | 'attenuationRadius' | 'volumeMultiplier'
  | 'pitchMin' | 'pitchMax' | 'spawnChance' | 'cooldownSeconds';

/** A zone's derivation stamp, plus the emitter ids generated with it (a deleted one stays deleted). */
export type ZoneDerivation = Pick<AudioZone, SyncedZoneField> & { emitterIds: string[] };
export type EmitterDerivation = Pick<SoundEmitter, SyncedEmitterField>;

/**
 * One room's fate in a sync: `new` (no zone yet), `unchanged` (in sync),
 * `updated` (the level changed and the zone is untouched), `kept` (hand-tuned,
 * left alone unless overwritten), `orphaned` (the room left the level; nothing
 * is deleted).
 */
export type LevelAudioSyncStatus = 'new' | 'unchanged' | 'updated' | 'kept' | 'orphaned';

export interface LevelAudioSyncRow {
  roomId: string;
  roomName: string;
  zoneId: string;
  status: LevelAudioSyncStatus;
  /** `kept`: the hand-tuned fields. `updated`: the fields the level changed. */
  fields: string[];
  /** Hand-tuned (or deleted) emitters of this room that the sync leaves alone. */
  keptEmitters: string[];
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
