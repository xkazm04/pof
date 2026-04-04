import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DensityProvider } from '@/lib/dzin/core';
import { AttributesPanel } from '@/components/modules/core-engine/dzin-panels/AttributesPanel';
import { TagsPanel } from '@/components/modules/core-engine/dzin-panels/TagsPanel';
import { AbilitiesPanel } from '@/components/modules/core-engine/dzin-panels/AbilitiesPanel';
import type { FeatureRow } from '@/types/feature-matrix';

afterEach(() => cleanup());

/* -- Test fixtures --------------------------------------------------------- */

const mockDefs = [
  { featureName: 'Core AttributeSet', description: 'Base attributes', dependsOn: ['AbilitySystemComponent'] },
  { featureName: 'Default attribute initialization', description: 'Init attrs' },
  { featureName: 'Gameplay Tags hierarchy', description: 'Tag system' },
  { featureName: 'Base GameplayAbility', description: 'Base ability class' },
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
  makeFeatureRow('Core AttributeSet', 'partial'),
  makeFeatureRow('Default attribute initialization', 'implemented'),
  makeFeatureRow('Gameplay Tags hierarchy', 'implemented'),
  makeFeatureRow('Base GameplayAbility', 'missing'),
]);

/* -- AttributesPanel ------------------------------------------------------- */

describe('AttributesPanel at micro density', () => {
  it('renders an SVG icon', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <AttributesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders attribute count (9)', () => {
    render(
      <DensityProvider density="micro">
        <AttributesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('9')).toBeTruthy();
  });
});

describe('AttributesPanel at compact density', () => {
  it('renders Core Attributes text', () => {
    render(
      <DensityProvider density="compact">
        <AttributesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Core Attributes')).toBeTruthy();
  });

  it('renders Derived Attributes text', () => {
    render(
      <DensityProvider density="compact">
        <AttributesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Derived Attributes')).toBeTruthy();
  });
});

describe('AttributesPanel at full density', () => {
  it('renders feature card for Core AttributeSet', () => {
    render(
      <DensityProvider density="full">
        <AttributesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Core AttributeSet')).toBeTruthy();
  });

  it('renders Attribute Set Catalog section', () => {
    render(
      <DensityProvider density="full">
        <AttributesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Attribute Set Catalog')).toBeTruthy();
  });

  it('renders Attribute Relationship Web label', () => {
    render(
      <DensityProvider density="full">
        <AttributesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Attribute Relationship Web')).toBeTruthy();
  });
});

/* -- TagsPanel ------------------------------------------------------------- */

describe('TagsPanel at micro density', () => {
  it('renders an SVG icon', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <TagsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders total tag count (16)', () => {
    render(
      <DensityProvider density="micro">
        <TagsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('16')).toBeTruthy();
  });
});

describe('TagsPanel at compact density', () => {
  it('renders Tag Hierarchy header', () => {
    render(
      <DensityProvider density="compact">
        <TagsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Tag Hierarchy')).toBeTruthy();
  });

  it('renders individual tag names', () => {
    render(
      <DensityProvider density="compact">
        <TagsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Ability.MeleeAttack')).toBeTruthy();
    expect(screen.getByText('Input.Attack')).toBeTruthy();
  });
});

describe('TagsPanel at full density', () => {
  it('renders feature card for Gameplay Tags hierarchy', () => {
    render(
      <DensityProvider density="full">
        <TagsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Gameplay Tags hierarchy')).toBeTruthy();
  });

  it('renders Tag Hierarchy section label', () => {
    render(
      <DensityProvider density="full">
        <TagsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Tag Hierarchy')).toBeTruthy();
  });

  it('renders individual tag entries', () => {
    render(
      <DensityProvider density="full">
        <TagsPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Ability.MeleeAttack')).toBeTruthy();
    expect(screen.getByText('State.Dead')).toBeTruthy();
  });
});

/* -- AbilitiesPanel -------------------------------------------------------- */

describe('AbilitiesPanel at micro density', () => {
  it('renders an SVG icon', () => {
    const { container } = render(
      <DensityProvider density="micro">
        <AbilitiesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders ability count (3)', () => {
    render(
      <DensityProvider density="micro">
        <AbilitiesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('3')).toBeTruthy();
  });
});

describe('AbilitiesPanel at compact density', () => {
  it('renders ability names', () => {
    render(
      <DensityProvider density="compact">
        <AbilitiesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('MeleeAttack')).toBeTruthy();
    expect(screen.getByText('Fireball')).toBeTruthy();
    expect(screen.getByText('FrostNova')).toBeTruthy();
  });

  it('renders cooldown values', () => {
    render(
      <DensityProvider density="compact">
        <AbilitiesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('0.5s')).toBeTruthy();
    expect(screen.getByText('3s')).toBeTruthy();
  });
});

describe('AbilitiesPanel at full density', () => {
  it('renders feature card for Base GameplayAbility', () => {
    render(
      <DensityProvider density="full">
        <AbilitiesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Base GameplayAbility')).toBeTruthy();
  });

  it('renders Ability Radar Comparison section', () => {
    render(
      <DensityProvider density="full">
        <AbilitiesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Ability Radar Comparison')).toBeTruthy();
  });

  it('renders Cooldown Flow section', () => {
    render(
      <DensityProvider density="full">
        <AbilitiesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText('Cooldown Flow')).toBeTruthy();
  });
});
