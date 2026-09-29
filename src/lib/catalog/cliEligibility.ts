import type { ArchetypeId } from './stepSpec';

/**
 * The ONE answer to "can a model author this step" — shared by the lab's Produce panel
 * (`labProduceMode` re-exports it) and one-shot's run plan (`skip-policy.decide` honours an
 * operator's per-step author choice only for these archetypes).
 *
 * These are the archetypes whose Produce is a TEXT deliverable a CLI session can actually author
 * end to end (a brief's prose, a graph's nodes/edges, a rules body). Generative galleries, UE
 * packaging and balance math are produced by other engines (Leonardo/Tripo, the gate drain,
 * deterministic code), so routing them through a text CLI would overclaim.
 */
export const CLI_ELIGIBLE_ARCHETYPES: readonly ArchetypeId[] = ['brief', 'graph', 'rules'];

export function isCliEligible(archetype: ArchetypeId): boolean {
  return CLI_ELIGIBLE_ARCHETYPES.includes(archetype);
}
