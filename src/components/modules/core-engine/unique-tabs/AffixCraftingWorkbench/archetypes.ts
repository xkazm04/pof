import {
  STATUS_ERROR,
  ACCENT_EMERALD, ACCENT_CYAN,
} from '@/lib/chart-colors';
import type { AffixPoolEntry, Rarity, SynergyRule } from './data';
import { RARITIES, RARITY_AFFIX_COUNTS, SYNERGY_RULES } from './data';

/* ── Rarity Archetype Patterns ────────────────────────────────────── */

export interface RarityArchetype {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  color: string;
  affixTags: string[];
  synergies: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  offensive: STATUS_ERROR,
  defensive: ACCENT_EMERALD,
  utility: ACCENT_CYAN,
};

const ARCHETYPE_NAMES: Record<string, Record<string, string>> = {
  offensive: { broken: 'Glass Cannon', strong: 'DPS Specialist', default: 'Striker' },
  defensive: { broken: 'Immortal Tank', strong: 'Juggernaut', default: 'Guardian' },
  utility: { broken: 'Arcane Trickster', strong: 'Speedster', default: 'Utility Hybrid' },
};

/* Build a synergy graph from eligible affix tags. */
function buildSynergyGraph(eligibleTags: Set<string>) {
  const graph = new Map<string, { partners: Set<string>; rules: SynergyRule[] }>();
  for (const rule of SYNERGY_RULES) {
    const [a, b] = rule.affixTags;
    if (!eligibleTags.has(a) || !eligibleTags.has(b)) continue;
    if (!graph.has(a)) graph.set(a, { partners: new Set(), rules: [] });
    if (!graph.has(b)) graph.set(b, { partners: new Set(), rules: [] });
    graph.get(a)!.partners.add(b);
    graph.get(a)!.rules.push(rule);
    graph.get(b)!.partners.add(a);
    graph.get(b)!.rules.push(rule);
  }
  return graph;
}

/** Detect archetype patterns from pool for given rarity. */
export function detectArchetypes(pool: AffixPoolEntry[], rarity: Rarity): RarityArchetype[] {
  const rarityIdx = RARITIES.indexOf(rarity);
  const eligible = pool.filter(a => RARITIES.indexOf(a.minRarity) <= rarityIdx);
  const eligibleTags = new Set(eligible.map(a => a.tag));
  const maxSlots = RARITY_AFFIX_COUNTS[rarity].max;

  const archetypes: RarityArchetype[] = [];
  const synergyGraph = buildSynergyGraph(eligibleTags);
  const visited = new Set<string>();
  const sortedNodes = [...synergyGraph.entries()].sort((a, b) => b[1].partners.size - a[1].partners.size);

  for (const [root, { partners, rules }] of sortedNodes) {
    if (visited.has(root)) continue;

    const cluster = new Set<string>([root]);
    const clusterRules = new Set<string>();
    for (const p of partners) { if (cluster.size >= maxSlots) break; cluster.add(p); }

    // Dominant category
    const clusterAffixes = eligible.filter(a => cluster.has(a.tag));
    const counts = clusterAffixes.reduce<Record<string, number>>((acc, a) => { acc[a.category] = (acc[a.category] || 0) + 1; return acc; }, {});
    const dominantCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as 'offensive' | 'defensive' | 'utility' | undefined;

    // Fill remaining slots from same category
    if (cluster.size < maxSlots && dominantCategory) {
      for (const a of eligible) { if (cluster.size >= maxSlots) break; if (!cluster.has(a.tag) && a.category === dominantCategory) cluster.add(a.tag); }
    }

    for (const rule of SYNERGY_RULES) {
      if (cluster.has(rule.affixTags[0]) && cluster.has(rule.affixTags[1])) clusterRules.add(rule.label);
    }
    if (clusterRules.size === 0) continue;

    const bestSeverity = rules.some(r => r.severity === 'broken') ? 'broken' : rules.some(r => r.severity === 'strong') ? 'strong' : 'default';
    const cat = dominantCategory ?? 'offensive';
    const name = ARCHETYPE_NAMES[cat]?.[bestSeverity] ?? 'Hybrid Build';

    if (archetypes.some(a => a.name === name)) { visited.add(root); continue; }

    archetypes.push({
      id: `arch-${root}`, name,
      description: `${clusterRules.size} synergies, ${cluster.size} affixes, ${cat}-focused`,
      rarity, color: CATEGORY_COLORS[cat] ?? ACCENT_EMERALD,
      affixTags: [...cluster], synergies: [...clusterRules],
    });
    for (const tag of cluster) visited.add(tag);
  }

  return archetypes.slice(0, 4);
}
