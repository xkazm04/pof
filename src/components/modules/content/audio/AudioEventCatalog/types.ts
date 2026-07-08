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
}

export interface AudioEventCatalogConfig {
  events: AudioEvent[];
}
