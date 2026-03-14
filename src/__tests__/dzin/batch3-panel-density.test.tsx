import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DensityProvider } from '@/lib/dzin/core';
import { DamageCalcPanel } from '@/components/modules/core-engine/dzin-panels/DamageCalcPanel';
import { TagAuditPanel } from '@/components/modules/core-engine/dzin-panels/TagAuditPanel';
import { LoadoutPanel } from '@/components/modules/core-engine/dzin-panels/LoadoutPanel';
import type { FeatureRow } from '@/types/feature-matrix';

afterEach(() => cleanup());

/* ── Test fixtures ──────────────────────────────────────────────────────── */

const mockDefs: { featureName: string; description: string; dependsOn?: string[] }[] = [];

const mockFeatureMap = new Map<string, FeatureRow>();

/* ── DamageCalcPanel ───────────────────────────────────────────────────── */

describe('DamageCalcPanel at micro density', () => {
  it('renders a Calculator icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <DamageCalcPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders step count text', () => {
    render(
      <DensityProvider density="micro">
        <DamageCalcPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('7 steps')).toBeTruthy();
  });
});

describe('DamageCalcPanel at compact density', () => {
  it('renders pipeline step labels', () => {
    render(
      <DensityProvider density="compact">
        <DamageCalcPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('CommitAbility')).toBeTruthy();
    expect(screen.getByText('CheckCost')).toBeTruthy();
    expect(screen.getByText('ApplyDamage')).toBeTruthy();
    expect(screen.getByText('PostGEExecute')).toBeTruthy();
  });
});

describe('DamageCalcPanel at full density', () => {
  it('renders section label for execution pipeline', () => {
    render(
      <DensityProvider density="full">
        <DamageCalcPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Damage Execution Pipeline')).toBeTruthy();
  });

  it('renders GAS steps in SVG sequence diagram', () => {
    const { container } = render(
      <DensityProvider density="full">
        <DamageCalcPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    // SVG rect elements for each step box
    const rects = container.querySelectorAll('rect');
    // 7 step rects + potential PanelFrame chrome rects
    expect(rects.length).toBeGreaterThanOrEqual(7);
  });
});

/* ── TagAuditPanel ─────────────────────────────────────────────────────── */

describe('TagAuditPanel at micro density', () => {
  it('renders a ClipboardCheck icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <TagAuditPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders audit score percentage', () => {
    render(
      <DensityProvider density="micro">
        <TagAuditPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('85%')).toBeTruthy();
  });
});

describe('TagAuditPanel at compact density', () => {
  it('renders audit category names', () => {
    render(
      <DensityProvider density="compact">
        <TagAuditPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Duplicates')).toBeTruthy();
    expect(screen.getByText('Unused')).toBeTruthy();
    expect(screen.getByText('Missing')).toBeTruthy();
    expect(screen.getByText('Naming')).toBeTruthy();
  });

  it('renders status indicators', () => {
    render(
      <DensityProvider density="compact">
        <TagAuditPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    // 2 PASS categories, 1 WARN, 1 FAIL
    expect(screen.getAllByText('PASS').length).toBe(2);
    expect(screen.getByText('WARN')).toBeTruthy();
    expect(screen.getByText('FAIL')).toBeTruthy();
  });

  it('renders overall score', () => {
    render(
      <DensityProvider density="compact">
        <TagAuditPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Score: 85%')).toBeTruthy();
  });
});

describe('TagAuditPanel at full density', () => {
  it('renders Tag Audit Dashboard section label', () => {
    render(
      <DensityProvider density="full">
        <TagAuditPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Tag Audit Dashboard')).toBeTruthy();
  });

  it('renders tag usage frequency section', () => {
    render(
      <DensityProvider density="full">
        <TagAuditPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Tag Usage Frequency (Top 10)')).toBeTruthy();
    expect(screen.getByText('State.Dead')).toBeTruthy();
  });

  it('renders audit categories with detail text', () => {
    render(
      <DensityProvider density="full">
        <TagAuditPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('No duplicate tags found')).toBeTruthy();
    expect(screen.getByText('All tags follow naming convention')).toBeTruthy();
  });
});

/* ── LoadoutPanel ──────────────────────────────────────────────────────── */

describe('LoadoutPanel at micro density', () => {
  it('renders a Layers icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <LoadoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders slot count', () => {
    render(
      <DensityProvider density="micro">
        <LoadoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('4 slots')).toBeTruthy();
  });
});

describe('LoadoutPanel at compact density', () => {
  it('renders ability names', () => {
    render(
      <DensityProvider density="compact">
        <LoadoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('MeleeAttack')).toBeTruthy();
    expect(screen.getByText('Fireball')).toBeTruthy();
    expect(screen.getByText('FrostNova')).toBeTruthy();
    expect(screen.getByText('Dodge')).toBeTruthy();
  });

  it('renders loadout score', () => {
    render(
      <DensityProvider density="compact">
        <LoadoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Score: 78')).toBeTruthy();
  });
});

describe('LoadoutPanel at full density', () => {
  it('renders Ability Loadout Optimizer section label', () => {
    render(
      <DensityProvider density="full">
        <LoadoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Ability Loadout Optimizer')).toBeTruthy();
  });

  it('renders optimal loadout grid', () => {
    render(
      <DensityProvider density="full">
        <LoadoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Optimal Loadout')).toBeTruthy();
    expect(screen.getByText('78/100')).toBeTruthy();
  });

  it('renders alternative loadouts', () => {
    render(
      <DensityProvider density="full">
        <LoadoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Alternative Loadouts')).toBeTruthy();
    expect(screen.getByText('Burst DPS')).toBeTruthy();
    expect(screen.getByText('Control')).toBeTruthy();
    expect(screen.getByText('Balanced')).toBeTruthy();
  });

  it('renders radar chart SVG', () => {
    const { container } = render(
      <DensityProvider density="full">
        <LoadoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    // RadarChart renders SVG with polygon elements
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBeGreaterThan(0);
  });
});
