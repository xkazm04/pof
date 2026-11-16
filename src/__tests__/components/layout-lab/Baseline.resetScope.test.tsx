/**
 * A failed Reset is a fact about ONE entity. Its error banner used to be a single
 * instance-scoped string, so after switching entities it still sat in the rail — and its
 * Retry re-ran `resetEntityEverywhere` against the entity NOW open, deleting that entity's
 * server artifacts without ever passing the ConfirmDialog.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

const deleteEntityArtifacts = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  fetchArtifactsResult: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  postArtifact: vi.fn().mockResolvedValue(true),
  drainGates: vi.fn().mockResolvedValue(null),
  deleteEntityArtifacts: (...a: unknown[]) => deleteEntityArtifacts(...a),
}));
vi.mock('@/components/layout-lab/steps', () => ({ getStepComponent: vi.fn().mockReturnValue(null) }));

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

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

beforeEach(() => { deleteEntityArtifacts.mockReset().mockResolvedValue({ ok: false, error: 'offline' }); });
afterEach(() => { cleanup(); useLabPipelineStore.setState({ byEntity: {} }); });

describe('Baseline — a reset failure belongs to the entity it failed on', () => {
  it('does not carry the banner (or its destructive Retry) onto another entity', async () => {
    const { rerender } = render(view('item-1'));
    fireEvent.click(screen.getByTestId('entity-reset'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset everywhere' }));
    await screen.findByText(/Reset failed — server artifacts were NOT deleted: offline/i);

    rerender(view('item-2'));
    expect(screen.queryByText(/Reset failed/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    expect(deleteEntityArtifacts).toHaveBeenCalledTimes(1);
    expect(deleteEntityArtifacts).not.toHaveBeenCalledWith('items', 'item-2');

    // Back on the entity that failed, the failure is still reported.
    rerender(view('item-1'));
    expect(screen.getByText(/Reset failed — server artifacts were NOT deleted: offline/i)).toBeTruthy();
  });
});

describe('Baseline — the in-flight Reset belongs to its entity too', () => {
  it('keeps the open entity Reset enabled while another entity delete is pending', async () => {
    let release: (v: unknown) => void = () => {};
    deleteEntityArtifacts.mockReset().mockReturnValue(new Promise((r) => { release = r; }));
    const { rerender } = render(view('item-1'));
    fireEvent.click(screen.getByTestId('entity-reset'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset everywhere' }));
    expect(screen.getByTestId('entity-reset').textContent).toBe('Resetting…');

    rerender(view('item-2'));
    const btn = screen.getByTestId('entity-reset') as HTMLButtonElement;
    expect(btn.textContent).toBe('Reset');
    expect(btn.disabled).toBe(false);

    release({ ok: true, data: null });
    await Promise.resolve();
  });
});
