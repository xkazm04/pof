import { describe, it, expect } from 'vitest';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
// Registered once, at module load, for its self-registering side effect. (Previously each test
// reset the registry and re-imported — which only works for the FIRST test, since the module
// cache makes every later import a no-op that registers nothing.)
import '@/lib/catalog/pipelines/icon-sets';

describe('icon-sets pipeline', () => {
  it('registers under "icon-sets" with correct step labels and acceptance', () => {
    const p = getCatalogPipeline('icon-sets');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Accessibility');

    const entity = { id: 'ability-icons', name: 'Ability Icons', lifecycle: 'planned' as const, data: {} };

    // Icon 2D Art: produce + accept → pass, tier L1 (selection step)
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconResult = iconStep.accept(iconStep.produce(entity).data ?? {});
    expect(iconResult.status).toBe('deferred'); // a swatch placeholder is not a generated asset — the gallery gate now defers with a reason
    expect(iconResult.tier).toBe('L4'); // a missing VISUAL asset, reported at the tier the walker expects for a deferral

    // Test Gate: deferred L3
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
  });

  /**
   * ATLAS GEOMETRY SELF-CONSISTENCY.
   *
   * The spec used to ask for a mip chain AND zero padding with "UV boundary = cell boundary" —
   * mutually exclusive, because a filtered fetch at a cell edge samples the neighbouring icon,
   * and reaches twice as far in source texels at every level down. The mip COUNT half of that
   * contradiction was fixed by the judge fleet on 2026-07-07; the padding half was not. These
   * assertions pin the resolved arithmetic so it cannot silently come back.
   *
   * Standard: ai-registry knowledge/game-production/asset-production/surface-and-imagery/
   * sprite-and-atlas-production → technique `atlas-packing-and-bleed-margins`
   * ("derive the margin, do not pick it"; "extrude, then pad"; mip depth is floored by the
   * REGION, not the page).
   */
  it('the Atlas step declares a self-consistent gutter / artwork / mip-count contract', () => {
    const p = getCatalogPipeline('icon-sets')!;
    const entity = { id: 'ability-icons', name: 'Ability Icons', lifecycle: 'planned' as const, data: {} };

    const step = p.steps.find((s) => s.label === 'Atlas')!;
    const atlas = (step.produce(entity).data as Record<string, Record<string, unknown>>).atlas;

    const cell = atlas.cellPx as number;
    const artwork = atlas.artworkPx as number;
    const gutter = atlas.gutterPx as number;
    const mips = atlas.mipCount as number;
    const MIN_DISPLAY = 32; // the Accessibility step's declared minimum display size

    // (1) The cell budget is artwork + gutter, not the whole cell.
    expect(artwork + 2 * gutter).toBe(cell);
    expect(gutter).toBeGreaterThan(0);

    // (2) The gutter is DERIVED: 1 bilinear texel at the deepest mip, expressed at mip 0.
    expect(gutter).toBe(2 ** (mips - 1));

    // (3) The gutter survives the whole chain — ≥1 texel at every level.
    expect(gutter / 2 ** (mips - 1)).toBeGreaterThanOrEqual(1);

    // (4) The mip floor is measured against the ARTWORK, not the cell.
    expect(artwork / 2 ** (mips - 1)).toBeGreaterThanOrEqual(MIN_DISPLAY);

    // (5) …and the chain is as deep as it can honestly go: one more mip needs a wider gutter
    //     (1 texel × the deeper reduction) and drops the artwork below the display floor.
    const nextGutter = 2 ** mips;
    expect((cell - 2 * nextGutter) / 2 ** mips).toBeLessThan(MIN_DISPLAY);

    // (6) The prose states the resolution, not the old contradiction.
    const packing = String(atlas.packing);
    expect(packing).toMatch(/extrud/i);
    expect(packing).toContain(`${gutter} px gutter`);
    expect(packing).not.toMatch(/no padding/i);
    expect(String(atlas.format)).toContain(`mip count = ${mips}`);

    // (7) Acceptance now requires the gutter to be declared at all.
    expect(step.accept(step.produce(entity).data ?? {})).toMatchObject({ status: 'pass' });
    const noGutter = { atlas: { texture: 'T_X_Atlas', packing: 'x', slots: 256 } };
    expect(step.accept(noGutter).status).not.toBe('pass');
  });
});
