import { MODULE_COLORS } from '@/lib/chart-colors';
import type { ParsedAbility, ParsedUE5Data } from '@/lib/ue5-source-parser';
import type { AbilityEntry } from '@/lib/catalog/types';
import {
  CORE_ATTRIBUTES, DERIVED_ATTRIBUTES, TAG_TREE, TAG_DEP_NODES, TAG_DEP_EDGES,
  TAG_AUDIT_CATEGORIES, TAG_USAGE_FREQUENCY, TAG_DETAIL_MAP, EXPANDED_EFFECTS, COMBO_ABILITIES,
  buildLiveTagTree, buildLiveTagDeps, buildLiveTagDetailMap, buildLiveTagUsageFrequency,
  buildLiveTagAudit, buildLiveTagAuditCategories, buildLiveAttributes,
  type SpellbookAbility, type TagDetail, type TagNode,
} from './data';
import type {
  SpellbookCooldownRow, SpellbookDatasetKey, SpellbookProvenance, SpellbookView,
} from './types';

/**
 * The ONE spellbook projection. Pure (no React, no I/O) so it runs in vitest.
 *
 * Ownership split: the catalog (`entries`) owns every number — cooldown, radar,
 * mana cost; parsed C++ (`live`) owns the vocabulary — tags, deps, attributes,
 * audit, and which abilities exist in the game. Every dataset carries its source
 * in `provenance`. `useSpellbookData()`'s no-provider fallback is this function
 * called with `live: null`, so there is no second hand-typed literal.
 */
export interface SpellbookViewInput {
  live: ParsedUE5Data | null;
  appTags: readonly string[];
  entries: readonly AbilityEntry[];
}

const catalogRow = (a: SpellbookAbility): SpellbookCooldownRow =>
  ({ id: a.id, name: a.name, cd: a.cooldown, color: a.color });

/**
 * Live Cooldown Flow rows: the C++ player abilities that carry a cooldown tag, joined
 * to the catalog on `abilityTag === entry.data.tag`. An unmatched ability's duration
 * lives only in its GE blueprint, so its `cd` is `null` (unknown), never 0.
 */
function liveCooldownRows(abilities: ParsedAbility[], byTag: Map<string, SpellbookAbility>): SpellbookCooldownRow[] {
  const rows: SpellbookCooldownRow[] = [];
  const seen = new Set<string>();
  for (const ab of abilities) {
    if (!ab.cooldownTag || !ab.isPlayerAbility) continue;
    const match = ab.abilityTag ? byTag.get(ab.abilityTag) : undefined;
    const row = match
      ? catalogRow(match)
      : { id: `ue:${ab.className}`, name: ab.displayName, cd: null, color: MODULE_COLORS.systems };
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  return rows;
}

/** Overlay catalog numbers (cooldown seconds, mana cost) onto tag details whose tag is a catalog ability. */
function withCatalogNumbers(map: Record<string, TagDetail>, byTag: Map<string, SpellbookAbility>): Record<string, TagDetail> {
  const out: Record<string, TagDetail> = { ...map };
  for (const [key, detail] of Object.entries(map)) {
    const a = byTag.get(key);
    if (!a) continue;
    const cdTag = detail.cooldown?.replace(/\s*\(.*\)$/, '');
    const cooldown = a.cooldown > 0 ? `${cdTag ?? 'Cooldown'} (${a.cooldown}s)` : cdTag;
    out[key] = { ...detail, cooldown, manaCost: a.manaCost };
  }
  return out;
}

export function buildSpellbookView({ live, appTags, entries }: SpellbookViewInput): SpellbookView {
  const ABILITIES = entries.map((e) => e.data);
  const byTag = new Map(ABILITIES.map((a) => [a.tag, a]));

  const radarOf = (list: SpellbookAbility[]) =>
    list.map((a) => ({ name: a.name, color: a.color, values: [...a.radar] }));

  if (!live || live.tags.length === 0) {
    return {
      isLive: false, parsedAt: null,
      CORE_ATTRIBUTES, DERIVED_ATTRIBUTES, TAG_TREE, TAG_DEP_NODES, TAG_DEP_EDGES,
      TAG_AUDIT_CATEGORIES, TAG_USAGE_FREQUENCY, TAG_AUDIT: null,
      TAG_DETAIL_MAP: withCatalogNumbers(TAG_DETAIL_MAP, byTag),
      COOLDOWN_ABILITIES: ABILITIES.filter((a) => a.cooldown > 0).map(catalogRow),
      ABILITY_RADAR_DATA: radarOf(ABILITIES),
      ABILITIES, EFFECTS: EXPANDED_EFFECTS,
      provenance: provenanceFor({ vocab: 'illustrative', core: false, derived: false }),
    };
  }

  const attrs = buildLiveAttributes(live.tags);
  const deps = buildLiveTagDeps(live.abilities, live.tags);
  const audit = buildLiveTagAudit(live.abilities, live.tags, appTags);
  // Abilities C++ declares come first on the radar; the catalog still supplies every value.
  const liveTags = new Set(live.abilities.map((a) => a.abilityTag).filter(Boolean));
  const radarOrder = [...ABILITIES].sort((a, b) => Number(liveTags.has(b.tag)) - Number(liveTags.has(a.tag)));

  return {
    isLive: true, parsedAt: live.parsedAt,
    CORE_ATTRIBUTES: attrs.core,
    DERIVED_ATTRIBUTES: attrs.derived,
    TAG_TREE: buildLiveTagTree(live.tags),
    TAG_DEP_NODES: deps.nodes,
    TAG_DEP_EDGES: deps.edges,
    TAG_AUDIT: audit,
    TAG_AUDIT_CATEGORIES: buildLiveTagAuditCategories(audit),
    TAG_USAGE_FREQUENCY: buildLiveTagUsageFrequency(live.abilities, live.tags),
    TAG_DETAIL_MAP: withCatalogNumbers(buildLiveTagDetailMap(live.abilities, live.tags), byTag),
    COOLDOWN_ABILITIES: liveCooldownRows(live.abilities, byTag),
    ABILITY_RADAR_DATA: radarOf(radarOrder),
    ABILITIES, EFFECTS: EXPANDED_EFFECTS,
    // buildLiveAttributes falls back to the static lists when no Data.Init.* tag was parsed.
    provenance: provenanceFor({
      vocab: 'ue-source', core: attrs.core !== CORE_ATTRIBUTES, derived: attrs.derived !== DERIVED_ATTRIBUTES,
    }),
  };
}

function provenanceFor(o: { vocab: SpellbookProvenance; core: boolean; derived: boolean }): Record<SpellbookDatasetKey, SpellbookProvenance> {
  return {
    CORE_ATTRIBUTES: o.core ? 'ue-source' : 'illustrative',
    DERIVED_ATTRIBUTES: o.derived ? 'ue-source' : 'illustrative',
    TAG_TREE: o.vocab, TAG_DEP_NODES: o.vocab, TAG_DEP_EDGES: o.vocab,
    TAG_AUDIT: o.vocab, TAG_AUDIT_CATEGORIES: o.vocab, TAG_USAGE_FREQUENCY: o.vocab,
    TAG_DETAIL_MAP: o.vocab,
    COOLDOWN_ABILITIES: 'catalog', ABILITY_RADAR_DATA: 'catalog', ABILITIES: 'catalog',
    EFFECTS: 'illustrative',
  };
}

/* ── Metrics (Features tab) ──────────────────────────────────────────── */

function countTags(nodes: TagNode[]) {
  let total = 0;
  let depth = 0;
  let leaves = 0;
  const walk = (list: TagNode[], d: number) => {
    for (const n of list) {
      total++;
      if (d > depth) depth = d;
      if (n.children && n.children.length > 0) walk(n.children, d + 1);
      else leaves++;
    }
  };
  walk(nodes, 1);
  return { total, depth, roots: nodes.length, leaves };
}

/** Every Features-tab number, derived from the view (never from a separate hand list). */
export function spellbookMetrics(view: SpellbookView) {
  // Only authored cooldowns count: `null` (in a GE blueprint) and 0 (no cooldown) are excluded.
  const cds = view.COOLDOWN_ABILITIES.map((a) => a.cd).filter((cd): cd is number => cd !== null && cd > 0);
  const hasCooldownData = cds.length > 0;

  // Audit: a real breakdown counts its named discrepancies; the static categories otherwise.
  const auditWarnings = view.TAG_AUDIT
    ? view.TAG_AUDIT.undeclared.length + view.TAG_AUDIT.orphaned.length
    : view.TAG_AUDIT_CATEGORIES.filter((c) => c.status !== 'pass').reduce((sum, c) => sum + c.count, 0);

  // A circular pair is an A→B edge with a matching B→A edge (each pair is seen twice).
  const edgeSet = new Set(view.TAG_DEP_EDGES.map((e) => `${e.from}→${e.to}`));
  const circularHits = view.TAG_DEP_EDGES.filter((e) => edgeSet.has(`${e.to}→${e.from}`)).length;

  // Active = has a duration (Duration / Periodic / Infinite); passive = Instant.
  const activeEffects = view.EFFECTS.filter((e) => e.type !== 'Instant').length;

  let t = 0;
  const timelineEvents = COMBO_ABILITIES.slice(0, 6).map((a) => {
    const ev = { timestamp: t, color: a.color, duration: a.animDuration };
    t += a.animDuration;
    return ev;
  });

  return {
    gaCount: view.ABILITIES.length,
    geCount: view.EFFECTS.length,
    avgCd: hasCooldownData ? cds.reduce((s, c) => s + c, 0) / cds.length : 0,
    minCd: hasCooldownData ? Math.min(...cds) : 0,
    maxCd: hasCooldownData ? Math.max(...cds) : 0,
    hasCooldownData,
    cooldownAbilityCount: view.COOLDOWN_ABILITIES.length,
    tagStats: countTags(view.TAG_TREE),
    auditWarnings,
    depCount: view.TAG_DEP_EDGES.length,
    circularCount: Math.floor(circularHits / 2),
    activeEffects,
    passiveEffects: view.EFFECTS.length - activeEffects,
    timelineEvents,
  };
}

export type SpellbookMetrics = ReturnType<typeof spellbookMetrics>;
