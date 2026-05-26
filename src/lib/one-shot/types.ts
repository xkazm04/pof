import type { AcceptanceTier } from '@/lib/catalog/acceptance/types';
import type { ArchetypeId, ViewDescriptor } from '@/lib/catalog/stepSpec';

export type SkipDecision =
  | { mode: 'run-deterministic' }
  | { mode: 'run-cli' }
  | { mode: 'skip-needs-art' }
  | { mode: 'defer-runtime'; tier: 'L3' | 'L4' };

export interface CustomAutoHint { autoMode?: 'cli' | 'deterministic' | 'skip' }

export type { ArchetypeId, ViewDescriptor, AcceptanceTier };
