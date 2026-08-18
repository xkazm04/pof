import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';

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

/**
 * A checker that is ARMED to throw exactly once. The write-through grades synchronously
 * inside `produce()` (before React re-renders), so the first `accept(...)` call is the
 * write-through's own — the render-side recompute that follows sees a normal checker.
 */
let armed = false;
const THROWN = "Cannot read properties of undefined (reading 'price')";
/** What the armed checker throws — swappable so a message-less throw can be exercised. */
let thrown: unknown = new TypeError(THROWN);
vi.mock('@/components/layout-lab/labAcceptance', () => ({
  resolveAccept: () => (data: Record<string, unknown>) => {
    if (armed) { armed = false; throw thrown; }
    return { label: 'Economy', status: 'pass' as const, tier: 'L0' as const, detail: String(Object.keys(data).length) };
  },
}));

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

const groups = [{ category: 'Core', catalogs: [{ catalogId: 'items', label: 'Items', description: '', verified: 0, total: 1 }] }];
const detail = {
  catalog: { catalogId: 'items', label: 'Items', description: 'Items', total: 1, verified: 0 },
  entities: [{ id: 'item-1', name: 'Sword', lifecycle: 'planned' as const, data: {} }],
  steps: ['Economy', 'Concept Brief'],
};

const renderBaseline = () =>
  render(<Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="item-1" onSelectEntity={() => {}} />);

const stepArt = () => useLabPipelineStore.getState().byEntity['item-1']?.Economy;

/** Produce through the real store, which fires the write-through sink the shell installed. */
const produceEconomy = () =>
  act(() => { useLabPipelineStore.getState().produce('item-1', 'Economy', { data: { price: 10 } }); });

beforeEach(() => {
  armed = false;
  thrown = new TypeError(THROWN);
  postArtifact.mockReset().mockResolvedValue({ ok: true, data: {} });
  useLabPipelineStore.setState({ byEntity: {} });
});
afterEach(() => { cleanup(); useLabPipelineStore.setState({ byEntity: {} }); });

/**
 * The hole this covers: the sink was `(id, step, art) => { void syncStep(id, step, art); }`
 * and `syncStep`'s first act was an UNGUARDED `labGrade`. Because `syncStep` is async, a
 * throwing checker rejected the promise, `void` discarded it as an unhandled rejection, and
 * the artifact carried neither `error` nor `syncError` — a clean success that never left the
 * browser. Every assertion below fails on the pre-fix code.
 */
describe('Baseline — a THROWN grade in the write-through cannot fail silently', () => {
  it('records the checker reason as a sync failure and sends NOTHING', async () => {
    renderBaseline();
    armed = true;
    produceEconomy();

    await waitFor(() => expect(stepArt()?.syncError).toBeTruthy());
    // The thrown message is the actionable part and is quoted verbatim.
    expect(stepArt()!.syncError).toContain(THROWN);
    // Its OWN failure mode — named as a grade throw, not merged into the network reason.
    expect(stepArt()!.syncError).toContain('Acceptance checker THREW');
    // Nothing was POSTed: no graded status existed, and inventing one is the fabricated
    // pass this subsystem exists to prevent.
    expect(postArtifact).not.toHaveBeenCalled();
    // The optimistic local write still stands (add-only UX preserved).
    expect(stepArt()!.data).toEqual({ price: 10 });
  });

  it('surfaces it on the work canvas as LOCAL ONLY, with Retry reachable', async () => {
    renderBaseline();
    armed = true;
    produceEconomy();

    const banner = await screen.findByTestId('step-sync-error');
    expect(banner.textContent).toContain('LOCAL ONLY');
    expect(banner.textContent).toContain(THROWN);

    // Retry is reachable from that banner and re-attempts the write-through; the checker
    // is no longer armed, so the step grades, POSTs and the flag clears.
    fireEvent.click(banner.querySelector('button')!);
    await waitFor(() => expect(postArtifact).toHaveBeenCalled());
    expect(postArtifact.mock.calls[0][0]).toMatchObject({ catalogId: 'items', entityId: 'item-1', step: 'Economy', status: 'pass' });
    await waitFor(() => expect(stepArt()?.syncError).toBeUndefined());
  });

  it('keeps the network failure mode distinct from the thrown one', async () => {
    postArtifact.mockResolvedValue({ ok: false, error: 'database is locked' });
    renderBaseline();
    produceEconomy(); // checker NOT armed: the grade succeeds, the POST is rejected

    await waitFor(() => expect(stepArt()?.syncError).toBe('Not saved to the server: database is locked'));
    expect(stepArt()!.syncError).not.toContain('THREW');
  });

  it('a rejected POST client (a throw, not a Result) is still reported, never swallowed', async () => {
    postArtifact.mockRejectedValue(new Error('fetch blew up'));
    renderBaseline();
    produceEconomy();

    await waitFor(() => expect(stepArt()?.syncError).toBeTruthy());
    expect(stepArt()!.syncError).toContain('fetch blew up');
    expect(stepArt()!.syncError).toContain('write-through threw');
  });

  it('a throw with NO message still names a reason (never a dangling em dash)', async () => {
    thrown = new RangeError(''); // the real shape of a bare `throw new Error()` in a checker
    renderBaseline();
    armed = true;
    produceEconomy();

    await waitFor(() => expect(stepArt()?.syncError).toBeTruthy());
    expect(stepArt()!.syncError!.trim().endsWith('—')).toBe(false);
    expect(stepArt()!.syncError).toContain('RangeError');
  });
});
