import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { catalogManifest } from '@/components/layout-lab/catalogManifest';
import { produceItemStep, itemsRegisteredStep } from '@/components/layout-lab/itemsLabelOwner';
import { resolveAccept } from '@/components/layout-lab/labAcceptance';
import { ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { StepOutput } from '@/components/layout-lab/labPipelineStore';

/**
 * UE PACKAGING CLAIMS ONLY WHAT ITS SIBLINGS DECLARE (scan-sweep challenge 2026-09-30d).
 *
 * The packaging drain treats the packaging step's own `ueAssets` as its claim and passes only
 * when every declaration exists as a `.uasset` under the UE root (packagingGrade.ts). Before
 * this, the registered Items UE Packaging hand-typed 12 paths for item-1, 10 of which no
 * producing step declared — including a data-table ROW written as a path
 * (`/Game/Data/Items/DT_Items :: IronLongsword`, which can never exist on disk) and six
 * GE_Affix_* effects for a Common item whose own Affixes step declares none. The mesh and the
 * material were each declared at two different paths by the two Items specs.
 *
 * Every assertion runs item-1 through the OWNER of each of the 18 manifest labels (the same
 * door the lab, the demo populate and the server use), so it measures what is really produced.
 */

const UE_OBJECT_PATH = /^\/Game\/[A-Za-z0-9_/]+$/;

const seed = CATALOG_SECTIONS.find((s) => s.catalogId === 'items')!.seed();
const ITEM_1: LabEntity = { ...(seed[0] as unknown as LabEntity), lifecycle: 'planned' };

function produceAll(entity: LabEntity): Record<string, StepOutput> {
  const out: Record<string, StepOutput> = {};
  for (const label of catalogManifest('items').steps) out[label] = produceItemStep(entity, label)!;
  return out;
}

describe('Items UE Packaging — the claim is derived from sibling declarations', () => {
  const outputs = produceAll(ITEM_1);
  const packaging = outputs['UE Packaging'].ueAssets ?? [];

  it('item-1 is the Common, power-less exemplar the cases below assume', () => {
    expect(ITEM_1.id).toBe('item-1');
    expect((ITEM_1.data as { rarity?: string }).rarity).toBe('Common');
    expect((ITEM_1.data as { powers?: unknown }).powers).toBeUndefined();
    expect(packaging.length).toBeGreaterThan(0);
  });

  it('every packaging declaration is a UE object path — a DT row name lives in data, never in ueAssets', () => {
    for (const p of packaging) expect(p).toMatch(UE_OBJECT_PATH);
    const data = outputs['UE Packaging'].data as { dataTableRow?: { table?: string; row?: string } };
    expect(data.dataTableRow?.row).toBe('IronLongsword');
    expect(data.dataTableRow?.table).toMatch(UE_OBJECT_PATH);
  });

  it('every path UE Packaging claims is declared by some OTHER step', () => {
    const declared = new Set<string>();
    for (const [label, out] of Object.entries(outputs)) {
      if (label === 'UE Packaging') continue;
      for (const p of out.ueAssets ?? []) declared.add(p);
    }
    const undeclared = packaging.filter((p) => !declared.has(p));
    expect(undeclared).toEqual([]);
  });

  it('a Common item with no declared powers packages no GE_Affix_* effect', () => {
    expect(packaging.filter((p) => /GE_Affix_/.test(p))).toEqual([]);
    // It still packages the one effect its Affixes step declares (the sword implicit).
    const affixes = outputs['Affixes'].ueAssets ?? [];
    expect(affixes.some((p) => p.endsWith('/GE_Implicit_SwordAccuracy'))).toBe(true);
    expect(packaging).toEqual(expect.arrayContaining(affixes));
  });

  it("the bespoke '3D Generation' declares the registered '3D Mesh' LOD0 path", () => {
    const bespoke = ITEM_STEP_SPECS['3D Generation'].produce(ITEM_1).ueAssets ?? [];
    const registered = itemsRegisteredStep('3D Mesh')!.produce(ITEM_1).ueAssets ?? [];
    expect(bespoke[0]).toBe(registered[0]);
  });

  it("the bespoke 'Material / Texture' declares the registered Material instance, and packaging's icon is an Icon 2D Art path", () => {
    const bespoke = ITEM_STEP_SPECS['Material / Texture'].produce(ITEM_1).ueAssets ?? [];
    const registered = itemsRegisteredStep('Material')!.produce(ITEM_1).data as { material: { instancePath: string } };
    expect(bespoke[0]).toBe(registered.material.instancePath);
    const icons = outputs['Icon 2D Art'].ueAssets ?? [];
    const packagedIcons = packaging.filter((p) => /\/T_[A-Za-z0-9_]+_Icon/.test(p));
    expect(packagedIcons.length).toBeGreaterThan(0);
    for (const icon of packagedIcons) expect(icons).toContain(icon);
    // No icon under the materials folder any more (it used to claim /Game/Items/Materials/T_*_Icon_Rare).
    expect(packaging.some((p) => p.startsWith('/Game/Items/Materials/T_'))).toBe(false);
  });

  it('[guard] the 18 manifest labels and item-1\'s owner-resolved verdicts are unchanged', () => {
    expect(catalogManifest('items').steps).toEqual([
      'Concept Brief', 'Attributes', 'Economy', 'Icon 2D Art', '3D Generation', 'Material / Texture',
      'Animations', 'VFX', 'SFX', 'Inventory UI Integration', 'Tooltip / Compare', 'Test Gate',
      'UE Packaging', 'Base Type & Rarity', 'Affixes', 'Damage / Implicit', 'Material', '3D Mesh',
    ]);
    // Snapshot taken on the tree BEFORE the asset-path table existed (base 9b2ddb0c).
    const before: Record<string, [string, string]> = {
      'Concept Brief': ['pass', 'L0'], 'Attributes': ['pass', 'L0'], 'Economy': ['pass', 'L0'],
      'Icon 2D Art': ['deferred', 'L4'], '3D Generation': ['deferred', 'L4'], 'Material / Texture': ['deferred', 'L4'],
      'Animations': ['pass', 'L0'], 'VFX': ['pass', 'L0'], 'SFX': ['pass', 'L0'],
      'Inventory UI Integration': ['pass', 'L0'], 'Tooltip / Compare': ['pass', 'L0'], 'Test Gate': ['deferred', 'L3'],
      'UE Packaging': ['pass', 'L0'], 'Base Type & Rarity': ['pass', 'L0'], 'Affixes': ['pass', 'L0'],
      'Damage / Implicit': ['pass', 'L0'], 'Material': ['pass', 'L0'], '3D Mesh': ['deferred', 'L4'],
    };
    const now: Record<string, [string, string]> = {};
    for (const [label, out] of Object.entries(outputs)) {
      const r = resolveAccept('items', label)!(out.data ?? {});
      now[label] = [r.status, r.tier ?? ''];
    }
    expect(now).toEqual(before);
  });
});
