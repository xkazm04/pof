/**
 * Affix FAMILIES from Diablo's tier rows (/diablo W11, D1). A Diablo affix row is ONE TIER (Bronze / Iron / Steel to-hit are
 * three rows of the TOHIT power); PoF's affix entity is the family with its tiers (the unit a designer authors, the
 * registry's family-plus-tiers view). Rows aggregate per (side, power) into one entity — a pseudo-wrapper, so promotion goes
 * through the same guarded door as any other (`promoteWrappers`) — and the family's steps are seeded from its tiers.
 * A curse (`X_CURSE`) is its own family: in UE one family (AffixGroup) must not mix a bonus and a penalty.
 */
import type { ReferenceWrapper } from './wrapper';
import type { StepSeed } from './stepSeeds';
import { SOURCED_FIELD } from '@/lib/catalog/acceptance/sourced';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

interface Tier { name: string; valueMin: number; valueMax: number; minItemLevel: number; weight: number; itemTypes: string[]; alignment: string; row: string }
type FamilyEntity = ReferenceWrapper['entity'];

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** One family pseudo-wrapper per (side, power), its tiers ordered by the item level that unlocks them. */
export function affixFamilies(wrappers: readonly ReferenceWrapper[]): { catalogId: 'affixes'; entity: FamilyEntity }[] {
  const groups = new Map<string, { side: string; power: string; derived: Record<string, unknown>; tiers: Tier[]; files: Set<string>; first: ReferenceWrapper }>();
  for (const w of wrappers) {
    if (w.catalogId !== 'affixes') continue;
    const d = w.entity.data;
    const derived = (d.derived ?? {}) as Record<string, unknown>;
    const side = String(derived.side ?? '');
    const power = String(d.power ?? '');
    if (!side || !power) continue;
    const key = `${side}:${power}`;
    if (!groups.has(key)) groups.set(key, { side, power, derived, tiers: [], files: new Set(), first: w });
    const g = groups.get(key)!;
    g.files.add(w.file);
    g.tiers.push({
      name: w.entity.name, valueMin: n(d.valueMin), valueMax: n(d.valueMax), minItemLevel: n(d.minItemLevel), weight: n(d.weight),
      itemTypes: Array.isArray(d.itemTypes) ? (d.itemTypes as string[]) : [], alignment: String(d.alignment ?? ''), row: w.entity.provenance?.sourceRow ?? w.key,
    });
  }
  return [...groups.values()].map((g) => {
    const tiers = [...g.tiers].sort((a, b) => a.minItemLevel - b.minItemLevel || a.valueMax - b.valueMax);
    const prov = g.first.entity.provenance;
    return {
      catalogId: 'affixes' as const,
      entity: {
        ...g.first.entity,
        id: `d1-affix-${g.side}-${g.power.toLowerCase()}`,
        name: `${g.power} (${g.side})`,
        tags: [g.side, g.power],
        links: [],
        data: { power: g.power, side: g.side, derived: g.derived, tiers },
        ...(prov ? { provenance: { ...prov, sourceFile: [...g.files].join(', '), sourceRow: tiers.map((t) => t.row).join('; ') } } : {}),
      },
    };
  });
}

/** SOURCED seeds for a family's steps — the shape the affixes pipeline grades; a power with no PoF home is a gap. */
export function seedAffixSteps(e: FamilyEntity): StepSeed[] {
  const d = e.data as { power: string; side: string; derived: Record<string, unknown>; tiers: Tier[] };
  const targets = Array.isArray(d.derived.targets) ? (d.derived.targets as string[]) : [];
  const stamp = { sourceGame: e.provenance?.sourceGame ?? '', sourceFile: e.provenance?.sourceFile ?? '', sourceRow: e.provenance?.sourceRow ?? '', columns: ['power', 'power.value1', 'power.value2', 'minLevel', 'itemTypes', 'chance'] };
  const gaps: string[] = [];
  if (!targets.length) gaps.push(`statTarget: ${String(d.derived.reason ?? d.derived.gap ?? 'no PoF home')}`);
  gaps.push('minRarity: a Diablo magic item takes any affix; the family is gated by item level, not rarity');
  return [
    {
      catalogId: 'affixes', entityId: e.id, step: 'Affix Definition',
      data: {
        affix: {
          affixTag: `Affix.D1.${d.power}`,
          displayName: e.name,
          isPrefix: d.side === 'prefix',
          group: d.power,
          statTarget: targets.length ? targets.join(' + ') : REFERENCE_GAP,
          minRarity: REFERENCE_GAP,
          weight: d.tiers.reduce((s, t) => s + t.weight, 0),
          sign: d.derived.sign,
        },
        [SOURCED_FIELD]: stamp,
      },
      gaps,
    },
    {
      catalogId: 'affixes', entityId: e.id, step: 'Tiers & Item Level',
      data: { tiers: d.tiers.map((t, i) => ({ tier: i + 1, name: t.name, minItemLevel: t.minItemLevel, valueMin: t.valueMin, valueMax: t.valueMax, weight: t.weight })), [SOURCED_FIELD]: stamp },
      gaps: [],
    },
    {
      catalogId: 'affixes', entityId: e.id, step: 'Spawn Rules',
      data: { spawn: { itemTypes: [...new Set(d.tiers.flatMap((t) => t.itemTypes))], notes: `Diablo I ${d.side} tiers: ${d.tiers.map((t) => t.name).join(', ')}` }, [SOURCED_FIELD]: stamp },
      gaps: [],
    },
  ];
}
