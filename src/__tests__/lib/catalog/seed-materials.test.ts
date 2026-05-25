import { describe, it, expect } from 'vitest';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { seedMaterialEntries } from '@/lib/catalog/seed-materials';

describe('materials catalog (Phase 8 substrate → first data lift)', () => {
  it('CATALOG_SECTIONS includes the materials substrate', () => {
    expect(CATALOG_SECTIONS.length).toBeGreaterThanOrEqual(9);
    expect(CATALOG_SECTIONS.map((s) => s.catalogId)).toContain('materials');
  });

  it('includes materials in CATALOG_SECTIONS', () => {
    const ids = CATALOG_SECTIONS.map((s) => s.catalogId);
    expect(ids).toContain('materials');
  });

  it('materials section is labeled and seeds the Weathered Stone pipeline target', () => {
    const materials = CATALOG_SECTIONS.find((s) => s.catalogId === 'materials');
    expect(materials?.label).toBe('Materials');

    const entries = seedMaterialEntries();
    expect(entries).toHaveLength(1);
    const stone = entries[0];
    expect(stone.id).toBe('mat-weathered-stone');
    expect(stone.catalogId).toBe('materials');
    // Static seeds are `planned`; the verified lifecycle is DB-owned.
    expect(stone.lifecycle).toBe('planned');
    // Spec mirrors the UE Python builder (build_weathered_stone.py).
    expect(stone.data.surfaceType).toBe('stone');
    expect(stone.data.parentMaterial).toBe('/Game/Materials/M_ARPG_Surface_Master');
    expect(stone.data.instancePath).toBe('/Game/Materials/MI_WeatheredStone');
    expect(stone.data.textures?.albedo).toBeTruthy();
    expect(stone.data.baseColorTint).toHaveLength(3);
  });
});
