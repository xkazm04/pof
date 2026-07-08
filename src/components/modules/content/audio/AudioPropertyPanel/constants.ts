import type { ReverbPreset, OcclusionMode, EmitterType } from '@/types/audio-scene';

export const REVERB_PRESETS: ReverbPreset[] = [
  'none', 'small-room', 'large-hall', 'cave', 'outdoor',
  'underwater', 'metal-corridor', 'stone-chamber', 'forest', 'custom',
];

export const OCCLUSION_MODES: OcclusionMode[] = ['none', 'low', 'medium', 'high', 'full'];

export const EMITTER_TYPES: EmitterType[] = ['ambient', 'point', 'loop', 'oneshot', 'music'];
