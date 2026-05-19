import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CookEvent } from '@/lib/packaging/cook-executor';

vi.mock('@/lib/packaging/cook-executor', () => ({
  cookExecutor: vi.fn(),
}));

vi.mock('@/lib/packaging/build-profiles-db', () => ({
  getProfile: vi.fn(),
}));

vi.mock('@/lib/packaging/build-history-store', () => ({
  insertBuild: vi.fn().mockReturnValue({ id: 1 }),
}));

import { POST } from '@/app/api/packaging/execute/route';
import { cookExecutor } from '@/lib/packaging/cook-executor';
import { getProfile } from '@/lib/packaging/build-profiles-db';
import { insertBuild } from '@/lib/packaging/build-history-store';

function buildReq(body: unknown): Request {
  return new Request('http://localhost:3000/api/packaging/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readSSE(stream: ReadableStream<Uint8Array>): Promise<CookEvent[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: CookEvent[] = [];
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.replace(/^data:\s?/, '').trim();
      if (line) events.push(JSON.parse(line) as CookEvent);
    }
  }
  return events;
}

const mockProfile = {
  id: 'p1',
  name: 'Win64 Shipping',
  platform: 'Win64',
  config: 'Shipping',
  isDefault: false,
  cookSettings: {
    mapsToInclude: [],
    pluginsToDisable: [],
    usePak: true,
    compressPak: true,
    encryptPak: false,
    useIoStore: false,
    iterativeCooking: false,
    cookOnTheFly: false,
    textureStreamingBudgetMB: 0,
    compressTextures: true,
  },
  platformSettings: { architecture: 'x64', customFlags: [] },
  outputDir: '',
  stage: true,
  archive: false,
  archiveDir: '',
  runAfterPackage: false,
  createdAt: '2026-05-19T00:00:00.000Z',
  updatedAt: '2026-05-19T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  (getProfile as ReturnType<typeof vi.fn>).mockReturnValue(mockProfile);
});

describe('POST /api/packaging/execute', () => {
  it('returns 404 when profile not found', async () => {
    (getProfile as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const res = await POST(buildReq({
      profileId: 'missing', projectPath: 'C:\\x', projectName: 'PoF', ueVersion: '5.7.3',
    }));
    expect(res.status).toBe(404);
  });

  it('streams cook events as SSE and records build on done', async () => {
    (cookExecutor as ReturnType<typeof vi.fn>).mockImplementationOnce(async function* () {
      yield { type: 'phase', phase: 'cook', t: 0 } as CookEvent;
      yield { type: 'progress', percent: 50, t: 100 } as CookEvent;
      yield { type: 'done', exePath: 'C:\\out\\PoF.exe', durationMs: 200, sizeBytes: 0, status: 'success', t: 200 } as CookEvent;
    });

    const res = await POST(buildReq({
      profileId: 'p1', projectPath: 'C:\\x', projectName: 'PoF', ueVersion: '5.7.3',
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    const events = await readSSE(res.body!);
    expect(events.length).toBe(3);
    expect(events[0].type).toBe('phase');
    expect(events[2].type).toBe('done');
    expect(insertBuild).toHaveBeenCalledTimes(1);
  });

  it('streams an error event and records failure', async () => {
    (cookExecutor as ReturnType<typeof vi.fn>).mockImplementationOnce(async function* () {
      yield { type: 'error', message: 'cook exited with code 1', status: 'failed', t: 100 } as CookEvent;
    });

    const res = await POST(buildReq({
      profileId: 'p1', projectPath: 'C:\\x', projectName: 'PoF', ueVersion: '5.7.3',
    }));
    const events = await readSSE(res.body!);
    expect(events.at(-1)?.type).toBe('error');
    expect(insertBuild).toHaveBeenCalledTimes(1);
  });
});
