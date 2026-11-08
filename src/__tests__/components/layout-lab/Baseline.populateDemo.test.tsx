/**
 * "Populate demo" fills GAPS only, so it never overwrites a step's content (and a generative
 * step's kept batch history). Its gap test read a record's PRESENCE as content — so a step whose
 * only record is a produce FAILURE MARKER (`{ done: false, data: {}, error }`, `stepRecord.ts`:
 * no content) was skipped, and the one step the operator most needed filled stayed empty.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  fetchArtifactsResult: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  postArtifact: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  drainGates: vi.fn().mockResolvedValue(null),
  deleteEntityArtifacts: vi.fn().mockResolvedValue({ ok: true, data: 0 }),
}));
vi.mock('@/components/layout-lab/steps', () => ({ getStepComponent: vi.fn().mockReturnValue(null) }));

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';

const groups = [{ category: 'Core', catalogs: [{ catalogId: 'items', label: 'Items', description: '', total: 1 }] }];
const detail = {
  catalog: { catalogId: 'items', label: 'Items', description: 'Items', total: 1 },
  entities: [{ id: 'item-1', name: 'Sword', lifecycle: 'planned' as const, data: {} }],
  steps: ['Concept Brief', 'Economy'],
};

beforeEach(() => { _resetArtifactCache(); useLabPipelineStore.setState({ byEntity: {} }); });
afterEach(() => { cleanup(); useLabPipelineStore.setState({ byEntity: {} }); _resetArtifactCache(); });

describe('Baseline — Populate demo fills a step whose only record is a failure', () => {
  it('produces over a failure marker, and leaves produced content alone', () => {
    const kept = { done: true, data: { price: 7 }, ueAssets: [], at: '2026-11-08T00:00:00Z' };
    useLabPipelineStore.setState({ byEntity: { 'item-1': {
      'Concept Brief': { done: false, data: {}, ueAssets: [], at: '2026-11-08T00:00:00Z', error: 'boom' },
      Economy: kept,
    } } });
    render(<Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="item-1" onSelectEntity={() => {}} />);

    fireEvent.click(screen.getByText('Populate demo'));

    const steps = useLabPipelineStore.getState().byEntity['item-1'];
    expect(steps['Concept Brief'].done).toBe(true);
    expect(steps['Concept Brief'].error).toBeUndefined();
    expect(steps.Economy).toBe(kept);
  });
});
