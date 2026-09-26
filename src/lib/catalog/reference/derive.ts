/**
 * DERIVED reference values (/diablo D29, W09): what PoF computes from an ingested row's MAPPED fields plus the
 * engine-derived laws of its canon profile, written into the projection as `data.derived` in the REFERENCE's own
 * units (ticks, tiles, seconds). `locomotion` is the animation-only upper bound and exists for every monster with walk
 * data; the established top-level walk speed remains the effective approach speed after routine decision cadence.
 * Before this, W08's speed and cadence lived only in a UE script: the Stat Block said "not in the reference", AI
 * Behavior had nowhere to put it, and the columns they come from stayed mapped as gaps.
 *
 * A derivation is code, so its VERSION is part of the mapping version (`wrapTable`): the code revision plus the text of
 * every law and structured routine entry it reads — edit either and the rows re-project, instead of being skipped as
 * "unchanged" (the W00 decoder trap). A missing input, or a routine with no cadence model yet, leaves its affected
 * fields as a declared gap — never a guessed number.
 */
import { contentHash } from '@/lib/catalog/reference/hash';
import { AI_LAW_IDS, attackKindsOf, behaviourLawTexts, expectedTicks, timingLaw, walkTicksPerStep } from '@/lib/catalog/reference/behaviourScale';
import { AFFIX_POWERS, affixTargetsOf } from '@/lib/catalog/ingest/diablo1Affixes';

export interface DeriveSpec {
  /** Changes whenever the derivation's code or the laws it reads change. */
  version: () => string;
  derive: (entity: { id: string; tags?: string[]; data: Record<string, unknown> }) => Record<string, unknown>;
}

const CODE_REVISION = 'monster-timing@2';

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
    const ai = e.tags?.[0] ?? '';
    const locomotionMissing = [
      !frames || frames.length < 2 ? 'animFrames' : '',
      !rates || rates.length < 2 ? 'animRates' : '',
    ].filter(Boolean);
    if (locomotionMissing.length) return { gap: `no derived locomotion: missing ${locomotionMissing.join(', ')}` };

    const t = timingLaw();
    const walkTicks = walkTicksPerStep({ walkFrames: frames![1], walkRate: rates![1] }, t.walkExtraTicks);
    const locomotion = {
      laws: ['d1-timing-law'],
      walkTicksPerStep: walkTicks,
      tilesPerSecondWhileWalking: t.ticksPerSecond / walkTicks,
    };
    let attackKinds: ReturnType<typeof attackKindsOf>;
    try {
      attackKinds = attackKindsOf(ai);
    } catch (err) {
      return {
        locomotion,
        gap: `${(err as Error).message}; only the while-walking upper bound is known — effective tilesPerSecond needs the routine's cadence model`,
      };
    }

    const base = {
      laws: ['d1-timing-law', AI_LAW_IDS[ai]],
      attackKinds,
      locomotion,
    };
    const action = Number(e.data.attackActionFrame);
    const intelligence = Number(e.data.intelligence);
    const cadenceMissing = [
      frames!.length < 3 ? 'animFrames' : '',
      rates!.length < 3 ? 'animRates' : '',
      !Number.isFinite(action) ? 'attackActionFrame' : '',
      !Number.isFinite(intelligence) ? 'intelligence' : '',
    ].filter(Boolean);
    if (cadenceMissing.length) {
      return {
        ...base,
        gap: `no derived cadence: missing ${cadenceMissing.join(', ')}; only the while-walking upper bound is known — effective tilesPerSecond needs the routine's cadence model`,
      };
    }

    const hitDelaySeconds = (action * rates![2]) / t.ticksPerSecond;
    try {
      const ticks = expectedTicks({ walkFrames: frames![1], walkRate: rates![1], attackFrames: frames![2], attackRate: rates![2], actionFrame: action, ai, intelligence }, t.walkExtraTicks);
      return {
        ...base,
        walkTicksPerStep: ticks.step,
        tilesPerSecond: t.ticksPerSecond / ticks.step,
        attackCycleTicks: ticks.attack,
        attackCycleSeconds: ticks.attack / t.ticksPerSecond,
        hitDelaySeconds,
      };
    } catch (err) {
      // The gap applies only to routine cadence. Locomotion, attack kinds and animation hit timing remain valid.
      return {
        ...base,
        hitDelaySeconds,
        gap: `${(err as Error).message}; only the while-walking upper bound is known — effective tilesPerSecond needs the routine's cadence model`,
      };
    }
  },
};

/**
 * An affix tier's derived facts (/diablo W11, D1): its SIDE — the table it comes from (prefix or suffix), which is not a
 * column — and what its power modifies in PoF, from the power vocabulary (`diablo1Affixes.AFFIX_POWERS`). An unknown power
 * is a declared gap naming it (an upstream addition must surface, never map silently).
 */
export function affixDerive(side: 'prefix' | 'suffix'): DeriveSpec {
  return {
    version: () => contentHash({ code: 'affix-tier@1', side, powers: AFFIX_POWERS }),
    derive: (e) => {
      const power = typeof e.data.power === 'string' ? e.data.power : '';
      const t = affixTargetsOf(power);
      if (!t) return { side, gap: `power "${power}" is not in the affix power vocabulary (diablo1Affixes.AFFIX_POWERS)` };
      return { side, targets: t.targets, sign: t.sign, grade: t.grade, reason: t.reason };
    },
  };
}
