import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  EFFECTIVENESS_DATA, DMG_TYPES, ARMOR_TYPES,
} from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';
import * as dataMetrics from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';

// Shared combat-metrics data is internally consistent: what one field says, the
// others agree with (scan-sweep night 2026-11-08, combat-metrics).

describe('damage-type effectiveness heatmap', () => {
  const cells = EFFECTIVENESS_DATA.map((c) => ({ ...c, mult: Number(c.label) }));

  it('covers every damage type x armour type exactly once', () => {
    expect(cells).toHaveLength(DMG_TYPES.length * ARMOR_TYPES.length);
    const keys = new Set(cells.map((c) => `${c.row}:${c.col}`));
    expect(keys.size).toBe(cells.length);
  });

  it('the tooltip names the same pair and multiplier as the label', () => {
    for (const c of cells) {
      expect(Number.isFinite(c.mult)).toBe(true);
      expect(c.tooltip?.startsWith(`${DMG_TYPES[c.row]} vs ${ARMOR_TYPES[c.col]}: ${c.label}x`)).toBe(true);
    }
  });

  it('cell intensity is monotone in the multiplier (a weaker multiplier never paints stronger)', () => {
    const inversions: string[] = [];
    for (const a of cells) {
      for (const b of cells) {
        if (a.mult < b.mult && !(a.value < b.value)) {
          inversions.push(`${a.tooltip} (${a.value}) vs ${b.tooltip} (${b.value})`);
        }
      }
    }
    expect(inversions).toEqual([]);
  });
});

describe('data-metrics export surface', () => {
  // Zero-consumer exports (repo-wide grep, 2026-11-08): sample data nothing renders.
  // Re-adding one means re-adding a consumer first.
  it('carries no orphaned sample exports', () => {
    const orphans = ['HIT_ACCURACY_GAUGE', 'ABILITY_USAGE', 'STAGGER_PIPELINE_STEPS', 'WEAPON_COUNT', 'COMBO_COUNT', 'WEAPON_METADATA'];
    expect(orphans.filter((k) => k in dataMetrics)).toEqual([]);
  });

  it('keeps the exports the combat tabs read', () => {
    for (const k of ['WEAPONS', 'WEAPON_GROUPINGS', 'WEAPON_ROSTER', 'COMBO_SEQUENCES', 'KPI_CARDS', 'SANKEY_COLUMNS', 'SANKEY_FLOWS', 'HITSTOP_ABILITIES', 'MAX_HITSTOP', 'STAGGER_CONFIG', 'STAGGER_TIMELINE', 'COMBO_SECTIONS', 'EFFECTIVENESS_DATA']) {
      expect(k in dataMetrics, k).toBe(true);
    }
  });
});

describe('weapon category order has one source', () => {
  const METRICS = path.join(process.cwd(), 'src', 'components', 'modules', 'core-engine', 'sub_combat', 'metrics');
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('the shared list covers every weapon and drives the category grouping', () => {
    const cats = (dataMetrics as Record<string, unknown>).WEAPON_CATEGORIES as readonly string[] | undefined;
    expect(Array.isArray(cats)).toBe(true);
    expect(new Set(cats).size).toBe(cats?.length);
    for (const w of dataMetrics.WEAPONS) expect(cats).toContain(w.category);
    expect(dataMetrics.WEAPON_GROUPINGS[0].order).toEqual([...(cats ?? [])]);
  });

  it('no metrics panel re-types the category list', () => {
    const offenders: string[] = [];
    for (const f of fs.readdirSync(METRICS).filter((n) => /\.tsx?$/.test(n))) {
      const src = strip(fs.readFileSync(path.join(METRICS, f), 'utf8'));
      if (/\[\s*'Sword'\s*,\s*'Axe'/.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
