/**
 * Disqualifier caps per craft lens — the level a fired disqualifier forces the gauge DOWN to.
 *
 * Each lens file ends its criteria with a numbered DISQUALIFIERS list and says "caps at A1"
 * (a few vfx entries say A2). Until this table existed that was prose only: an auditor could
 * record a finding for a fired disqualifier and still award A3, and nothing at the write door
 * could tell. Craft is not additive, so the cap has to be a level the door enforces, not a
 * sentence the auditor remembers.
 *
 * A finding names the disqualifier it reports by its 1-based position in the lens file's list
 * (`CraftFinding.disqualifier`). The lowest applicable cap wins; caps never stack.
 *
 * Pinned to the lens files by `lensDisqualifiers.test.ts` (count and cap wording), so editing a
 * lens's list without this table fails the build. Position is the id, so reordering a list is a
 * lens-version bump (see lens-versions.ts), exactly like any other change that could move a score.
 */
import type { GaugedCraftLevel } from '@/lib/status/craft';
import { craftRank } from '@/lib/status/craft';
import type { LensId } from './lens-map';

const A1 = 'A1' as const;
const A2 = 'A2' as const;

/** Cap level of disqualifier N (index N-1) per lens. */
export const LENS_DISQUALIFIER_CAPS: Record<LensId, readonly GaugedCraftLevel[]> = {
  'game-systems-code': [A1, A1, A1, A1, A1],
  narrative: [A1, A1, A1, A1, A1],
  dialogue: [A1, A1, A1, A1, A1],
  voiceover: [A1, A1, A1, A1, A1],
  audio: [A1, A1, A1, A1, A1],
  vfx: [A1, A2, A2, A2, A1],
  '2d-art': [A1, A1, A1, A1, A1],
  '3d-art': [A1, A1, A1, A1, A1],
  animation: [A1, A1, A1, A1, A1],
  'production-process': [A1, A1, A1, A1, A1],
};

/**
 * The strictest level the named disqualifiers allow, or `null` when none is named.
 * `unknown` lists any number that is not on the lens's list (the writer cited a disqualifier
 * the lens does not have — refused rather than silently ignored, since ignoring it would let
 * a typo lift the cap).
 */
export function disqualifierCap(
  lens: LensId,
  numbers: readonly number[],
): { cap: GaugedCraftLevel | null; unknown: number[] } {
  const caps = LENS_DISQUALIFIER_CAPS[lens];
  let cap: GaugedCraftLevel | null = null;
  const unknown: number[] = [];
  for (const n of numbers) {
    const c = Number.isInteger(n) ? caps[n - 1] : undefined;
    if (!c) { unknown.push(n); continue; }
    if (cap === null || craftRank(c) < craftRank(cap)) cap = c;
  }
  return { cap, unknown };
}
