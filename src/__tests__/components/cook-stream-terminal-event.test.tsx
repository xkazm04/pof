import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { useCookProgress } from '@/components/modules/game-systems/CookProgress/useCookProgress';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const COOK_REQUEST = {
  profileId: 'Development',
  projectPath: 'C:/proj/My.uproject',
  projectName: 'My',
  ueVersion: '5.4',
};

/**
 * A stream that delivers real progress and then simply ends — no `done`, no
 * `error`. The HTTP status was committed at 200 before the first byte, so
 * nothing about the transport distinguishes this from a completed cook.
 * The absence of the terminal event is the only evidence there is.
 */
function streamWithoutTerminalEvent(): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'phase', phase: 'cook' })}\n\n`),
      );
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'log', line: 'LogInit: cooking', t: 1 })}\n\n`),
      );
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function Probe({ onComplete }: { onComplete: (r: unknown) => void }) {
  useCookProgress({ request: COOK_REQUEST, onComplete });
  return null;
}

describe('a cook stream that ends without a terminal event', () => {
  it('settles as failed rather than leaving the cook without a verdict', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamWithoutTerminalEvent()));
    const onComplete = vi.fn();

    render(<Probe onComplete={onComplete} />);

    // The stream is over. Every unit that arrived was well formed and complete,
    // and the sequence was not: no terminal event ever came. A consumer that
    // reads the transport's verdict as the outcome reaches no verdict at all
    // and the cook hangs in "running" forever.
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0][0]).toMatchObject({ status: 'failed' });
  });

  it('still reports success when the terminal event does arrive', async () => {
    const encoder = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'phase', phase: 'cook' })}\n\n`),
            );
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'done', exePath: 'C:/out/My.exe' })}\n\n`,
              ),
            );
            controller.close();
          },
        });
        return new Response(body, { status: 200 });
      }),
    );
    const onComplete = vi.fn();

    render(<Probe onComplete={onComplete} />);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0][0]).toMatchObject({ status: 'success' });
  });
});

/** A stream carrying the given events in order, then closing. */
function streamOf(events: object[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const ev of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe('the cook settles once the build is RECORDED, carrying its id', () => {
  const DONE = { type: 'done', exePath: 'C:/out/My.exe', durationMs: 5, sizeBytes: null, status: 'success', t: 5 };

  it('"done" then "recorded" completes ONCE with the recorded buildId', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamOf([
      DONE,
      { type: 'recorded', buildId: 42, version: '0.1.3', versionRule: 'bump-per-green-cook' },
      { type: 'size-baseline', baseline: null, note: 'first build' },
    ])));
    const onComplete = vi.fn();
    render(<Probe onComplete={onComplete} />);

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ status: 'success', exePath: 'C:/out/My.exe', buildId: 42 });
  });

  it('"done" then "record-error" completes with no buildId and names why', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamOf([
      DONE,
      { type: 'record-error', message: 'SQLITE_BUSY', note: 'writing it to build history FAILED' },
    ])));
    const onComplete = vi.fn();
    render(<Probe onComplete={onComplete} />);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const r = onComplete.mock.calls[0][0] as { status: string; buildId?: number; recordError?: string };
    expect(r.status).toBe('success');
    expect(r.buildId).toBeUndefined();
    expect(r.recordError).toContain('SQLITE_BUSY');
  });
});
