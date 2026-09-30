import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// scan-sweep --challenge cli-terminal-system/B — every stream frame of an execution event
// carries its position (seq), and ?after=<seq> resumes past what the tab already holds.

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

type Frame = { type: string; data: Record<string, unknown>; seq?: number };

/** Read every frame the stream has flushed so far (stops when idle for 20 ms or closed). */
async function readFrames(res: Response): Promise<Frame[]> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const frames: Frame[] = [];
  for (;;) {
    const r = await Promise.race([reader.read(), new Promise<'idle'>((ok) => setTimeout(() => ok('idle'), 20))]);
    if (r === 'idle' || r.done) break;
    buf += dec.decode(r.value);
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) if (part.startsWith('data: ')) frames.push(JSON.parse(part.slice(6)));
  }
  void reader.cancel().catch(() => {});
  return frames;
}

function runningExecWith12Texts(): FakeExec {
  const events = Array.from({ length: 12 }, (_, i) => ({ type: 'text', data: { content: `m${i + 1}` }, timestamp: i + 1 }));
  const ex: FakeExec = { id: 'x', projectPath: '/p', status: 'running', events, listeners: new Set() };
  executions.set('x', ex);
  return ex;
}

const get = (qs: string) => STREAM(new NextRequest(`http://localhost:3000/api/claude-terminal/stream?${qs}`));

describe('GET /api/claude-terminal/stream — position cursor', () => {
  beforeEach(() => { executions.clear(); });

  it('after=12 replays none of the 12 messages; every event frame carries its seq', async () => {
    const ex = runningExecWith12Texts();
    const resumed = await readFrames(await get('executionId=x&after=12'));
    expect(resumed.filter((f) => f.type === 'message')).toHaveLength(0);

    // A new event after the cursor is delivered live with the next position.
    const fresh = await get('executionId=x&after=12');
    const pending = readFrames(fresh);
    await new Promise((ok) => setTimeout(ok, 5));
    const ev = { type: 'text', data: { content: 'm13' }, timestamp: 13 };
    ex.events.push(ev);
    for (const l of ex.listeners) l(ev);
    const live = (await pending).filter((f) => f.type === 'message');
    expect(live).toHaveLength(1);
    expect(live[0].seq).toBe(13);
  });

  it('[guard] without after, all 12 messages replay, each stamped with its position 1..12', async () => {
    runningExecWith12Texts();
    const frames = (await readFrames(await get('executionId=x'))).filter((f) => f.type === 'message');
    expect(frames).toHaveLength(12);
    expect(frames.map((f) => f.seq)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
});
