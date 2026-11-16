/**
 * A refresh's report is a fact about ONE entity. It was instance-scoped state cleared by an
 * entity-switch effect — which runs BEFORE an in-flight refresh resolves, so a refresh started
 * on item-1 and answered after the operator moved to item-2 printed item-1's "Removed / kept"
 * report on item-2's rail (same class as the reset failure keyed in 08bfc921).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

const fetchArtifactsResult = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  fetchArtifactsResult: (...a: unknown[]) => fetchArtifactsResult(...a),
  postArtifact: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  drainGates: vi.fn().mockResolvedValue(null),
  deleteEntityArtifacts: vi.fn().mockResolvedValue({ ok: true, data: 0 }),
}));
vi.mock('@/components/layout-lab/steps', () => ({ getStepComponent: vi.fn().mockReturnValue(null) }));

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';

const groups = [{ category: 'Core', catalogs: [{ catalogId: 'items', label: 'Items', description: '', total: 2 }] }];
const detail = {
  catalog: { catalogId: 'items', label: 'Items', description: 'Items', total: 2 },
  entities: [
    { id: 'item-1', name: 'Sword', lifecycle: 'planned' as const, data: {} },
    { id: 'item-2', name: 'Shield', lifecycle: 'planned' as const, data: {} },
  ],
  steps: ['Concept Brief', 'Economy'],
};
const view = (entityId: string) => (
  <Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId={entityId} onSelectEntity={() => {}} />
);

beforeEach(() => {
  _resetArtifactCache();
  useLabPipelineStore.setState({ byEntity: {} });
  fetchArtifactsResult.mockReset().mockResolvedValue({ ok: true, data: [] });
});
afterEach(() => { cleanup(); useLabPipelineStore.setState({ byEntity: {} }); _resetArtifactCache(); });

describe('Baseline — a refresh report belongs to the entity it ran on', () => {
  it('does not print an in-flight refresh of item-1 on item-2', async () => {
    const { rerender } = render(view('item-1'));
    // Local work the server lacks, so the refresh has something to REPORT ("1 kept").
    useLabPipelineStore.setState({ byEntity: { 'item-1': {
      Economy: { done: true, data: { price: 9 }, ueAssets: [], at: '2026-11-08T00:00:00Z' },
    } } });

    let answer!: (v: unknown) => void;
    fetchArtifactsResult.mockImplementationOnce(() => new Promise((r) => { answer = r; }));
    fireEvent.click(screen.getByTestId('refresh-from-server'));
    await waitFor(() => expect(answer).toBeTypeOf('function'));

    rerender(view('item-2'));
    await act(async () => { answer({ ok: true, data: [] }); });

    expect(screen.queryByTestId('refresh-outcome')).toBeNull();

    // Back on item-1 its own report is there to read.
    rerender(view('item-1'));
    expect(screen.getByTestId('refresh-outcome').textContent).toMatch(/1 kept/);
  });
});

describe('Baseline — a refresh in flight belongs to the entity it ran on', () => {
  it('leaves the refresh button enabled on item-2 while item-1 is in flight', async () => {
    const { rerender } = render(view('item-1'));
    let answer!: (v: unknown) => void;
    fetchArtifactsResult.mockImplementationOnce(() => new Promise((r) => { answer = r; }));
    fireEvent.click(screen.getByTestId('refresh-from-server'));
    await waitFor(() => expect(answer).toBeTypeOf('function'));
    expect((screen.getByTestId('refresh-from-server') as HTMLButtonElement).disabled).toBe(true);

    rerender(view('item-2'));
    expect((screen.getByTestId('refresh-from-server') as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { answer({ ok: true, data: [] }); });
  });
});
