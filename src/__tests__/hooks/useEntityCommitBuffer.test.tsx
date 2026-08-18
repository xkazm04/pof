/**
 * The ONE optimistic edit buffer, extracted from two independent wave-9 copies
 * (the audio scene painter's `SceneDraft`/`runCommit`, level-design's
 * `useDocCommitBuffer`). These tests pin the union of guarantees both copies
 * relied on, so a third consumer can trust them without re-deriving the engine:
 * commits-not-keystrokes, buffer survives a failure, ordering under overlap.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { useEntityCommitBuffer } from '@/hooks/useEntityCommitBuffer';

afterEach(cleanup);

interface Doc { id: number; name: string; note: string }
type Patch = Partial<Omit<Doc, 'id'>>;

const DOC: Doc = { id: 1, name: 'Crypt', note: '' };
const OTHER: Doc = { id: 2, name: 'Vault', note: '' };

const apply = (base: Doc, patch: Patch): Doc => ({ ...base, ...patch });
const fold = (prev: Patch | null, next: Patch): Patch => ({ ...(prev ?? {}), ...next });
const isEmpty = (patch: Patch): boolean => Object.keys(patch).length === 0;

/** A commit whose resolution the test controls. */
function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

interface Opts {
  base?: Doc | null;
  entityId?: string | number | null;
  commit: (patch: Patch, base: Doc) => void | Promise<unknown>;
  finalize?: (patch: Patch, base: Doc) => Patch;
  onCommitted?: () => void;
  flushOnUnmount?: boolean;
  debounceMs?: number;
}

function renderBuffer(opts: Opts) {
  return renderHook(
    (props: Opts) => useEntityCommitBuffer<Doc, Patch>({
      base: props.base === undefined ? DOC : props.base,
      entityId: props.entityId,
      apply,
      fold,
      isEmpty,
      finalize: props.finalize,
      commit: props.commit,
      onCommitted: props.onCommitted,
      flushOnUnmount: props.flushOnUnmount,
      debounceMs: props.debounceMs ?? 20,
    }),
    { initialProps: opts },
  );
}

describe('useEntityCommitBuffer — commits, not keystrokes', () => {
  it('stages locally with zero writes, then commits the folded patch exactly once', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderBuffer({ commit });

    act(() => { result.current.stage({ name: 'a' }); });
    act(() => { result.current.stage({ name: 'ab' }); });
    act(() => { result.current.stage({ note: 'x' }); });

    // Every stage landed on screen…
    expect(result.current.doc).toEqual({ id: 1, name: 'ab', note: 'x' });
    expect(result.current.isDirty).toBe(true);
    // …and not one of them reached the server.
    expect(commit).not.toHaveBeenCalled();

    await act(async () => { result.current.commit(); });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0]).toEqual({ name: 'ab', note: 'x' });
    // The buffer is dropped only once the write RESOLVED.
    expect(result.current.isDirty).toBe(false);
    expect(result.current.doc).toBe(DOC);
  });

  it('debounces a burst of stages into a single write', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderBuffer({ commit });

    for (const ch of 'hello') {
      act(() => { result.current.stageDebounced({ note: ch }); });
    }
    expect(commit).not.toHaveBeenCalled();

    await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    expect(commit.mock.calls[0][0]).toEqual({ note: 'o' });
  });

  it('writes nothing when the folded patch is empty', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderBuffer({ commit });

    await act(async () => { result.current.commit(); });   // nothing buffered
    await act(async () => { result.current.commit({}); }); // an empty patch
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });

  it('flush is a no-op with nothing buffered and no timer armed', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderBuffer({ commit });
    await act(async () => { result.current.flush(); });
    expect(commit).not.toHaveBeenCalled();
  });
});

describe('useEntityCommitBuffer — a failed commit is visible and non-destructive', () => {
  it('keeps the buffer, reports the reason, and retries exactly it', async () => {
    const commit = vi.fn()
      .mockRejectedValueOnce(new Error('server unavailable'))
      .mockResolvedValue(undefined);
    const { result } = renderBuffer({ commit });

    act(() => { result.current.stage({ note: 'work in progress' }); });
    await act(async () => { result.current.commit(); });

    expect(result.current.saveError).toBe('server unavailable');
    // The user's work is still on screen and still buffered.
    expect(result.current.doc?.note).toBe('work in progress');
    expect(result.current.isDirty).toBe(true);
    expect(result.current.isSaving).toBe(false);

    await act(async () => { result.current.retry(); });

    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[1][0]).toEqual({ note: 'work in progress' });
    expect(result.current.saveError).toBeNull();
    expect(result.current.isDirty).toBe(false);
  });

  it('dismissing the error keeps the edit', async () => {
    const commit = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderBuffer({ commit });

    act(() => { result.current.stage({ note: 'kept' }); });
    await act(async () => { result.current.commit(); });
    act(() => { result.current.dismissError(); });

    expect(result.current.saveError).toBeNull();
    expect(result.current.doc?.note).toBe('kept');
  });

  it('falls back to the configured message when the rejection is not an Error', async () => {
    const commit = vi.fn().mockRejectedValue('nope');
    const { result } = renderBuffer({ commit });

    act(() => { result.current.stage({ note: 'x' }); });
    await act(async () => { result.current.commit(); });

    expect(result.current.saveError).toBe('Could not save the change.');
  });
});

describe('useEntityCommitBuffer — ordering under overlap', () => {
  it('an edit staged mid-flight keeps the buffer when the older commit resolves', async () => {
    const gate = deferred();
    const commit = vi.fn().mockReturnValueOnce(gate.promise).mockResolvedValue(undefined);
    const { result } = renderBuffer({ commit });

    act(() => { result.current.stage({ note: 'first' }); });
    act(() => { result.current.commit(); });
    expect(result.current.isSaving).toBe(true);

    // A newer gesture lands while the write is still out.
    act(() => { result.current.stage({ note: 'second' }); });

    await act(async () => { gate.resolve(); await gate.promise; });

    // The older commit must NOT clear the newer edit.
    expect(result.current.isDirty).toBe(true);
    expect(result.current.doc?.note).toBe('second');
  });

  it('an earlier commit does not clear the saving flag out from under a newer one', async () => {
    const first = deferred();
    const second = deferred();
    const commit = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderBuffer({ commit });

    act(() => { result.current.commit({ note: 'a' }); });
    act(() => { result.current.commit({ note: 'b' }); });
    expect(commit).toHaveBeenCalledTimes(2);

    await act(async () => { first.resolve(); await first.promise; });
    expect(result.current.isSaving).toBe(true); // the second write is still out

    await act(async () => { second.resolve(); await second.promise; });
    expect(result.current.isSaving).toBe(false);
  });
});

describe('useEntityCommitBuffer — record identity', () => {
  it('ignores a buffer staged against a different record', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderBuffer({ commit, base: DOC, entityId: DOC.id });

    act(() => { result.current.stage({ name: 'edited' }); });
    expect(result.current.doc?.name).toBe('edited');

    rerender({ commit, base: OTHER, entityId: OTHER.id });

    // The other document renders untouched, and nothing of doc 1 can be written.
    expect(result.current.doc).toBe(OTHER);
    expect(result.current.isDirty).toBe(false);
    await act(async () => { result.current.commit(); });
    expect(commit).not.toHaveBeenCalled();
  });

  it('refuses to stage or commit with no record open', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderBuffer({ commit, base: null });

    act(() => { result.current.stage({ name: 'ghost' }); });
    await act(async () => { result.current.commit({ name: 'ghost' }); });

    expect(result.current.doc).toBeNull();
    expect(result.current.isDirty).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });
});

describe('useEntityCommitBuffer — finalize / onCommitted', () => {
  it('amends the patch once per COMMIT, not once per stage, and buffers the amendment', async () => {
    const finalize = vi.fn((patch: Patch): Patch => ({ ...patch, name: 'flagged' }));
    const commit = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    const onCommitted = vi.fn();
    const { result } = renderBuffer({ commit, finalize, onCommitted });

    act(() => { result.current.stage({ note: '1' }); });
    act(() => { result.current.stage({ note: '2' }); });
    expect(finalize).not.toHaveBeenCalled();

    await act(async () => { result.current.commit(); });
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0]).toEqual({ note: '2', name: 'flagged' });
    // A failed write retries the AMENDED patch, and reports nothing committed.
    expect(result.current.doc?.name).toBe('flagged');
    expect(onCommitted).not.toHaveBeenCalled();

    await act(async () => { result.current.retry(); });
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });
});

describe('useEntityCommitBuffer — unmount', () => {
  it('flushes a buffered edit when the consumer opted in', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderBuffer({ commit, flushOnUnmount: true });

    act(() => { result.current.stage({ note: 'unsaved' }); });
    expect(commit).not.toHaveBeenCalled();

    await act(async () => { unmount(); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0]).toEqual({ note: 'unsaved' });
  });

  it('drops the buffer — and the armed debounce — when it did not', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderBuffer({ commit });

    act(() => { result.current.stageDebounced({ note: 'unsaved' }); });
    await act(async () => { unmount(); });
    await new Promise((r) => setTimeout(r, 60));

    expect(commit).not.toHaveBeenCalled();
  });
});

describe('useEntityCommitBuffer — peek', () => {
  it('reads the frame staged by the previous event of the same gesture', () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderBuffer({ commit });

    // A stable handler captured once — exactly how a mousemove callback behaves.
    const { stage, peek } = result.current;
    act(() => { stage({ note: 'frame-1' }); });
    expect(peek()?.note).toBe('frame-1');
    act(() => { stage({ note: 'frame-2' }); });
    expect(peek()?.note).toBe('frame-2');
  });
});
