/**
 * ConfirmDialog owns the outcome of the operation it confirms
 * (scan-sweep --challenge ui-primitives/B).
 *
 * The dialog used to call `onConfirm(); onClose();` in one tick, so an async
 * operation's failure had nowhere to land. It now holds the operation:
 *   idle -> pending (busy, Cancel/Escape inert) -> closed on success
 *                                               -> failed(reason) + Retry
 * A synchronous `onConfirm` that returns nothing still closes in the same click
 * (the [guard] case — SuitesTab, LevelFlowEditor, SceneTree depend on it).
 *
 * setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor, within } from '@testing-library/react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SessionDetail } from '@/components/modules/game-director/SessionDetail';
import { ExperimentHistory } from '@/components/experiment-lab/ExperimentHistory';
import { err } from '@/types/result';
import type { PlaytestSession } from '@/types/game-director';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function renderDialog(onConfirm: () => unknown, onClose = vi.fn()) {
  render(
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={onConfirm as () => void | Promise<unknown>}
      title="Delete this thing?"
      description="This cannot be undone."
      confirmLabel="Delete"
    />,
  );
  const dialog = screen.getByRole('dialog');
  return { onClose, dialog, confirm: () => within(dialog).getByRole('button', { name: /^(Delete|Retry|Working)/ }) };
}

describe('ConfirmDialog owns the outcome', () => {
  it('case 1: while the operation is pending, Confirm is busy+disabled, Cancel is disabled, Escape does not close', () => {
    const onConfirm = vi.fn(() => new Promise<void>(() => {}));
    const { onClose, dialog, confirm } = renderDialog(onConfirm);
    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const busy = confirm();
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('case 2: closes only once the operation resolves, exactly once', async () => {
    const d = deferred();
    const { onClose, confirm } = renderDialog(() => d.promise);
    fireEvent.click(confirm());
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { d.resolve(); await d.promise; });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('case 3: a rejection stays in the dialog with its reason and turns Confirm into an enabled Retry', async () => {
    const d = deferred();
    const { onClose, dialog, confirm } = renderDialog(() => d.promise);
    fireEvent.click(confirm());
    await act(async () => { d.reject(new Error('disk locked')); await d.promise.catch(() => {}); });
    expect(onClose).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('alert').textContent).toContain('disk locked');
    const retry = within(dialog).getByRole('button', { name: 'Retry' }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
  });

  it('case 4: Retry re-runs the same operation and closes once it succeeds', async () => {
    let calls = 0;
    const onConfirm = vi.fn(() => (++calls === 1 ? Promise.reject(new Error('disk locked')) : Promise.resolve()));
    const { onClose, dialog, confirm } = renderDialog(onConfirm);
    fireEvent.click(confirm());
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Retry' })).toBeTruthy());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('case 5: a resolved Result err is a failure, not a success', async () => {
    const { onClose, dialog, confirm } = renderDialog(async () => err('409 in use'));
    fireEvent.click(confirm());
    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toContain('409 in use'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('case 6: two clicks in the same tick run the operation once (ref disarm, not a state round-trip)', () => {
    const onConfirm = vi.fn(() => new Promise<void>(() => {}));
    const { confirm } = renderDialog(onConfirm);
    const btn = confirm();
    act(() => { btn.click(); btn.click(); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('case 7 [guard]: a synchronous onConfirm returning undefined closes in the same click', () => {
    const onConfirm = vi.fn(() => undefined);
    const { onClose, confirm } = renderDialog(onConfirm);
    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('case 8: SessionDetail with a rejecting onDelete keeps the dialog open with the reason and no unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);
    try {
      const session: PlaytestSession = {
        id: 's1', name: 'Run', status: 'complete', buildPath: '/x',
        createdAt: 't0', startedAt: 't0', completedAt: 't1', durationMs: 1000,
        config: { testCategories: [], maxPlaytimeMinutes: 10, screenshotIntervalSeconds: 5, aggressiveMode: false, prioritySystems: [] },
        summary: null, systemsTestedCount: 0, findingsCount: 0,
      };
      // Mirrors useGameDirector.deleteSession: `if (!result.ok) throw new Error(result.error)`.
      const onDelete = vi.fn(async () => { throw new Error('session is locked by a running playtest'); });
      render(
        <SessionDetail
          session={session}
          onBack={() => {}}
          onSimulate={async () => {}}
          onDelete={onDelete}
          simulating={false}
          getFindings={vi.fn().mockResolvedValue([])}
          getEvents={vi.fn().mockResolvedValue([])}
          markFixDispatched={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete session' }));
      await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toContain('session is locked'));
      await new Promise((r) => setTimeout(r, 20));
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(unhandled).toHaveLength(0);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('consumer: ExperimentHistory Retry after a failed delete re-runs the same DELETE (it used to be a no-op)', async () => {
    let deletes = 0;
    const json = (body: unknown) => ({ json: async () => body }) as Response;
    const run = { id: 'r1', createdAt: 't', mode: 'scenario', ok: true, error: null, durationMs: 2000, hasScreenshot: false, captureState: 'none', label: 'run one' };
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== 'DELETE') return json({ success: true, data: { runs: [run] } });
      deletes += 1;
      return deletes === 1 ? json({ success: false, error: 'run is in use' }) : json({ success: true, data: { id: 'r1', deleted: true } });
    }));
    render(<ExperimentHistory refreshKey={0} />);
    await waitFor(() => expect(screen.getByLabelText(/Delete run "run one"/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/Delete run "run one"/));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete run' }));
    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toContain('run is in use'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(deletes).toBe(2));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).toBeNull());
  });
});
