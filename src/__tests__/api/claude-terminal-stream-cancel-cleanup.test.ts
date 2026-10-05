import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// A client that disconnects (closes the tab, navigates away) before the execution
// reaches a terminal event makes the ReadableStream's `cancel()` fire. `isStreamClosed`,
// `unsubscribe` and the heartbeat `setInterval` were all declared inside `start()`'s
// closure, so `cancel()` — a sibling method with no access to them — could only flip a
// flag it couldn't act on: the heartbeat kept firing until its own next 15s tick noticed
// `isStreamClosed`, and the execution subscription stayed registered until the next
// emitted event's callback saw the flag and unsubscribed itself. Both leaks are bounded
// but real, and avoidable: `cancel()` can clean up immediately once the cleanup refs are
// shared with `start()`.

type Listener = (e: { type: string; data: Record<string, unknown>; timestamp: number }) => void;
interface FakeExec {
  id: string; projectPath: string; status: string;
  events: { type: string; data: Record<string, unknown>; timestamp: number }[];
  listeners: Set<Listener>; callbacks?: unknown[];
}

const { executions } = vi.hoisted(() => ({ executions: new Map<string, unknown>() }));

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: vi.fn(),
  getExecution: (id: string) => executions.get(id),
  subscribeToExecution: (id: string, l: Listener) => {
    const ex = executions.get(id) as FakeExec | undefined;
    if (!ex) return null;
    ex.listeners.add(l);
    return () => { ex.listeners.delete(l); };
  },
}));

import { GET as STREAM } from '@/app/api/claude-terminal/stream/route';

function runningExec(): FakeExec {
  const ex: FakeExec = { id: 'x', projectPath: '/p', status: 'running', events: [], listeners: new Set() };
  executions.set('x', ex);
  return ex;
}

describe('GET /api/claude-terminal/stream — client-disconnect cleanup', () => {
  beforeEach(() => { executions.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('cancelling the reader unsubscribes from the execution and clears the heartbeat immediately', async () => {
    const ex = runningExec();
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const res = await STREAM(new NextRequest('http://localhost:3000/api/claude-terminal/stream?executionId=x'));
    const reader = res.body!.getReader();
    await reader.read(); // consume the synchronous "connected" frame so start() has run fully

    expect(ex.listeners.size).toBe(1); // subscribed

    await reader.cancel();

    expect(ex.listeners.size).toBe(0); // unsubscribed immediately, not on the next event
    expect(clearIntervalSpy).toHaveBeenCalled(); // heartbeat cleared immediately, not on its next 15s tick
  });
});
