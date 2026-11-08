import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { getStepComponent } from '@/components/layout-lab/steps';
import { ITEM_STEP_COPY } from '@/components/layout-lab/steps/itemsSteps';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * The bespoke Items steps (the 7 labels `itemsLabelOwner` leaves bespoke) must say what their
 * artifact actually records: a number on screen may not round an over-budget value onto its
 * own budget, and the copy may not state facts the artifact never wrote.
 */

const t = LAB_THEMES[0];
const entity: LabEntity = { id: 'truth-1', name: 'Iron Longsword', lifecycle: 'planned', data: {} };

function seed(step: string, data: Record<string, unknown>) {
  useLabPipelineStore.setState({
    byEntity: { [entity.id]: { [step]: { done: true, data, ueAssets: [], at: '2026-01-01T00:00:00.000Z' } } },
  });
}

afterEach(() => {
  cleanup();
  useLabPipelineStore.setState({ byEntity: {} });
  vi.unstubAllGlobals();
});

describe('VFX GPU cost is never rounded onto its own budget', () => {
  const over = { variants: [['Idle glow', 'small']], cost: 0.85, cap: 0.8 };

  it('the acceptance copy names the real over-budget cost, not the cap', () => {
    const why = ITEM_STEP_COPY['VFX'](over).why;
    expect(why).toContain('0.85');
    expect(why).not.toContain('(0.8ms)');
  });

  it('the GPU budget panel prints the real cost beside the cap', () => {
    seed('VFX', over);
    const Step = getStepComponent('items', 'VFX')!;
    const { container } = render(<Step t={t} entity={entity} step="VFX" />);
    const text = container.textContent ?? '';
    expect(text).toContain('0.85 ms of 0.8 ms');
    expect(text).not.toContain('0.8 ms of 0.8 ms');
  });
});
