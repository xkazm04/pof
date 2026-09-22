/**
 * Step-artifact SEEDS — pipeline step data derived from a reference row instead of produced
 * (/diablo W02b, operator decision D3). Every seed carries a `sourced` stamp, so its step can never
 * grade `pass` (`acceptance/sourced.ts`), and every field it deliberately does NOT write is returned
 * as a named gap — a seed never invents a number to complete a step.
 *
 * Numbers come from the reference's LAWS, parsed out of the canon rule that states them (registry:
 * design-canon-as-executable-law — one statement per law; edit the prose and the seed moves with it;
 * if the number cannot be found, fail loudly rather than fall back to a remembered value).
 */
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import type { ReferenceWrapper } from './wrapper';

export interface StepSeed {
  catalogId: string;
  entityId: string;
  step: string;
  data: Record<string, unknown>;
  /** Fields of this step the seed left unwritten, each with why. */
  gaps: string[];
}

/** Diablo I's monster resistance law, read from `d1-resistance-law`'s own text. */
export function resistanceLaw(): { normal: number; resist: number; immune: number } {
  const body = DIABLO1_CANON.find((r) => r.id === 'd1-resistance-law')?.body;
  if (!body) throw new Error('canon rule d1-resistance-law is missing — the resistance seed has no law to read');
  const m = /normal \((\d+)%\), resistant \((\d+)%\) or immune \((\d+)%\)/.exec(body);
  if (!m) throw new Error('d1-resistance-law no longer states "normal (N%), resistant (N%) or immune (N%)" — refusing to guess');
  return { normal: Number(m[1]), resist: Number(m[2]), immune: Number(m[3]) };
}

const ELEMENTS = ['MAGIC', 'FIRE', 'LIGHTNING'] as const;

/** Per-element reduction from a monstdat `resistance` flag list (`IMMUNE_MAGIC,RESIST_FIRE`). */
export function resistanceByElement(flags: string): Record<(typeof ELEMENTS)[number], number> {
  const law = resistanceLaw();
  const set = new Set(flags.split(',').map((f) => f.trim()).filter(Boolean));
  const out = {} as Record<(typeof ELEMENTS)[number], number>;
  for (const el of ELEMENTS) {
    out[el] = set.has(`IMMUNE_${el}`) ? law.immune : set.has(`RESIST_${el}`) ? law.resist : law.normal;
  }
  return out;
}

function stamp(w: ReferenceWrapper, columns: string[]): SourcedStamp {
  const p = w.entity.provenance;
  return { sourceGame: p.sourceGame, sourceFile: p.sourceFile, sourceRow: p.sourceRow, columns };
}

/**
 * Bestiary seeds for one monstdat wrapper: `Resistances` and `Monster Rarity`.
 * `monstdat` holds the ordinary monsters (uniques are a separate table), which is itself the fact
 * the rarity seed rests on.
 */
export function seedBestiarySteps(w: ReferenceWrapper): StepSeed[] {
  if (w.catalogId !== 'bestiary' || w.file !== 'monsters/monstdat.tsv') return [];
  const res = resistanceByElement(w.raw.resistance ?? '');
  return [
    {
      catalogId: 'bestiary', entityId: w.entity.id, step: 'Resistances',
      data: {
        resists: { fireRes: res.FIRE, lightningRes: res.LIGHTNING },
        // Diablo's third element has no PoF column; carried so it is not lost.
        magicRes: res.MAGIC,
        [SOURCED_FIELD]: stamp(w, ['resistance']),
      },
      gaps: [
        'iceRes: Diablo I (base game) has no cold damage — there is no source value, and 0 would claim a measurement',
        'chaosRes: Diablo I has no chaos element — same',
        'magicRes: Diablo’s magic element has no PoF resistance column (carried as an extra field)',
        'resistanceHell: per-difficulty resistances are not seeded — PoF entities are difficulty-flat',
      ],
    },
    {
      catalogId: 'bestiary', entityId: w.entity.id, step: 'Monster Rarity',
      data: {
        rarity: { rarityTier: 'Normal', lifeMultiplier: 1, modifiers: [] },
        [SOURCED_FIELD]: stamp(w, ['(table membership: monstdat holds the ordinary monsters)']),
      },
      gaps: [
        'modifiers: Diablo I ordinary monsters carry no modifiers — PoF’s step expects at least one (a genre assumption)',
        'rarityScale: Diablo I has no Magic/Rare monster tiers — its only other tier is the unique monster table',
      ],
    },
  ];
}
