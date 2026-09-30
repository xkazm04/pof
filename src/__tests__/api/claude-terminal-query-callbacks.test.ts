import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// scan-sweep --challenge cli-terminal-system/A — the query POST hands the run's callback
// descriptors to the execution that settles them; GET and the stream expose the verdict.

type Listener = (e: { type: string; data: Record<string, unknown>; timestamp: number }) => void;
interface FakeExec {
  id: string; projectPath: string; status: string; events: { type: string; data: Record<string, unknown>; timestamp: number }[];
  listeners: Set<Listener>; callbacks?: unknown[]; callbackStatus?: string | null; sessionId?: string;
}

const { startExecution, getExecution, executions } = vi.hoisted(() => ({
  startExecution: vi.fn(),
  getExecution: vi.fn(),
  executions: new Map<string, unknown>(),
}));

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: (...a: unknown[]) => startExecution(...a),
  getExecution: (...a: unknown[]) => getExecution(...a),
  abortExecution: vi.fn(),
  subscribeToExecution: (id: string, l: Listener) => {
    const ex = executions.get(id) as FakeExec | undefined;
    if (!ex) return null;
    ex.listeners.add(l);
    return () => { ex.listeners.delete(l); };
  },
}));
vi.mock('@/lib/model-policy', () => ({ resolveDispatchModelChoice: () => ({}) }));

import { POST, GET } from '@/app/api/claude-terminal/query/route';
import { GET as STREAM } from '@/app/api/claude-terminal/stream/route';

const CB1 = { id: 'cb-1', url: 'http://localhost:3000/api/checklist/complete', method: 'POST', staticFields: { moduleId: 'm' }, schemaHint: '' };

function fakeExec(over: Partial<FakeExec> = {}): FakeExec {
  const ex: FakeExec = { id: 'exec-1', projectPath: '/p', status: 'running', events: [], listeners: new Set(), ...over };
  executions.set(ex.id, ex);
  return ex;
}

type Frame = { type: string; data: Record<string, unknown> };
const SSE_SEP = '\n\n';
/** One persistent reader per response; a pending read survives across calls so no chunk is lost. */
function frameReader(res: Response) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let pending: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;
  return async function read(): Promise<{ frames: Frame[]; closed: boolean }> {
    const frames: Frame[] = [];
    for (;;) {
      pending ??= reader.read();
      const r = await Promise.race([pending, new Promise<'idle'>((ok) => setTimeout(() => ok('idle'), 20))]);
      if (r === 'idle') return { frames, closed: false };
      pending = null;
      if (r.done) return { frames, closed: true };
      buf += dec.decode(r.value);
      const parts = buf.split(SSE_SEP);
      buf = parts.pop() ?? '';
      for (const part of parts) if (part.startsWith('data: ')) frames.push(JSON.parse(part.slice(6)));
    }
  };
}

describe('POST/GET /api/claude-terminal/query — callback descriptors', () => {
  beforeEach(() => {
    startExecution.mockReset(); getExecution.mockReset(); executions.clear();
    startExecution.mockReturnValue('exec-1');
    getExecution.mockImplementation((id: string) => executions.get(id));
  });

  it('POST forwards the run\'s callback descriptors (and its own origin) to startExecution', async () => {
    const req = new NextRequest('http://localhost:3000/api/claude-terminal/query', {
      method: 'POST', headers: { host: 'localhost:3000' }, body: JSON.stringify({ projectPath: '/p', prompt: 'go', callbacks: [CB1] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const opts = startExecution.mock.calls[0][4];
    expect(opts.callbacks).toEqual([CB1]);
    expect(opts.appOrigin).toBe('http://localhost:3000');
  });

  it('[guard] POST without callbacks passes none (interactive runs unchanged)', async () => {
    const req = new NextRequest('http://localhost:3000/api/claude-terminal/query', {
      method: 'POST', body: JSON.stringify({ projectPath: '/p', prompt: 'go' }),
    });
    await POST(req);
    expect(startExecution.mock.calls[0][4].callbacks).toBeUndefined();
  });

  it('GET returns callbackStatus alongside status', async () => {
    fakeExec({ status: 'completed', callbackStatus: 'confirmed' });
    const res = await GET(new NextRequest('http://localhost:3000/api/claude-terminal/query?executionId=exec-1'));
    const body = await res.json();
    expect(body.data.execution.status).toBe('completed');
    expect(body.data.execution.callbackStatus).toBe('confirmed');
  });
});

describe('GET /api/claude-terminal/stream — callbacks frame', () => {
  beforeEach(() => {
    getExecution.mockReset(); executions.clear();
    getExecution.mockImplementation((id: string) => executions.get(id));
  });

  it('a run that declared callbacks stays open after result and closes after the callbacks frame', async () => {
    const ex = fakeExec({ callbacks: [CB1] });
    ex.events.push({ type: 'result', data: { isError: false }, timestamp: 1 });
    const res = await STREAM(new NextRequest('http://localhost:3000/api/claude-terminal/stream?executionId=exec-1'));
    const read = frameReader(res);
    const first = await read();
    expect(first.frames.map((f) => f.type)).toEqual(['connected', 'result']);
    expect(first.closed).toBe(false);

    for (const l of ex.listeners) l({ type: 'callbacks', data: { status: 'confirmed', failed: [] }, timestamp: 2 });
    const second = await read();
    expect(second.frames.map((f) => f.type)).toEqual(['callbacks']);
    expect(second.frames[0].data).toMatchObject({ status: 'confirmed' });
    expect(second.closed).toBe(true);
  });

  it('[guard] a run without callbacks still closes on result', async () => {
    const ex = fakeExec();
    ex.events.push({ type: 'result', data: { isError: false }, timestamp: 1 });
    const res = await STREAM(new NextRequest('http://localhost:3000/api/claude-terminal/stream?executionId=exec-1'));
    const out = await frameReader(res)();
    expect(out.frames.map((f) => f.type)).toEqual(['connected', 'result']);
    expect(out.closed).toBe(true);
  });
});
