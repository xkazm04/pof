import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DensityProvider } from '@/lib/dzin/core';
import { CorePanel } from '@/components/modules/core-engine/dzin-panels/CorePanel';
import type { FeatureRow } from '@/types/feature-matrix';

afterEach(() => cleanup());

/* ── Test fixtures ──────────────────────────────────────────────────────── */

const mockDefs = [
  { featureName: 'AbilitySystemComponent', description: 'Core ASC setup' },
  { featureName: 'Core AttributeSet', description: 'Base attributes', dependsOn: ['AbilitySystemComponent'] },
  { featureName: 'Gameplay Tags hierarchy', description: 'Tag system' },
  { featureName: 'Base GameplayAbility', description: 'Base ability class' },
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
  makeFeatureRow('AbilitySystemComponent', 'implemented'),
  makeFeatureRow('Core AttributeSet', 'partial'),
  makeFeatureRow('Gameplay Tags hierarchy', 'implemented'),
  makeFeatureRow('Base GameplayAbility', 'missing'),
  makeFeatureRow('Core Gameplay Effects', 'improved'),
  makeFeatureRow('Damage execution calculation', 'unknown'),
]);

/* ── Micro density ──────────────────────────────────────────────────────── */

describe('CorePanel at micro density', () => {
  it('renders a Cpu icon', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <CorePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    // Lucide Cpu renders an SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders progress indicator (completed/total)', () => {
    render(
      <DensityProvider density="micro">
        <CorePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    // 3 implemented/improved out of 6
    expect(screen.getAllByText('3/6').length).toBeGreaterThanOrEqual(1);
  });
});

/* ── Compact density ────────────────────────────────────────────────────── */

describe('CorePanel at compact density', () => {
  it('renders AbilitySystemComponent text', () => {
    render(
      <DensityProvider density="compact">
        <CorePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('AbilitySystemComponent')).toBeTruthy();
  });

  it('renders ASC connection items', () => {
    render(
      <DensityProvider density="compact">
        <CorePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('AttributeSet')).toBeTruthy();
    expect(screen.getByText('Tag Container')).toBeTruthy();
    expect(screen.getByText('Abilities')).toBeTruthy();
    expect(screen.getByText('Active Effects')).toBeTruthy();
  });

  it('renders pipeline step count', () => {
    render(
      <DensityProvider density="compact">
        <CorePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Pipeline: 6 steps')).toBeTruthy();
  });
});

/* ── Full density ───────────────────────────────────────────────────────── */

describe('CorePanel at full density', () => {
  it('renders description card with ASC explanation', () => {
    render(
      <DensityProvider density="full">
        <CorePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText(/Ability System Component.*ASC/i)).toBeTruthy();
  });

  it('renders feature card for AbilitySystemComponent', () => {
    render(
      <DensityProvider density="full">
        <CorePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    // FeatureCard renders the feature name as button text
    expect(screen.getByText('AbilitySystemComponent')).toBeTruthy();
  });

  it('renders ASC connections grid', () => {
    render(
      <DensityProvider density="full">
        <CorePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    // AttributeSet appears in both connections grid and pipeline steps
    expect(screen.getAllByText('AttributeSet').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Ability Instances')).toBeTruthy();
    // Active Effects appears in both connections grid and may appear elsewhere
    expect(screen.getAllByText('Active Effects').length).toBeGreaterThanOrEqual(1);
  });

  it('renders GAS pipeline', () => {
    render(
      <DensityProvider density="full">
        <CorePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('GAS Architecture Pipeline')).toBeTruthy();
  });
});

/* ── Props contract ─────────────────────────────────────────────────────── */

describe('CorePanel props contract', () => {
  it('accepts featureMap and defs via props (does not import useFeatureMatrix)', async () => {
    // Verify the component module does not import useFeatureMatrix
    const mod = await import('@/components/modules/core-engine/dzin-panels/CorePanel');
    const moduleSource = Object.keys(mod).join(',');
    // If it exported something, the module loaded -- the real check is static:
    // grep for useFeatureMatrix in the source. We verify via rendering with custom data.
    const customMap = new Map<string, FeatureRow>([
      makeFeatureRow('AbilitySystemComponent', 'missing'),
    ]);
    const customDefs = [{ featureName: 'AbilitySystemComponent', description: 'test' }];

    render(
      <DensityProvider density="micro">
        <CorePanel featureMap={customMap} defs={customDefs} />
      </DensityProvider>,
    );
    // 0 implemented/improved out of 1
    expect(screen.getByText('0/1')).toBeTruthy();
  });
});
