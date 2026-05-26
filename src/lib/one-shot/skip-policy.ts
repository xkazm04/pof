import type { ArchetypeId, ViewDescriptor, AcceptanceTier, SkipDecision, CustomAutoHint } from './types';

export function decide(
  archetype: ArchetypeId,
  tier: AcceptanceTier,
  view: ViewDescriptor,
  hint?: CustomAutoHint,
): SkipDecision {
  if (archetype === 'gallery') return { mode: 'skip-needs-art' };
  if (tier === 'L3')           return { mode: 'defer-runtime', tier: 'L3' };
  if (tier === 'L4')           return { mode: 'defer-runtime', tier: 'L4' };
  if (archetype === 'brief')   return { mode: 'run-cli' };
  if (archetype === 'graph')   return { mode: 'run-cli' };
  if (archetype === 'rules' && view.kind === 'prose') return { mode: 'run-cli' };
  if (archetype === 'custom' && hint?.autoMode === 'cli')  return { mode: 'run-cli' };
  if (archetype === 'custom' && hint?.autoMode === 'skip') return { mode: 'skip-needs-art' };
  return { mode: 'run-deterministic' };
}
