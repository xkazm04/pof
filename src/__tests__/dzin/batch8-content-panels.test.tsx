import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DensityProvider } from '@/lib/dzin/core';
import { MaterialPreviewPanel } from '@/components/modules/core-engine/dzin-panels/MaterialPreviewPanel';
import { AudioSpatialPanel } from '@/components/modules/core-engine/dzin-panels/AudioSpatialPanel';
import { ModelAssetsPanel } from '@/components/modules/core-engine/dzin-panels/ModelAssetsPanel';
import { LevelBlockoutPanel } from '@/components/modules/core-engine/dzin-panels/LevelBlockoutPanel';
import { VfxParticlesPanel } from '@/components/modules/core-engine/dzin-panels/VfxParticlesPanel';
import type { FeatureRow } from '@/types/feature-matrix';

afterEach(() => cleanup());

/* ── Test fixtures ──────────────────────────────────────────────────────── */

const mockDefs: { featureName: string; description: string; dependsOn?: string[] }[] = [];
const mockFeatureMap = new Map<string, FeatureRow>();

/* ── MaterialPreviewPanel ──────────────────────────────────────────────── */

describe('MaterialPreviewPanel at micro density', () => {
  it('renders a Paintbrush icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <MaterialPreviewPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders layer count', () => {
    render(
      <DensityProvider density="micro">
        <MaterialPreviewPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('4 layers')).toBeTruthy();
  });
});

describe('MaterialPreviewPanel at compact density', () => {
  it('renders material layer names', () => {
    render(
      <DensityProvider density="compact">
        <MaterialPreviewPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Master Material')).toBeTruthy();
    expect(screen.getByText('Dynamic Instances')).toBeTruthy();
    expect(screen.getByText('Post-Process Chain')).toBeTruthy();
    expect(screen.getByText('Substrate Slab')).toBeTruthy();
  });
});

describe('MaterialPreviewPanel at full density', () => {
  it('renders Material Layers section label', () => {
    render(
      <DensityProvider density="full">
        <MaterialPreviewPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Material Layers')).toBeTruthy();
  });

  it('renders Material Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <MaterialPreviewPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Material Pipeline')).toBeTruthy();
  });
});

/* ── AudioSpatialPanel ─────────────────────────────────────────────────── */

describe('AudioSpatialPanel at micro density', () => {
  it('renders a Volume2 icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <AudioSpatialPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders system count', () => {
    render(
      <DensityProvider density="micro">
        <AudioSpatialPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5 systems')).toBeTruthy();
  });
});

describe('AudioSpatialPanel at compact density', () => {
  it('renders audio system names', () => {
    render(
      <DensityProvider density="compact">
        <AudioSpatialPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Sound Manager')).toBeTruthy();
    expect(screen.getByText('Ambient Sounds')).toBeTruthy();
    expect(screen.getByText('Dynamic Music')).toBeTruthy();
    expect(screen.getByText('MetaSounds')).toBeTruthy();
    expect(screen.getByText('Reverb Zones')).toBeTruthy();
  });
});

describe('AudioSpatialPanel at full density', () => {
  it('renders Audio Systems section label', () => {
    render(
      <DensityProvider density="full">
        <AudioSpatialPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Audio Systems')).toBeTruthy();
  });

  it('renders Audio Processing Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <AudioSpatialPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Audio Processing Pipeline')).toBeTruthy();
  });
});

/* ── ModelAssetsPanel ──────────────────────────────────────────────────── */

describe('ModelAssetsPanel at micro density', () => {
  it('renders a Box icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <ModelAssetsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders type count', () => {
    render(
      <DensityProvider density="micro">
        <ModelAssetsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5 types')).toBeTruthy();
  });
});

describe('ModelAssetsPanel at compact density', () => {
  it('renders asset type names', () => {
    render(
      <DensityProvider density="compact">
        <ModelAssetsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Static Meshes')).toBeTruthy();
    expect(screen.getByText('Skeletal Meshes')).toBeTruthy();
    expect(screen.getByText('Collision Hulls')).toBeTruthy();
    expect(screen.getByText('Procedural Meshes')).toBeTruthy();
    expect(screen.getByText('Data Registries')).toBeTruthy();
  });
});

describe('ModelAssetsPanel at full density', () => {
  it('renders Asset Types section label', () => {
    render(
      <DensityProvider density="full">
        <ModelAssetsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Asset Types')).toBeTruthy();
  });

  it('renders Asset Import Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <ModelAssetsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Asset Import Pipeline')).toBeTruthy();
  });
});

/* ── LevelBlockoutPanel ────────────────────────────────────────────────── */

describe('LevelBlockoutPanel at micro density', () => {
  it('renders a Layers icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <LevelBlockoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders phase count', () => {
    render(
      <DensityProvider density="micro">
        <LevelBlockoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5 phases')).toBeTruthy();
  });
});

describe('LevelBlockoutPanel at compact density', () => {
  it('renders level phase names', () => {
    render(
      <DensityProvider density="compact">
        <LevelBlockoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Blockout Geometry')).toBeTruthy();
    expect(screen.getByText('Spawn Placement')).toBeTruthy();
    expect(screen.getByText('Level Streaming')).toBeTruthy();
    expect(screen.getByText('NavMesh Config')).toBeTruthy();
    expect(screen.getByText('PCG Procedural')).toBeTruthy();
  });
});

describe('LevelBlockoutPanel at full density', () => {
  it('renders Level Phases section label', () => {
    render(
      <DensityProvider density="full">
        <LevelBlockoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Level Phases')).toBeTruthy();
  });

  it('renders Level Build Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <LevelBlockoutPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Level Build Pipeline')).toBeTruthy();
  });
});

/* ── VfxParticlesPanel ─────────────────────────────────────────────────── */

describe('VfxParticlesPanel at micro density', () => {
  it('renders a Sparkles icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <VfxParticlesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders category count', () => {
    render(
      <DensityProvider density="micro">
        <VfxParticlesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5 types')).toBeTruthy();
  });
});

describe('VfxParticlesPanel at compact density', () => {
  it('renders VFX category names', () => {
    render(
      <DensityProvider density="compact">
        <VfxParticlesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Niagara Systems')).toBeTruthy();
    expect(screen.getByText('GPU Particles')).toBeTruthy();
    expect(screen.getByText('Mesh Particles')).toBeTruthy();
    expect(screen.getByText('Ribbon Trails')).toBeTruthy();
    expect(screen.getByText('Event Handlers')).toBeTruthy();
  });
});

describe('VfxParticlesPanel at full density', () => {
  it('renders VFX Categories section label', () => {
    render(
      <DensityProvider density="full">
        <VfxParticlesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('VFX Categories')).toBeTruthy();
  });

  it('renders VFX Render Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <VfxParticlesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('VFX Render Pipeline')).toBeTruthy();
  });
});
