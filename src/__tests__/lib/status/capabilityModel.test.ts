import { describe, it, expect } from 'vitest';
import { buildCapabilityRows, capabilityClassOf } from '@/lib/status/capabilityModel';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/** Minimal strict-panel verdict; llm-panel + rubric 3 by default so it counts. */
function v(catalogId: string, entityId: string, step: string, score: number, extra: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return {
    catalogId,
    entityId,
    step,
    judge: 'llm-panel',
    verdict: score >= 90 ? 'pass' : 'fail',
    score,
    findings: '',
    model: 'sonnet-fleet',
    rubricVersion: 3,
    ...extra,
  };
}

/** Fetch one class row by id. */
function row(rows: ReturnType<typeof buildCapabilityRows>, klass: string) {
  const r = rows.find((x) => x.klass === klass);
  if (!r) throw new Error(`no row for ${klass}`);
  return r;
}

// `items/Icon 2D Art` is deliverable 2d-art with NO ceiling → a clean class for testing
// the numeric ladder. `items/Concept Brief` is text-config WITH a documented technique wall.
const ICON = 'Icon 2D Art';

describe('capabilityClassOf', () => {
  it('reuses the judge text/2D split (ui-glyph) and passes non-rubric deliverables through', () => {
    expect(capabilityClassOf('2d-art', 'items')).toBe('2d-art');
    expect(capabilityClassOf('2d-art', 'hud-elements')).toBe('ui-glyph'); // UI_GLYPH_CATALOGS
    expect(capabilityClassOf('text-config')).toBe('text-config');
    expect(capabilityClassOf('ue-runtime')).toBe('ue-runtime');
    expect(capabilityClassOf('vfx-particles')).toBe('vfx-particles');
  });
});

describe('buildCapabilityRows — class aggregation + median', () => {
  it('pools verdicts by class and takes the median of included scores', () => {
    const rows = buildCapabilityRows([
      v('items', 'e1', ICON, 80),
      v('items', 'e2', ICON, 90),
      v('items', 'e3', ICON, 70),
    ]);
    const r = row(rows, '2d-art');
    expect(r.n).toBe(3);
    expect(r.median).toBe(80); // sorted 70,80,90 → 80
  });

  it('even count → rounded mean of the two middles', () => {
    const rows = buildCapabilityRows([v('items', 'e1', ICON, 80), v('items', 'e2', ICON, 90)]);
    expect(row(rows, '2d-art').median).toBe(85);
  });
});

describe('grade ladder edges', () => {
  it('proven: median ≥90 with n≥3 (no technique wall)', () => {
    const rows = buildCapabilityRows([v('items', 'e1', ICON, 90), v('items', 'e2', ICON, 92), v('items', 'e3', ICON, 94)]);
    expect(row(rows, '2d-art').grade).toBe('proven');
  });

  it('90 boundary is proven; 89 boundary is strong', () => {
    const at90 = buildCapabilityRows([v('items', 'a', ICON, 90), v('items', 'b', ICON, 90), v('items', 'c', ICON, 90)]);
    expect(row(at90, '2d-art').grade).toBe('proven');
    const at89 = buildCapabilityRows([v('items', 'a', ICON, 89), v('items', 'b', ICON, 89), v('items', 'c', ICON, 89)]);
    expect(row(at89, '2d-art').grade).toBe('strong');
  });

  it('median ≥90 but n<3 → strong (insufficient evidence to certify proven)', () => {
    const rows = buildCapabilityRows([v('items', 'a', ICON, 90), v('items', 'b', ICON, 92)]);
    expect(row(rows, '2d-art').grade).toBe('strong');
  });

  it('85 boundary → strong; below 85 with evidence → capped', () => {
    const strong = buildCapabilityRows([v('items', 'a', ICON, 85), v('items', 'b', ICON, 85)]);
    expect(row(strong, '2d-art').grade).toBe('strong');
    const capped = buildCapabilityRows([v('items', 'a', ICON, 84), v('items', 'b', ICON, 80)]);
    expect(row(capped, '2d-art').grade).toBe('capped');
  });

  it('a documented technique wall caps the class even at a high median (conservative)', () => {
    // text-config carries technique ceilings (items Concept Brief etc.) → capped, not proven.
    const rows = buildCapabilityRows([
      v('items', 'e1', 'Concept Brief', 92),
      v('items', 'e2', 'Concept Brief', 94),
      v('items', 'e3', 'Concept Brief', 96),
    ]);
    const r = row(rows, 'text-config');
    expect(r.cappedByTechnique).toBe(true);
    expect(r.grade).toBe('capped');
  });

  it('unproven when a class has no strict-panel verdicts (e.g. generatorWired:false / gate-graded)', () => {
    const rows = buildCapabilityRows([v('items', 'e1', ICON, 90)]);
    // ue-runtime & vfx-particles steps exist in facts but got no verdicts → unproven rows surface.
    expect(row(rows, 'ue-runtime').grade).toBe('unproven');
    expect(row(rows, 'vfx-particles').grade).toBe('unproven');
    expect(row(rows, 'ue-runtime').n).toBe(0);
  });
});

describe('exclusion honors ceiling-facts', () => {
  it('checker-structural / project-data cells are excluded from the median and counted separately', () => {
    const rows = buildCapabilityRows([
      v('items', 'e1', 'Economy', 62), // checker-structural (all entities) → excluded
      v('items', 'e2', 'Concept Brief', 80), // included
    ]);
    const r = row(rows, 'text-config');
    expect(r.excluded).toBeGreaterThanOrEqual(1);
    expect(r.n).toBe(1); // only Concept Brief counted
    expect(r.median).toBe(80);
  });

  it('entity-scoped project-data excludes only the named entity', () => {
    const rows = buildCapabilityRows([
      v('items', 'item-lightsaber', 'Tooltip / Compare', 60), // project-data (this entity) → excluded
      v('items', 'other-item', 'Tooltip / Compare', 88), // NOT excluded
    ]);
    const r = row(rows, 'text-config');
    expect(r.excluded).toBe(1);
    expect(r.n).toBe(1);
    expect(r.median).toBe(88);
  });
});

describe('filters and invariants', () => {
  it('skips synthetic entities', () => {
    const rows = buildCapabilityRows([
      v('items', 'test-headless-mcp', ICON, 95),
      v('items', 'item-mcp-smoke', ICON, 95),
    ]);
    expect(row(rows, '2d-art').n).toBe(0);
  });

  it('ignores non-panel judges and stale (rubric<3) verdicts', () => {
    const rows = buildCapabilityRows([
      v('items', 'e1', ICON, 95, { judge: 'vlm' }),
      v('items', 'e2', ICON, 95, { rubricVersion: 2 }),
    ]);
    expect(row(rows, '2d-art').n).toBe(0);
  });

  it('keeps the latest verdict per (catalog|entity|step)', () => {
    const rows = buildCapabilityRows([
      v('items', 'e1', ICON, 40, { judgedAt: '2026-07-01' }),
      v('items', 'e1', ICON, 90, { judgedAt: '2026-07-16' }),
    ]);
    const r = row(rows, '2d-art');
    expect(r.n).toBe(1);
    expect(r.median).toBe(90);
  });

  it('provenance is the phase-1 constant on every row', () => {
    const rows = buildCapabilityRows([v('items', 'e1', ICON, 90)]);
    expect(rows.every((r) => r.provenance === 'derived-from-project-instances')).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('rows sort proven → strong → capped → unproven', () => {
    const rows = buildCapabilityRows([v('items', 'a', ICON, 90), v('items', 'b', ICON, 92), v('items', 'c', ICON, 94)]);
    const ranks = { proven: 0, strong: 1, capped: 2, unproven: 3 } as const;
    for (let i = 1; i < rows.length; i += 1) {
      expect(ranks[rows[i - 1].grade]).toBeLessThanOrEqual(ranks[rows[i].grade]);
    }
  });
});
