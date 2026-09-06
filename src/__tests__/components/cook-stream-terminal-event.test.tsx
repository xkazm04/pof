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
