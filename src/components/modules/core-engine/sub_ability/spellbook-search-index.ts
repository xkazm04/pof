import { useMemo } from 'react';
import {
  MODULE_COLORS, ACCENT_EMERALD_DARK,
} from '@/lib/chart-colors';
import { COMBO_ABILITIES } from './_shared/data';
import { useSpellbookData } from './_shared/context';
import { SECTIONS } from './_shared/constants';
import type { SpellbookView } from './_shared/types';

/* ── Search types ─────────────────────────────────────────────────────── */

export type SearchCategory = 'section' | 'ability' | 'tag' | 'effect' | 'attribute' | 'combo';

export interface SearchResult {
  id: string;
  label: string;
  /** Precomputed `label.toLowerCase()` so the keystroke filter does plain `includes` without re-lowercasing. */
  labelLower: string;
  category: SearchCategory;
  tab: string;
  sectionId: string;
  color: string;
}

export const CATEGORY_LABELS: Record<SearchCategory, string> = {
  section: 'Section',
  ability: 'Ability',
  tag: 'Tag',
  effect: 'Effect',
  attribute: 'Attribute',
  combo: 'Combo',
};

/** Map a SectionId to its parent sub-tab */
function sectionToTab(sectionId: string): string {
  switch (sectionId) {
    case 'core': case 'loadout': return 'core';
    case 'abilities': case 'damage-calc': return 'abilities';
    case 'combos': return 'combos';
    case 'effects': case 'effects-timeline': return 'effects';
    case 'attributes': case 'tags': case 'tag-deps': case 'tag-audit': return 'tags';
    default: return 'core';
  }
}

/** The view fields the palette indexes (a full `SpellbookView` satisfies it). */
export type SpellbookSearchSource = Pick<SpellbookView,
  'TAG_DETAIL_MAP' | 'TAG_TREE' | 'ABILITIES' | 'COOLDOWN_ABILITIES' | 'EFFECTS'
  | 'CORE_ATTRIBUTES' | 'DERIVED_ATTRIBUTES' | 'TAG_DEP_NODES'>;

/**
 * Pure Ctrl+K index over the spellbook view: one `ability` result per catalog entry
 * (plus live-only C++ abilities from the cooldown rows) and one `effect` result per
 * effect row, de-duplicated by id.
 */
export function buildSpellbookSearchIndex(view: SpellbookSearchSource): SearchResult[] {
  const results: SearchResult[] = [];
  const add = (id: string, label: string, category: SearchCategory, tab: string, sectionId: string, color: string) =>
    results.push({ id, label, labelLower: label.toLowerCase(), category, tab, sectionId, color });

  // Sections
  for (const s of SECTIONS) {
    const tab = sectionToTab(s.id);
    add(`sec-${s.id}`, s.label, 'section', tab, s.id, s.color);
    for (const f of s.featureNames) {
      add(`feat-${f}`, f, 'section', tab, s.id, s.color);
    }
  }

  // Tag detail map
  for (const [key, detail] of Object.entries(view.TAG_DETAIL_MAP)) {
    const tab = key.startsWith('Ability') ? 'abilities' : 'tags';
    const section = key.startsWith('Ability') ? 'abilities' : key.startsWith('Input') ? 'tags' : key.startsWith('Damage') ? 'effects' : 'tags';
    add(`tag-${key}`, key, 'tag', tab === 'abilities' ? 'abilities' : 'tags', section, detail.color);
  }

  // Tag tree nodes (flatten)
  const flattenTags = (nodes: { name: string; children?: { name: string; children?: unknown[] }[] }[]) => {
    for (const node of nodes) {
      add(`tree-${node.name}`, node.name, 'tag', 'tags', 'tags', MODULE_COLORS.content);
      if (node.children) flattenTags(node.children as typeof nodes);
    }
  };
  flattenTags(view.TAG_TREE);

  // Abilities: every catalog entry, then C++ abilities the catalog does not hold yet
  for (const ab of view.ABILITIES) {
    add(`ability-${ab.id}`, ab.name, 'ability', 'abilities', 'abilities', ab.color);
  }
  for (const row of view.COOLDOWN_ABILITIES) {
    add(`ability-${row.id}`, row.name, 'ability', 'abilities', 'abilities', row.color);
  }

  // Combo abilities
  for (const ab of COMBO_ABILITIES) {
    add(`combo-${ab.id}`, ab.name, 'combo', 'combos', 'combos', ab.color);
  }

  // Core + Derived attributes
  for (const attr of view.CORE_ATTRIBUTES) {
    add(`attr-core-${attr}`, attr, 'attribute', 'tags', 'attributes', ACCENT_EMERALD_DARK);
  }
  for (const attr of view.DERIVED_ATTRIBUTES) {
    add(`attr-derived-${attr}`, attr, 'attribute', 'tags', 'attributes', ACCENT_EMERALD_DARK);
  }

  // Effects
  for (const eff of view.EFFECTS) {
    add(`eff-${eff.id}`, eff.name, 'effect', 'effects', 'effects', eff.color);
  }

  // Tag dep nodes
  for (const node of view.TAG_DEP_NODES) {
    add(`dep-${node.id}`, node.label, 'tag', 'tags', 'tag-deps', node.color);
  }

  // De-duplicate by id
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

export function useSpellbookSearchIndex(): SearchResult[] {
  // Key the memo on the source arrays/maps actually indexed, not the `data` context
  // object whose identity is unstable across syncs (the provider returns a fresh
  // object on every sync-state toggle), so the index is not rebuilt mid-typing.
  const {
    TAG_DETAIL_MAP, TAG_TREE, ABILITIES, COOLDOWN_ABILITIES, EFFECTS,
    CORE_ATTRIBUTES, DERIVED_ATTRIBUTES, TAG_DEP_NODES,
  } = useSpellbookData();

  return useMemo(() => buildSpellbookSearchIndex({
    TAG_DETAIL_MAP, TAG_TREE, ABILITIES, COOLDOWN_ABILITIES, EFFECTS,
    CORE_ATTRIBUTES, DERIVED_ATTRIBUTES, TAG_DEP_NODES,
  }), [
    TAG_DETAIL_MAP, TAG_TREE, ABILITIES, COOLDOWN_ABILITIES, EFFECTS,
    CORE_ATTRIBUTES, DERIVED_ATTRIBUTES, TAG_DEP_NODES,
  ]);
}

export const MAX_RESULTS = 20;
