import { describe, it, expect } from 'vitest';
import { CATEGORIES, SUB_MODULES, CATEGORY_MAP, SUB_MODULE_MAP } from '@/lib/module-registry';
import { SUB_MODULE_IDS } from '@/types/modules';
import type { CategoryId } from '@/types/modules';

describe('visual-gen module registration', () => {
  it('visual-gen category exists in CATEGORIES', () => {
    const visualGen = CATEGORIES.find((c) => c.id === 'visual-gen');
    expect(visualGen).toBeDefined();
    expect(visualGen!.label).toBe('Asset Studio');
    expect(visualGen!.accentColor).toBe('#06b6d4');
    expect(visualGen!.subModules).toContain('asset-viewer');
  });

  it('visual-gen category is in CATEGORY_MAP', () => {
    expect(CATEGORY_MAP['visual-gen']).toBeDefined();
    expect(CATEGORY_MAP['visual-gen'].label).toBe('Asset Studio');
  });

  it('asset-viewer exists in SUB_MODULE_IDS', () => {
    expect(SUB_MODULE_IDS).toContain('asset-viewer');
  });

  it('asset-viewer has a SUB_MODULES entry with correct category', () => {
    const assetViewer = SUB_MODULES.find((m) => m.id === 'asset-viewer');
    expect(assetViewer).toBeDefined();
    expect(assetViewer!.categoryId).toBe('visual-gen' as CategoryId);
    expect(assetViewer!.label).toBe('3D Asset Viewer');
  });

  it('asset-viewer is in SUB_MODULE_MAP', () => {
    expect(SUB_MODULE_MAP['asset-viewer']).toBeDefined();
    expect(SUB_MODULE_MAP['asset-viewer']!.description).toContain('3D model viewer');
  });

  it('asset-viewer has checklist items', () => {
    const assetViewer = SUB_MODULE_MAP['asset-viewer'];
    expect(assetViewer?.checklist).toBeDefined();
    expect(assetViewer!.checklist!.length).toBeGreaterThan(0);

    // Verify expected checklist IDs
    const ids = assetViewer!.checklist!.map((c) => c.id);
    expect(ids).toContain('viewer-load');
    expect(ids).toContain('viewer-orbit');
    expect(ids).toContain('viewer-lighting');
    expect(ids).toContain('viewer-wireframe');
    expect(ids).toContain('viewer-grid');
    expect(ids).toContain('viewer-export');
  });

  it('asset-viewer has quick actions', () => {
    const assetViewer = SUB_MODULE_MAP['asset-viewer'];
    expect(assetViewer?.quickActions).toBeDefined();
    expect(assetViewer!.quickActions.length).toBeGreaterThan(0);
  });

  it('asset-viewer has knowledge tips', () => {
    const assetViewer = SUB_MODULE_MAP['asset-viewer'];
    expect(assetViewer?.knowledgeTips).toBeDefined();
    expect(assetViewer!.knowledgeTips.length).toBeGreaterThan(0);
  });

  it('all category subModules reference valid SubModuleIds', () => {
    for (const category of CATEGORIES) {
      for (const subModId of category.subModules) {
        expect(
          SUB_MODULE_IDS.includes(subModId),
          `${category.id} references unknown sub-module "${subModId}"`,
        ).toBe(true);
      }
    }
  });
});
