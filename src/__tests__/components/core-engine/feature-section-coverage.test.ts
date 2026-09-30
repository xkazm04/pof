import { describe, it, expect, expectTypeOf } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { SubModuleId } from '@/types/modules';
import { getAllSectionIds, type SectionId } from '@/components/modules/core-engine/unique-tabs/feature-map-config';
import { gatedSectionIds, sectionToggleModel } from '@/components/modules/core-engine/unique-tabs/featureSectionModel';
import type { VisibleSection } from '@/components/modules/core-engine/unique-tabs/VisibleSection';

/**
 * One section registry (scan-sweep --challenge core-engine-genre-tabs/A).
 *
 * The Feature Map's toggle list (feature-map-config.ts) and the gates that honour it
 * (`<VisibleSection sectionId="...">` in the 12 sub_* roots) used to be two hand-kept
 * lists of free strings: 58 of 104 toggles hid nothing and 3 gates no toggle could reach.
 * The registry now declares, per entry, whether it IS a gate, lives IN a gated panel, or
 * has no gate at all; this ratchet pins the declared gate set to the gates in source, so
 * a new gate without a registry entry (or a toggle without a gate) goes red here.
 */

const CORE = path.join(process.cwd(), 'src', 'components', 'modules', 'core-engine');

const SUB_DIRS: Record<string, SubModuleId> = {
  sub_combat: 'arpg-combat',
  sub_ability: 'arpg-gas',
  sub_animation: 'arpg-animation',
  sub_bestiary: 'arpg-enemy-ai',
  sub_character: 'arpg-character',
  sub_inventory: 'arpg-inventory',
  sub_loot: 'arpg-loot',
  sub_progression: 'arpg-progression',
  sub_save: 'arpg-save',
  sub_ui: 'arpg-ui',
  sub_world: 'arpg-world',
  sub_debug: 'arpg-polish',
};

function walk(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) return walk(p);
    return /\.tsx?$/.test(f) ? [p] : [];
  });
}

function sourceGates(dir: string): { literal: Set<string>; dynamic: string[] } {
  const literal = new Set<string>();
  const dynamic: string[] = [];
  for (const file of walk(path.join(CORE, dir))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/sectionId="([^"]+)"/g)) literal.add(m[1]);
    if (/<VisibleSection[^>]*sectionId=\{/.test(src)) dynamic.push(path.relative(CORE, file));
  }
  return { literal, dynamic };
}

const byId = (moduleId: SubModuleId, vis: Record<string, boolean>) =>
  new Map(sectionToggleModel(moduleId, vis).map((e) => [e.id as string, e]));

describe('Feature Map section registry — one owner of the gate set', () => {
  it('coverage ratchet: the sectionId literals under each sub_* equal gatedSectionIds(module)', () => {
    for (const [dir, moduleId] of Object.entries(SUB_DIRS)) {
      const { literal, dynamic } = sourceGates(dir);
      expect(dynamic, `${dir}: a non-literal sectionId escapes the ratchet`).toEqual([]);
      expect([...literal].sort(), `${dir} -> ${moduleId}`).toEqual([...gatedSectionIds(moduleId)].sort());
    }
  });

  it('the three once-ungoverned gates are declared, so Disable All can reach them', () => {
    expect(getAllSectionIds('arpg-combat')).toContain('attribute-defaults');
    expect(getAllSectionIds('arpg-inventory')).toContain('economy-sim');
    expect(getAllSectionIds('arpg-inventory')).toContain('loot-filter');
  });

  it('a sub-panel inside a gated panel is not a toggle; it follows its parent', () => {
    const m = byId('arpg-combat', {});
    expect(m.get('sankey')).toMatchObject({ toggleable: false, parentId: 'dps', effectiveVisible: true });
    expect(m.get('dps')).toMatchObject({ toggleable: true, parentId: null });
  });

  it('hiding the parent hides its children and nothing else', () => {
    const m = byId('arpg-combat', { dps: false });
    expect(m.get('sankey')!.effectiveVisible).toBe(false);
    expect(m.get('kpis')!.effectiveVisible).toBe(false);
    expect(m.get('lanes')!.effectiveVisible).toBe(true);
  });

  it('across all 12 modules toggleable entries are exactly the gates; the rest name a gated parent or no-gate', () => {
    let deadToggles = 0;
    for (const moduleId of Object.values(SUB_DIRS)) {
      const gated = new Set<string>(gatedSectionIds(moduleId));
      const model = sectionToggleModel(moduleId, {});
      expect(model.length).toBe(getAllSectionIds(moduleId).length);
      expect(model.filter((e) => e.toggleable).map((e) => e.id).sort()).toEqual([...gated].sort());
      for (const e of model) {
        if (e.toggleable && !gated.has(e.id)) deadToggles++;
        if (!e.toggleable) {
          const ok = (e.parentId !== null && gated.has(e.parentId)) || e.locked === 'no-gate';
          expect(ok, `${moduleId}/${e.id}`).toBe(true);
        }
      }
    }
    expect(deadToggles).toBe(0);
  });

  it('a stored preference for a non-gate or removed section is ignored, never hides anything', () => {
    const m = byId('arpg-combat', { sankey: false, 'no-longer-a-section': false });
    expect(m.get('sankey')!.effectiveVisible).toBe(true);
    expect(m.has('no-longer-a-section')).toBe(false);
    const locked = byId('arpg-character', { 'curve-editor': false }).get('curve-editor')!;
    expect(locked).toMatchObject({ toggleable: false, locked: 'no-gate', effectiveVisible: true });
  });

  it('type pin: VisibleSection takes a SectionId, so a gate typo fails typecheck', () => {
    expectTypeOf<Parameters<typeof VisibleSection>[0]['sectionId']>().toEqualTypeOf<SectionId>();
    expectTypeOf<'not-a-section'>().not.toExtend<SectionId>();
    expectTypeOf<'attribute-defaults'>().toExtend<SectionId>();
  });
});
