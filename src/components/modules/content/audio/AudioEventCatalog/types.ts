import type { AudioAssetBindings } from '@/lib/audio-codegen';

// -- Types --

export type EventCategory = 'combat' | 'environment' | 'ui' | 'music';
export type SpatialMode = '2d' | '3d';
export type PriorityLevel = 'low' | 'normal' | 'high' | 'critical';

export interface AudioEvent {
  id: string;
  name: string;
  category: EventCategory;
  trigger: string;
  priority: PriorityLevel;
  spatial: SpatialMode;
  concurrency: number;
  cooldownMs: number;
  tags: string[];
  /**
   * The generated-audio library set (`audio_sets.id`) this event plays — the
   * same edge emitters use. Optional: rows persisted before it read unchanged.
   */
  assetSetId?: string | null;
}

export interface AudioEventCatalogConfig {
  events: AudioEvent[];
  /**
   * What the library knows about each bound set, keyed by set id. Present only
   * when the library was read; absent = today's prompt, with no per-event cue.
   */
  bindings?: AudioAssetBindings;
}
