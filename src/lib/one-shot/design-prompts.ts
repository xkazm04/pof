import type { CatalogDistribution } from '@/lib/catalog/gap-analysis';
import { pluginFor } from '@/lib/catalog/gap-analysis/plugins';
import { arpgLawsRelevantTo } from './arpg-laws-map';
import { canonContextFor } from '@/lib/catalog/canon/canonContext';
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

function renderHistograms(dist: CatalogDistribution): string {
  return Object.entries(dist.byAttribute)
    .map(([attr, h]) => `  - by ${attr}: ${Object.entries(h).map(([k, v]) => `${k}: ${v}`).join(', ')}`)
    .join('\n');
}

function renderGaps(dist: CatalogDistribution): string {
  if (!dist.underrepresented.length) return '  (none — distribution looks balanced)';
  return dist.underrepresented
    .map((u) => `  - ${u.attribute}=${u.value}: expected ~${u.expected}, have ${u.count}`)
    .join('\n');
}

function renderSample(dist: CatalogDistribution): string {
  const plug = pluginFor(dist.catalogId);
  const fmt = plug?.summarize ?? ((d: unknown) => JSON.stringify(d));
  return dist.sample.map((e, i) => `${i + 1}. ${e.name} — ${fmt(e.data)} (id: ${e.id})`).join('\n');
}

export function buildProposalPrompt(
  catalogId: string,
  dist: CatalogDistribution,
  userHint?: string,
): string {
  const callbackId = nextCallbackId();
  const canon = canonContextFor(useCanonStore.getState().rules, catalogId, ['game', 'project', 'art']);
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

## User direction (optional)
${userHint ?? "designer's call — pick the highest-value gap"}

## Per-catalog output schema (your "data" payload must match this)
${schema}

## Task
Identify the most valuable gap and propose **one** new entity that fills it.
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
