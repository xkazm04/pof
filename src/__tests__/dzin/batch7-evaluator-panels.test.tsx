import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DensityProvider } from '@/lib/dzin/core';
import { EvalQualityPanel } from '@/components/modules/core-engine/dzin-panels/EvalQualityPanel';
import { EvalDepsPanel } from '@/components/modules/core-engine/dzin-panels/EvalDepsPanel';
import { EvalInsightsPanel } from '@/components/modules/core-engine/dzin-panels/EvalInsightsPanel';
import { ProjectHealthPanel } from '@/components/modules/core-engine/dzin-panels/ProjectHealthPanel';
import { FeatureMatrixPanel } from '@/components/modules/core-engine/dzin-panels/FeatureMatrixPanel';
import type { FeatureRow } from '@/types/feature-matrix';

afterEach(() => cleanup());

/* ── Test fixtures ──────────────────────────────────────────────────────── */

const mockDefs: { featureName: string; description: string; dependsOn?: string[] }[] = [];
const mockFeatureMap = new Map<string, FeatureRow>();

/* ── EvalQualityPanel ──────────────────────────────────────────────── */

describe('EvalQualityPanel at micro density', () => {
  it('renders an Activity icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <EvalQualityPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders average score', () => {
    render(
      <DensityProvider density="micro">
        <EvalQualityPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText(/avg \d+\.\d/)).toBeTruthy();
  });
});

describe('EvalQualityPanel at compact density', () => {
  it('renders module names', () => {
    render(
      <DensityProvider density="compact">
        <EvalQualityPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('combat')).toBeTruthy();
    expect(screen.getByText('character')).toBeTruthy();
    expect(screen.getByText('inventory')).toBeTruthy();
  });
});

describe('EvalQualityPanel at full density', () => {
  it('renders Module Scores section label', () => {
    render(
      <DensityProvider density="full">
        <EvalQualityPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Module Scores')).toBeTruthy();
  });

  it('renders Quality Summary section', () => {
    render(
      <DensityProvider density="full">
        <EvalQualityPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Quality Summary')).toBeTruthy();
  });
});

/* ── EvalDepsPanel ──────────────────────────────────────────────────── */

describe('EvalDepsPanel at micro density', () => {
  it('renders blocked count', () => {
    render(
      <DensityProvider density="micro">
        <EvalDepsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText(/\d+ blocked/)).toBeTruthy();
  });
});

describe('EvalDepsPanel at compact density', () => {
  it('renders module dep counts', () => {
    render(
      <DensityProvider density="compact">
        <EvalDepsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('combat')).toBeTruthy();
    expect(screen.getByText('4 deps')).toBeTruthy();
  });
});

describe('EvalDepsPanel at full density', () => {
  it('renders Module Dependencies section', () => {
    render(
      <DensityProvider density="full">
        <EvalDepsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Module Dependencies')).toBeTruthy();
  });

  it('renders Dependency Resolution Pipeline', () => {
    render(
      <DensityProvider density="full">
        <EvalDepsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Dependency Resolution Pipeline')).toBeTruthy();
  });
});

/* ── EvalInsightsPanel ────────────────────────────────────────────────── */

describe('EvalInsightsPanel at micro density', () => {
  it('renders insight count', () => {
    render(
      <DensityProvider density="micro">
        <EvalInsightsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5 insights')).toBeTruthy();
  });
});

describe('EvalInsightsPanel at compact density', () => {
  it('renders insight titles', () => {
    render(
      <DensityProvider density="compact">
        <EvalInsightsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Brittle Module: arpg-world')).toBeTruthy();
    expect(screen.getByText('Blocked Progress: arpg-loot')).toBeTruthy();
  });
});

describe('EvalInsightsPanel at full density', () => {
  it('renders Active Insights section', () => {
    render(
      <DensityProvider density="full">
        <EvalInsightsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Active Insights')).toBeTruthy();
  });

  it('renders Insight Summary section', () => {
    render(
      <DensityProvider density="full">
        <EvalInsightsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Insight Summary')).toBeTruthy();
  });
});

/* ── ProjectHealthPanel ───────────────────────────────────────────────── */

describe('ProjectHealthPanel at micro density', () => {
  it('renders health percentage', () => {
    render(
      <DensityProvider density="micro">
        <ProjectHealthPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText(/\d+%/)).toBeTruthy();
  });
});

describe('ProjectHealthPanel at compact density', () => {
  it('renders health dimension names', () => {
    render(
      <DensityProvider density="compact">
        <ProjectHealthPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Feature Completion')).toBeTruthy();
    expect(screen.getByText('Quality Coverage')).toBeTruthy();
    expect(screen.getByText('Build Stability')).toBeTruthy();
  });
});

describe('ProjectHealthPanel at full density', () => {
  it('renders Health Dimensions section', () => {
    render(
      <DensityProvider density="full">
        <ProjectHealthPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Health Dimensions')).toBeTruthy();
  });

  it('renders Health Scan Pipeline', () => {
    render(
      <DensityProvider density="full">
        <ProjectHealthPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Health Scan Pipeline')).toBeTruthy();
  });
});

/* ── FeatureMatrixPanel ───────────────────────────────────────────────── */

describe('FeatureMatrixPanel at micro density', () => {
  it('renders completion percentage', () => {
    render(
      <DensityProvider density="micro">
        <FeatureMatrixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText(/\d+% done/)).toBeTruthy();
  });
});

describe('FeatureMatrixPanel at compact density', () => {
  it('renders status labels', () => {
    render(
      <DensityProvider density="compact">
        <FeatureMatrixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Implemented')).toBeTruthy();
    expect(screen.getByText('Partial')).toBeTruthy();
    expect(screen.getByText('Missing')).toBeTruthy();
  });

  it('renders total features count', () => {
    render(
      <DensityProvider density="compact">
        <FeatureMatrixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('80 total features tracked')).toBeTruthy();
  });
});

describe('FeatureMatrixPanel at full density', () => {
  it('renders Status Breakdown section', () => {
    render(
      <DensityProvider density="full">
        <FeatureMatrixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Status Breakdown')).toBeTruthy();
  });

  it('renders Feature Tracking Pipeline', () => {
    render(
      <DensityProvider density="full">
        <FeatureMatrixPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Feature Tracking Pipeline')).toBeTruthy();
  });
});
