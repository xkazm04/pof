/**
 * DERIVED reference values (/diablo D29, W09): what PoF computes from an ingested row's MAPPED fields plus the
 * engine-derived laws of its canon profile, written into the projection as `data.derived` in the REFERENCE's own
 * units (ticks, tiles, seconds). Before this, W08's speed and cadence lived only in a UE script: the Stat Block said
 * "not in the reference", AI Behavior had nowhere to put it, and the columns they come from stayed mapped as gaps.
 *
 * A derivation is code, so its VERSION is part of the mapping version (`wrapTable`): the code revision plus the text of
 * every law it reads — edit a law and the rows re-project, instead of being skipped as "unchanged" (the W00 decoder
 * trap). An input that is missing, or a routine with no law yet, is a declared gap — never a number.
 */
import { contentHash } from './hash';
import { AI_LAW_IDS, behaviourLawTexts, expectedTicks, timingLaw } from './behaviourScale';

export interface DeriveSpec {
  /** Changes whenever the derivation's code or the laws it reads change. */
  version: () => string;
  derive: (entity: { tags?: string[]; data: Record<string, unknown> }) => Record<string, unknown>;
}

const CODE_REVISION = 'monster-timing@1';

const csv = (v: unknown): number[] | null => {
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = v.split(',').map((x) => Number(x.trim()));
  return n.every(Number.isFinite) ? n : null;
};

export const MONSTER_DERIVE: DeriveSpec = {
  version: () => contentHash({ code: CODE_REVISION, laws: behaviourLawTexts() }),
  derive: (e) => {
    const frames = csv(e.data.animFrames);
    const rates = csv(e.data.animRates);
    const action = Number(e.data.attackActionFrame);
    const intelligence = Number(e.data.intelligence);
    const ai = e.tags?.[0] ?? '';
    const missing = [
      !frames || frames.length < 3 ? 'animFrames' : '',
      !rates || rates.length < 3 ? 'animRates' : '',
      !Number.isFinite(action) ? 'attackActionFrame' : '',
      !Number.isFinite(intelligence) ? 'intelligence' : '',
      !ai ? 'ai (tags)' : '',
    ].filter(Boolean);
    if (missing.length) return { gap: `no derived timing: missing ${missing.join(', ')}` };
    try {
      const t = timingLaw();
      const ticks = expectedTicks({ walkFrames: frames![1], walkRate: rates![1], attackFrames: frames![2], attackRate: rates![2], actionFrame: action, ai, intelligence }, t.walkExtraTicks);
      return {
        laws: ['d1-timing-law', AI_LAW_IDS[ai]],
        walkTicksPerStep: ticks.step,
        tilesPerSecond: t.ticksPerSecond / ticks.step,
        attackCycleTicks: ticks.attack,
        attackCycleSeconds: ticks.attack / t.ticksPerSecond,
        hitDelaySeconds: (action * rates![2]) / t.ticksPerSecond,
      };
    } catch (err) {
      return { gap: (err as Error).message };
    }
  },
};
