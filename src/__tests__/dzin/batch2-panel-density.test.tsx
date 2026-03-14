import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DensityProvider } from '@/lib/dzin/core';
import { EffectsPanel } from '@/components/modules/core-engine/dzin-panels/EffectsPanel';
import { TagDepsPanel } from '@/components/modules/core-engine/dzin-panels/TagDepsPanel';
import { EffectTimelinePanel } from '@/components/modules/core-engine/dzin-panels/EffectTimelinePanel';
import type { FeatureRow } from '@/types/feature-matrix';

afterEach(() => cleanup());

/* ── Test fixtures ──────────────────────────────────────────────────────── */

const mockDefs = [
  { featureName: 'Core Gameplay Effects', description: 'GE foundation' },
  { featureName: 'Damage execution calculation', description: 'Exec calc' },
];

function makeFeatureRow(name: string, status: FeatureRow['status']): [string, FeatureRow] {
  return [name, {
    id: Math.random(),
    moduleId: 'arpg-combat' as FeatureRow['moduleId'],
    featureName: name,
    category: 'core',
    status,
    description: `${name} description`,
    filePaths: [],
    reviewNotes: '',
    qualityScore: null,
    nextSteps: '',
    lastReviewedAt: null,
  }];
}

const mockFeatureMap = new Map<string, FeatureRow>([
  makeFeatureRow('Core Gameplay Effects', 'improved'),
  makeFeatureRow('Damage execution calculation', 'unknown'),
]);

/* ── EffectsPanel ──────────────────────────────────────────────────────── */

describe('EffectsPanel at micro density', () => {
  it('renders a Flame icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <EffectsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders effect count badge (4)', () => {
    render(
      <DensityProvider density="micro">
        <EffectsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('4')).toBeTruthy();
  });
});

describe('EffectsPanel at compact density', () => {
  it('renders effect type names', () => {
    render(
      <DensityProvider density="compact">
        <EffectsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('GE_Damage')).toBeTruthy();
    expect(screen.getByText('GE_Heal')).toBeTruthy();
    expect(screen.getByText('GE_Buff')).toBeTruthy();
    expect(screen.getByText('GE_Regen')).toBeTruthy();
  });

  it('renders feature status indicators', () => {
    render(
      <DensityProvider density="compact">
        <EffectsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Core Gameplay Effects')).toBeTruthy();
    expect(screen.getByText('Damage execution calculation')).toBeTruthy();
  });
});

describe('EffectsPanel at full density', () => {
  it('renders Effect Types section label', () => {
    render(
      <DensityProvider density="full">
        <EffectsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Effect Types')).toBeTruthy();
  });

  it('renders Effect Application Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <EffectsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Effect Application Pipeline')).toBeTruthy();
  });
});

/* ── TagDepsPanel ──────────────────────────────────────────────────────── */

describe('TagDepsPanel at micro density', () => {
  it('renders a Network icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <TagDepsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders edge count badge (6)', () => {
    render(
      <DensityProvider density="micro">
        <TagDepsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('6')).toBeTruthy();
  });
});

describe('TagDepsPanel at compact density', () => {
  it('renders "blocks" text for edges', () => {
    render(
      <DensityProvider density="compact">
        <TagDepsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const blocksElements = screen.getAllByText('blocks');
    expect(blocksElements.length).toBe(6);
  });

  it('renders node names', () => {
    render(
      <DensityProvider density="compact">
        <TagDepsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Stunned')).toBeTruthy();
    expect(screen.getAllByText('Dead').length).toBeGreaterThanOrEqual(1);
  });
});

describe('TagDepsPanel at full density', () => {
  it('renders Tag Dependency Network section label', () => {
    render(
      <DensityProvider density="full">
        <TagDepsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Tag Dependency Network')).toBeTruthy();
  });

  it('renders SVG network graph', () => {
    const { container } = render(
      <DensityProvider density="full">
        <TagDepsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    // Should have SVG circles for nodes
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(9);
  });

  it('renders Categories legend', () => {
    render(
      <DensityProvider density="full">
        <TagDepsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Categories')).toBeTruthy();
    expect(screen.getByText('Ability')).toBeTruthy();
    expect(screen.getByText('State')).toBeTruthy();
  });
});

/* ── EffectTimelinePanel ───────────────────────────────────────────────── */

describe('EffectTimelinePanel at micro density', () => {
  it('renders a Clock icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <EffectTimelinePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders timeline span badge', () => {
    render(
      <DensityProvider density="micro">
        <EffectTimelinePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('0.5s - 10.5s')).toBeTruthy();
  });
});

describe('EffectTimelinePanel at compact density', () => {
  it('renders timeline bar with time labels', () => {
    render(
      <DensityProvider density="compact">
        <EffectTimelinePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('0.5s')).toBeTruthy();
    expect(screen.getByText('10.5s')).toBeTruthy();
  });
});

describe('EffectTimelinePanel at full density', () => {
  it('renders Effect Stack Timeline section label', () => {
    render(
      <DensityProvider density="full">
        <EffectTimelinePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Effect Stack Timeline')).toBeTruthy();
  });
});
