import { type TextureChannel } from '../useMaterialStore';
import type { PbrUrlKey } from './types';

/** Reinforcement appended to a reroll prompt to bias Scenario toward a clean tile. */
export const SEAMLESS_HINT = 'seamless tileable, no visible seams';

export const PBR_MAP_CHANNELS: Array<{ id: string; channel: TextureChannel; key: PbrUrlKey; label: string }> = [
  { id: 'pbr-albedo', channel: 'albedo', key: 'albedoUrl', label: 'Albedo' },
  { id: 'pbr-normal', channel: 'normal', key: 'normalUrl', label: 'Normal' },
  { id: 'pbr-roughness', channel: 'roughness', key: 'roughnessUrl', label: 'Roughness' },
];

export const tileBtn =
  'flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium bg-[var(--visual-gen)]/10 text-[var(--visual-gen)] hover:bg-[var(--visual-gen)]/20 disabled:opacity-40';
export const tileInput = 'w-full rounded bg-black/30 border border-white/10 px-2 py-1.5 text-xs';
