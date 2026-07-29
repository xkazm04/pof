import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

const postArtifact = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  fetchArtifactsResult: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  postArtifact: (...a: unknown[]) => postArtifact(...a),
  drainGates: vi.fn().mockResolvedValue(null),
  deleteEntityArtifacts: vi.fn().mockResolvedValue({ ok: true, data: 0 }),
}));
vi.mock('@/components/layout-lab/steps', () => ({ getStepComponent: vi.fn().mockReturnValue(null) }));

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

const groups = [{ category: 'Core', catalogs: [{ catalogId: 'items', label: 'Items', description: '', verified: 0, total: 1 }] }];
const detail = {
  catalog: { catalogId: 'items', label: 'Items', description: 'Items', total: 1, verified: 0 },
  entities: [{ id: 'item-1', name: 'Sword', lifecycle: 'planned' as const, data: {} }],
  steps: ['Concept Brief', 'Economy'],
};

const SERVER_REASON = 'Not saved to the server: Invalid artifact payload — data: Expected object, received string';

const renderBaseline = () =>
  render(<Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="item-1" onSelectEntity={() => {}} />);

beforeEach(() => {
  postArtifact.mockReset().mockResolvedValue({ ok: true, data: {} });
  useLabPipelineStore.setState({
    byEntity: {
      'item-1': {
        'Concept Brief': { done: true, data: { brief: 'x' }, ueAssets: [], at: '2026-07-01T10:00:00.000Z', syncError: SERVER_REASON },
      },
    },
  });
});
afterEach(() => { cleanup(); useLabPipelineStore.setState({ byEntity: {} }); });

/**
 * A produce that never reached the server used to surface as one rail dot glyph and
 * nothing else — the step's Acceptance read as a clean pass while existing on exactly one
 * machine. The work canvas now states the reason, right above the step's acceptance banner.
 */
describe('Baseline — a failed write-through speaks', () => {
  it('states the server reason above the step, marking Acceptance local-only', () => {
    renderBaseline();
    const banner = screen.getByTestId('step-sync-error');
    expect(banner.textContent).toContain('LOCAL ONLY');
    expect(banner.textContent).toContain('Expected object, received string');
  });

  it('offers a retry that re-POSTs the local artifact and clears the flag on success', async () => {
    renderBaseline();
    fireEvent.click(screen.getByTestId('step-sync-error').querySelector('button')!);
    await waitFor(() => expect(postArtifact).toHaveBeenCalled());
    expect(postArtifact.mock.calls[0][0]).toMatchObject({ catalogId: 'items', entityId: 'item-1', step: 'Concept Brief' });
    await waitFor(() =>
      expect(useLabPipelineStore.getState().byEntity['item-1']['Concept Brief'].syncError).toBeUndefined(),
    );
  });

  it('a step with no sync failure shows no banner', () => {
    useLabPipelineStore.setState({
      byEntity: { 'item-1': { 'Concept Brief': { done: true, data: {}, ueAssets: [], at: '2026-07-01T10:00:00.000Z' } } },
    });
    renderBaseline();
    expect(screen.queryByTestId('step-sync-error')).toBeNull();
  });

  it('the rail dot carries the same reason instead of a generic "not synced"', () => {
    const { container } = renderBaseline();
    const flag = container.querySelector('[data-step-sync-failed="true"]');
    expect(flag?.getAttribute('title')).toBe(SERVER_REASON);
  });
});
