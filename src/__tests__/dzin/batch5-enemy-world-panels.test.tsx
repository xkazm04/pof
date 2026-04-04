import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DensityProvider } from '@/lib/dzin/core';
import { EnemyBestiaryPanel } from '@/components/modules/core-engine/dzin-panels/EnemyBestiaryPanel';
import { EnemyAITreePanel } from '@/components/modules/core-engine/dzin-panels/EnemyAITreePanel';
import { WorldZoneMapPanel } from '@/components/modules/core-engine/dzin-panels/WorldZoneMapPanel';
import { WorldEncountersPanel } from '@/components/modules/core-engine/dzin-panels/WorldEncountersPanel';
import { WorldLevelDesignPanel } from '@/components/modules/core-engine/dzin-panels/WorldLevelDesignPanel';
import { ProgressionCurvesPanel } from '@/components/modules/core-engine/dzin-panels/ProgressionCurvesPanel';
import type { FeatureRow } from '@/types/feature-matrix';

afterEach(() => cleanup());

/* ── Test fixtures ──────────────────────────────────────────────────────── */

const mockDefs: { featureName: string; description: string; dependsOn?: string[] }[] = [];
const mockFeatureMap = new Map<string, FeatureRow>();

/* ── EnemyBestiaryPanel ──────────────────────────────────────────────── */

describe('EnemyBestiaryPanel at micro density', () => {
  it('renders a Skull icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <EnemyBestiaryPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders archetype count', () => {
    render(
      <DensityProvider density="micro">
        <EnemyBestiaryPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('4 types')).toBeTruthy();
  });
});

describe('EnemyBestiaryPanel at compact density', () => {
  it('renders archetype names', () => {
    render(
      <DensityProvider density="compact">
        <EnemyBestiaryPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Melee Grunt')).toBeTruthy();
    expect(screen.getByText('Ranged Caster')).toBeTruthy();
    expect(screen.getByText('Brute')).toBeTruthy();
    expect(screen.getByText('Assassin')).toBeTruthy();
  });
});

describe('EnemyBestiaryPanel at full density', () => {
  it('renders Enemy Archetypes section label', () => {
    render(
      <DensityProvider density="full">
        <EnemyBestiaryPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Enemy Archetypes')).toBeTruthy();
  });

  it('renders AI Execution Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <EnemyBestiaryPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('AI Execution Pipeline')).toBeTruthy();
  });
});

/* ── EnemyAITreePanel ────────────────────────────────────────────────── */

describe('EnemyAITreePanel at micro density', () => {
  it('renders a Brain icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <EnemyAITreePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders state count', () => {
    render(
      <DensityProvider density="micro">
        <EnemyAITreePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5 states')).toBeTruthy();
  });
});

describe('EnemyAITreePanel at compact density', () => {
  it('renders BT state names', () => {
    render(
      <DensityProvider density="compact">
        <EnemyAITreePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Idle')).toBeTruthy();
    expect(screen.getByText('Patrol')).toBeTruthy();
    expect(screen.getByText('Chase')).toBeTruthy();
    expect(screen.getByText('Attack')).toBeTruthy();
    expect(screen.getByText('Flee')).toBeTruthy();
  });
});

describe('EnemyAITreePanel at full density', () => {
  it('renders Behavior Tree States section', () => {
    render(
      <DensityProvider density="full">
        <EnemyAITreePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Behavior Tree States')).toBeTruthy();
  });

  it('renders BT Execution Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <EnemyAITreePanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('BT Execution Pipeline')).toBeTruthy();
  });
});

/* ── WorldZoneMapPanel ───────────────────────────────────────────────── */

describe('WorldZoneMapPanel at micro density', () => {
  it('renders a Map icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <WorldZoneMapPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders zone count', () => {
    render(
      <DensityProvider density="micro">
        <WorldZoneMapPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5 zones')).toBeTruthy();
  });
});

describe('WorldZoneMapPanel at compact density', () => {
  it('renders zone names', () => {
    render(
      <DensityProvider density="compact">
        <WorldZoneMapPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Town')).toBeTruthy();
    expect(screen.getByText('Forest')).toBeTruthy();
    expect(screen.getByText('Ruins')).toBeTruthy();
    expect(screen.getByText('Catacombs')).toBeTruthy();
    expect(screen.getByText('Boss Arena')).toBeTruthy();
  });
});

describe('WorldZoneMapPanel at full density', () => {
  it('renders Zone Layout section', () => {
    render(
      <DensityProvider density="full">
        <WorldZoneMapPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Zone Layout')).toBeTruthy();
  });

  it('renders World Build Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <WorldZoneMapPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('World Build Pipeline')).toBeTruthy();
  });
});

/* ── WorldEncountersPanel ────────────────────────────────────────────── */

describe('WorldEncountersPanel at micro density', () => {
  it('renders a Swords icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <WorldEncountersPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders total encounter count', () => {
    render(
      <DensityProvider density="micro">
        <WorldEncountersPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('27 encounters')).toBeTruthy();
  });
});

describe('WorldEncountersPanel at compact density', () => {
  it('renders encounter type names', () => {
    render(
      <DensityProvider density="compact">
        <WorldEncountersPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Ambient')).toBeTruthy();
    expect(screen.getByText('Wave')).toBeTruthy();
    expect(screen.getByText('Boss')).toBeTruthy();
    expect(screen.getByText('Trap')).toBeTruthy();
  });
});

describe('WorldEncountersPanel at full density', () => {
  it('renders Encounter Types section', () => {
    render(
      <DensityProvider density="full">
        <WorldEncountersPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Encounter Types')).toBeTruthy();
  });
});

/* ── WorldLevelDesignPanel ───────────────────────────────────────────── */

describe('WorldLevelDesignPanel at micro density', () => {
  it('renders a Layers icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <WorldLevelDesignPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders phase count', () => {
    render(
      <DensityProvider density="micro">
        <WorldLevelDesignPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('4 phases')).toBeTruthy();
  });
});

describe('WorldLevelDesignPanel at compact density', () => {
  it('renders phase names', () => {
    render(
      <DensityProvider density="compact">
        <WorldLevelDesignPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Greybox')).toBeTruthy();
    expect(screen.getByText('Art Pass')).toBeTruthy();
    expect(screen.getByText('Gameplay')).toBeTruthy();
  });
});

describe('WorldLevelDesignPanel at full density', () => {
  it('renders Production Phases section', () => {
    render(
      <DensityProvider density="full">
        <WorldLevelDesignPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Production Phases')).toBeTruthy();
  });

  it('renders Level Production Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <WorldLevelDesignPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Level Production Pipeline')).toBeTruthy();
  });
});

/* ── ProgressionCurvesPanel ──────────────────────────────────────────── */

describe('ProgressionCurvesPanel at micro density', () => {
  it('renders a TrendingUp icon (SVG)', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <ProgressionCurvesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders curve count', () => {
    render(
      <DensityProvider density="micro">
        <ProgressionCurvesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('5 curves')).toBeTruthy();
  });
});

describe('ProgressionCurvesPanel at compact density', () => {
  it('renders curve metric names', () => {
    render(
      <DensityProvider density="compact">
        <ProgressionCurvesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('XP Curve')).toBeTruthy();
    expect(screen.getByText('Power Curve')).toBeTruthy();
    expect(screen.getByText('Difficulty')).toBeTruthy();
  });
});

describe('ProgressionCurvesPanel at full density', () => {
  it('renders Scaling Curves section', () => {
    render(
      <DensityProvider density="full">
        <ProgressionCurvesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Scaling Curves')).toBeTruthy();
  });

  it('renders Level-Up Pipeline section', () => {
    render(
      <DensityProvider density="full">
        <ProgressionCurvesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Level-Up Pipeline')).toBeTruthy();
  });
});

/* ── Registration ────────────────────────────────────────────────────── */

describe('Panel registration in pofRegistry', () => {
  it('all 6 enemy/world/progression panels are registered', async () => {
    const { pofRegistry } = await import('@/lib/dzin/panel-definitions');
    const types = [
      'arpg-enemy-bestiary', 'arpg-enemy-ai-tree',
      'arpg-world-zone-map', 'arpg-world-encounters', 'arpg-world-level-design',
      'arpg-progression-curves',
    ];
    for (const t of types) {
      expect(pofRegistry.get(t), `${t} should be registered`).toBeTruthy();
    }
  });
});
