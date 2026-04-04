import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DensityProvider } from '@/lib/dzin/core';
import { HudCompositorPanel } from '@/components/modules/core-engine/dzin-panels/HudCompositorPanel';
import { ScreenFlowPanel } from '@/components/modules/core-engine/dzin-panels/ScreenFlowPanel';
import { SaveSchemaPanel } from '@/components/modules/core-engine/dzin-panels/SaveSchemaPanel';
import { SaveSlotsPanel } from '@/components/modules/core-engine/dzin-panels/SaveSlotsPanel';
import { MenuFlowPanel } from '@/components/modules/core-engine/dzin-panels/MenuFlowPanel';
import type { FeatureRow } from '@/types/feature-matrix';

afterEach(() => cleanup());

/* ── Test fixtures ──────────────────────────────────────────────────────── */

const mockDefs: { featureName: string; description: string; dependsOn?: string[] }[] = [];
const mockFeatureMap = new Map<string, FeatureRow>();

/* ── HudCompositorPanel ──────────────────────────────────────────────── */

describe('HudCompositorPanel at micro density', () => {
  it('renders a Monitor icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <HudCompositorPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders widget count', () => {
    render(
      <DensityProvider density="micro">
        <HudCompositorPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('15 widgets')).toBeTruthy();
  });
});

describe('HudCompositorPanel at compact density', () => {
  it('renders z-layer names', () => {
    render(
      <DensityProvider density="compact">
        <HudCompositorPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('HUD')).toBeTruthy();
    expect(screen.getByText('Floating')).toBeTruthy();
    expect(screen.getByText('Overlay')).toBeTruthy();
    expect(screen.getByText('Modal')).toBeTruthy();
  });
});

describe('HudCompositorPanel at full density', () => {
  it('renders HUD Z-Layers section label', () => {
    render(
      <DensityProvider density="full">
        <HudCompositorPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('HUD Z-Layers')).toBeTruthy();
  });

  it('renders HUD Render Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <HudCompositorPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('HUD Render Pipeline')).toBeTruthy();
  });
});

/* ── ScreenFlowPanel ──────────────────────────────────────────────────── */

describe('ScreenFlowPanel at micro density', () => {
  it('renders screen count', () => {
    render(
      <DensityProvider density="micro">
        <ScreenFlowPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('6 screens')).toBeTruthy();
  });
});

describe('ScreenFlowPanel at compact density', () => {
  it('renders screen group names', () => {
    render(
      <DensityProvider density="compact">
        <ScreenFlowPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Core')).toBeTruthy();
    expect(screen.getByText('Floating')).toBeTruthy();
  });
});

describe('ScreenFlowPanel at full density', () => {
  it('renders Screen Groups section label', () => {
    render(
      <DensityProvider density="full">
        <ScreenFlowPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Screen Groups')).toBeTruthy();
  });

  it('renders Screen Transition Pipeline', () => {
    render(
      <DensityProvider density="full">
        <ScreenFlowPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Screen Transition Pipeline')).toBeTruthy();
  });
});

/* ── SaveSchemaPanel ──────────────────────────────────────────────────── */

describe('SaveSchemaPanel at micro density', () => {
  it('renders field count', () => {
    render(
      <DensityProvider density="micro">
        <SaveSchemaPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('10 fields')).toBeTruthy();
  });
});

describe('SaveSchemaPanel at compact density', () => {
  it('renders schema group labels', () => {
    render(
      <DensityProvider density="compact">
        <SaveSchemaPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('SYS.CHAR_STATE')).toBeTruthy();
    expect(screen.getByText('SYS.INV_BLOB')).toBeTruthy();
    expect(screen.getByText('SYS.WORLD_STATE')).toBeTruthy();
  });
});

describe('SaveSchemaPanel at full density', () => {
  it('renders Schema Groups section label', () => {
    render(
      <DensityProvider density="full">
        <SaveSchemaPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Schema Groups')).toBeTruthy();
  });

  it('renders Version History section', () => {
    render(
      <DensityProvider density="full">
        <SaveSchemaPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Version History')).toBeTruthy();
  });

  it('renders Save Pipeline', () => {
    render(
      <DensityProvider density="full">
        <SaveSchemaPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Save Pipeline')).toBeTruthy();
  });
});

/* ── SaveSlotsPanel ──────────────────────────────────────────────────── */

describe('SaveSlotsPanel at micro density', () => {
  it('renders slot count', () => {
    render(
      <DensityProvider density="micro">
        <SaveSlotsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('4/5 slots')).toBeTruthy();
  });
});

describe('SaveSlotsPanel at compact density', () => {
  it('renders slot labels', () => {
    render(
      <DensityProvider density="compact">
        <SaveSlotsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('AUTO_SAVE')).toBeTruthy();
    expect(screen.getByText('SLOT-01')).toBeTruthy();
    expect(screen.getByText('SLOT-04')).toBeTruthy();
  });
});

describe('SaveSlotsPanel at full density', () => {
  it('renders Save Slots section label', () => {
    render(
      <DensityProvider density="full">
        <SaveSlotsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getAllByText('Save Slots').length).toBeGreaterThanOrEqual(1);
  });

  it('renders File Size Budget section', () => {
    render(
      <DensityProvider density="full">
        <SaveSlotsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('File Size Budget')).toBeTruthy();
  });

  it('renders empty slot indicator', () => {
    render(
      <DensityProvider density="full">
        <SaveSlotsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Empty')).toBeTruthy();
  });
});

/* ── MenuFlowPanel ───────────────────────────────────────────────────── */

describe('MenuFlowPanel at micro density', () => {
  it('renders menu count', () => {
    render(
      <DensityProvider density="micro">
        <MenuFlowPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5 menus')).toBeTruthy();
  });
});

describe('MenuFlowPanel at compact density', () => {
  it('renders menu screen names', () => {
    render(
      <DensityProvider density="compact">
        <MenuFlowPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Main Menu')).toBeTruthy();
    expect(screen.getByText('Pause Menu')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Game Over')).toBeTruthy();
    expect(screen.getByText('Loading')).toBeTruthy();
  });
});

describe('MenuFlowPanel at full density', () => {
  it('renders Menu Screens section label', () => {
    render(
      <DensityProvider density="full">
        <MenuFlowPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Menu Screens')).toBeTruthy();
  });

  it('renders Accessibility Audit section', () => {
    render(
      <DensityProvider density="full">
        <MenuFlowPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Accessibility Audit')).toBeTruthy();
  });

  it('renders Menu Stack Pipeline', () => {
    render(
      <DensityProvider density="full">
        <MenuFlowPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Menu Stack Pipeline')).toBeTruthy();
  });
});
