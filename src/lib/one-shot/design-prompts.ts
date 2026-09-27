import { gapBasisOf, type CatalogDistribution } from '@/lib/catalog/gap-analysis';
import { pluginFor } from '@/lib/catalog/gap-analysis/plugins';
import { gapTargetLine, type GapTargetSpec } from '@/lib/catalog/gap-analysis/rankGaps';
import { arpgLawsRelevantTo } from './arpg-laws-map';
import { canonContextFor } from '@/lib/catalog/canon/canonContext';
import { DEFAULT_CANON_PROFILE, rulesForProfile } from '@/lib/catalog/canon/profiles';
import { useCanonStore } from '@/components/layout-lab/canonStore';
import type { OneShotProposal } from '@/stores/oneShotJobStore';

function nextCallbackId(): string {
  return `oneshot-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function dataSchemaFor(catalogId: string): string {
  const SCHEMAS: Record<string, string> = {
    items:    `{ name: string; data: { type: 'Weapon'|'Armor'|'Accessory'|'Consumable'|'Quest'|'Material'; subtype?: string; rarity: 'Common'|'Uncommon'|'Rare'|'Epic'|'Legendary'; level?: number; stats?: Array<{ label: string; value: string }>; affixes?: string[]; links?: Array<{ catalogId: string; entityId: string; role: string }> } }`,
    bestiary: `{ name: string; data: { tier: 'minion'|'standard'|'elite'|'boss'|'raid-boss'; role: 'melee'|'ranged'|'tank'|'caster'|'healer'|'swarm'; category?: string; abilities?: string[]; stats?: { hp: number; damage: number; speed: number; range: number } } }`,
  };
  return SCHEMAS[catalogId] ?? `{ name: string; data: Record<string, unknown> }`;
}

/** "(2 of 3 entities)" when a dimension is only partly carried; nothing when fully covered. */
function coverageNote(dist: CatalogDistribution, attr: string): string {
  const c = dist.coverage?.[attr];
  return c && c.covered < c.of ? ` (${c.covered} of ${c.of} entities)` : '';
}

function renderHistograms(dist: CatalogDistribution): string {
  const lines = Object.entries(dist.byAttribute)
    .map(([attr, h]) => `  - by ${attr}${coverageNote(dist, attr)}: ${Object.entries(h).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
  const unmeasured = dist.unmeasured ?? [];
  if (unmeasured.length) {
    lines.push(`  - not measured (0 of ${dist.total} entities carry ${unmeasured.join(', ')})`);
  }
  for (const d of dist.degenerate ?? []) {
    lines.push(`  - ${d}: every entity has its own value — an id list, not a distribution`);
  }
  return lines.length ? lines.join('\n') : '  (no dimension measured)';
}

/**
 * Under-represented rows are measured findings; an EMPTY list is only "balanced" when there was
 * an expected share to measure against. Without one (gap basis `none`, or a distribution persisted
 * before the basis existed) absence must read as absence — never as a finding of balance.
 */
function renderGaps(dist: CatalogDistribution): string {
  if (!dist.underrepresented.length) {
    return gapBasisOf(dist) === 'expected-share'
      ? '  (none — every declared expected share is within tolerance)'
      : '  (not measured — this catalog declares no expected share, so no gap was computed; this is NOT a finding of balance)';
  }
  return dist.underrepresented
    .map((u) => `  - ${u.attribute}=${u.value}: expected ~${u.expected}, have ${u.count}`)
    .join('\n');
}

function renderSample(dist: CatalogDistribution): string {
  const plug = pluginFor(dist.catalogId);
  const fmt = plug?.summarize ?? ((d: unknown) => JSON.stringify(d));
  return dist.sample.map((e, i) => `${i + 1}. ${e.name} — ${fmt(e.data)} (id: ${e.id})`).join('\n');
}

/**
 * The operator's picked gap, when there is one. Without a target the model picks the gap
 * itself (the pre-gap-first behaviour); with one, the ranking is already done — the prompt
 * must not hand that decision back to the model.
 */
function renderTarget(target: GapTargetSpec | undefined): string {
  if (!target) return '';
  return `## Target gap
The operator picked this gap to fill — design for it, do not choose another:
  - ${gapTargetLine(target)}

`;
}

export function buildProposalPrompt(
  catalogId: string,
  dist: CatalogDistribution,
  userHint?: string,
  target?: GapTargetSpec,
): string {
  const callbackId = nextCallbackId();
  // A NEW entity designed here is PoF's own, so its canon is the `pof` profile — never another
  // profile's world (the store holds every profile's rules).
  const canon = canonContextFor(rulesForProfile(useCanonStore.getState().rules, DEFAULT_CANON_PROFILE), catalogId, ['game', 'project', 'art']);
  const laws = arpgLawsRelevantTo(catalogId).join(', ');
  const schema = dataSchemaFor(catalogId);
  return `# DESIGN PROPOSAL — Catalog '${catalogId}'

## Project Canon
${canon}

## Relevant ARPG laws
${laws}

## Catalog state (auto-computed)
- Total entities: ${dist.total}
- Distribution by primary attributes:
${renderHistograms(dist)}
- Under-represented niches:
${renderGaps(dist)}

## Existing entities (stratified sample of ${dist.sample.length})
${renderSample(dist)}

${renderTarget(target)}## User direction (optional)
${userHint ?? (target ? '(none beyond the target gap)' : "designer's call — pick the highest-value gap")}

## Per-catalog output schema (your "data" payload must match this)
${schema}

## Task
${target ? 'Propose **one** new entity that fills the Target gap above.' : 'Identify the most valuable gap and propose **one** new entity that fills it.'}
HARD RULES:
1. Obey Project Canon + ARPG laws strictly. Numerics within the seeded min/max bands.
2. Cross-catalog references must use REAL seeded ids (sample shows real ids).
3. Non-derivative — not a near-clone of any sample entity.
4. The entity is a draft; do not invent UE assets, only their planned names per \`proj-naming\`.

## Output (BOTH required)
1. A markdown **Rationale** (≤220 words): the gap, why this fills it, the design tradeoffs.
2. The structured proposal via:
@@CALLBACK:${callbackId}
{
  "name": "<display name>",
  "data": { /* matches the per-catalog schema above */ }
}
@@END_CALLBACK
`;
}

export function buildRefinePrompt(
  catalogId: string,
  dist: CatalogDistribution,
  prior: OneShotProposal,
  userInput: string,
): string {
  const base = buildProposalPrompt(catalogId, dist);
  return `${base}

## Prior proposal
Name: ${prior.name}
Data: ${JSON.stringify(prior.data, null, 2)}
Rationale:
${prior.rationale}

## User adjustment
${userInput}

Apply the adjustment, keeping HARD RULES 1–4. Output a revised Rationale + revised @@CALLBACK block.
`;
}
