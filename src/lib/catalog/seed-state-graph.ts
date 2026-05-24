import {
  ALL_MONTAGES,
  type MontageEntry,
} from '@/components/modules/core-engine/unique-tabs/AnimationStateGraph/data';
import type { AnimationEntry } from './types';

/** Convert one MontageEntry into a State Graph entry. */
export function montageToEntry(montage: MontageEntry): AnimationEntry {
  return {
    id: `anim-${montage.id}`,
    catalogId: 'state-graph',
    name: montage.name,
    categoryPath: ['Animations', montage.category],
    tags: [montage.hasRootMotion ? 'root-motion' : 'in-place'],
    lifecycle: 'planned',
    data: montage,
  };
}

/** Seed the state-graph catalog from ALL_MONTAGES. */
export function seedAnimationEntries(): AnimationEntry[] {
  return ALL_MONTAGES.map(montageToEntry);
}
