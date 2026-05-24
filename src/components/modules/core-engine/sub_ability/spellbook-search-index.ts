import { useMemo } from 'react';
import {
  MODULE_COLORS, ACCENT_EMERALD_DARK,
} from '@/lib/chart-colors';
import {
  COMBO_ABILITIES, EFFECT_TYPES,
} from './_shared/data';
import { useSpellbookData } from './_shared/context';
import { SECTIONS } from './_shared/constants';

/* ── Search types ─────────────────────────────────────────────────────── */

export type SearchCategory = 'section' | 'ability' | 'tag' | 'effect' | 'attribute' | 'combo';

export interface SearchResult {
  id: string;
  label: string;
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

export function useSpellbookSearchIndex(): SearchResult[] {
  const data = useSpellbookData();

  return useMemo(() => {
    const results: SearchResult[] = [];
    const add = (id: string, label: string, category: SearchCategory, tab: string, sectionId: string, color: string) =>
      results.push({ id, label, category, tab, sectionId, color });

    // Sections
    for (const s of SECTIONS) {
      const tab = sectionToTab(s.id);
      add(`sec-${s.id}`, s.label, 'section', tab, s.id, s.color);
      for (const f of s.featureNames) {
        add(`feat-${f}`, f, 'section', tab, s.id, s.color);
      }
    }

    // Tag detail map
    for (const [key, detail] of Object.entries(data.TAG_DETAIL_MAP)) {
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
    flattenTags(data.TAG_TREE);

    // Abilities from radar
    for (const ab of data.ABILITY_RADAR_DATA) {
      add(`radar-${ab.name}`, ab.name, 'ability', 'abilities', 'abilities', ab.color);
    }

    // Cooldown abilities
    for (const ab of data.COOLDOWN_ABILITIES) {
      add(`cd-${ab.name}`, ab.name, 'ability', 'abilities', 'abilities', ab.color);
    }

    // Combo abilities
    for (const ab of COMBO_ABILITIES) {
      add(`combo-${ab.id}`, ab.name, 'combo', 'combos', 'combos', ab.color);
    }

    // Core + Derived attributes
    for (const attr of data.CORE_ATTRIBUTES) {
      add(`attr-core-${attr}`, attr, 'attribute', 'tags', 'attributes', ACCENT_EMERALD_DARK);
    }
    for (const attr of data.DERIVED_ATTRIBUTES) {
      add(`attr-derived-${attr}`, attr, 'attribute', 'tags', 'attributes', ACCENT_EMERALD_DARK);
    }

    // Effects
    for (const eff of EFFECT_TYPES) {
      add(`eff-${eff.name}`, eff.name, 'effect', 'effects', 'effects', eff.color);
    }

    // Tag dep nodes
    for (const node of data.TAG_DEP_NODES) {
      add(`dep-${node.id}`, node.label, 'tag', 'tags', 'tag-deps', node.color);
    }

    // De-duplicate by id
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [data]);
}

export const MAX_RESULTS = 20;
