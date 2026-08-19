/**
 * The cook route must not tell the user a build was recorded when it was not, and a
 * cooked build must carry the version it was built at.
 *
 * The whole recording block was wrapped in a bare `catch { }`: `insertBuild` threw, the
 * stream closed after a clean `done`, the user was told the cook succeeded — and NO ROW
 * EXISTED anywhere. And `version` was stamped only by the manual Record form, so every
 * build this route produced was `version: null` while the Version card showed a counter
 * no build had been produced at.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CookEvent } from '@/lib/packaging/cook-executor';

vi.mock('@/lib/packaging/cook-executor', () => ({ cookExecutor: vi.fn() }));
vi.mock('@/lib/packaging/build-profiles-db', () => ({ getProfile: vi.fn() }));
vi.mock('@/lib/packaging/build-history-store', () => ({
  insertBuild: vi.fn().mockReturnValue({ id: 42 }),
  lastGreenBaseline: vi.fn().mockReturnValue(null),
  updateBuildNotes: vi.fn(),
}));
vi.mock('@/lib/packaging/version-manager', () => ({
  autoIncrementOnSuccess: vi.fn().mockReturnValue('0.1.7'),
}));

import { POST } from '@/app/api/packaging/execute/route';
import { cookExecutor } from '@/lib/packaging/cook-executor';
import { getProfile } from '@/lib/packaging/build-profiles-db';
import { insertBuild } from '@/lib/packaging/build-history-store';
import { autoIncrementOnSuccess } from '@/lib/packaging/version-manager';

type AnyEvent = Record<string, unknown> & { type: string };

function buildReq(body: unknown): Request {
  return new Request('http://localhost:3000/api/packaging/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readSSE(stream: ReadableStream<Uint8Array>): Promise<AnyEvent[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: AnyEvent[] = [];
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.replace(/^data:\s?/, '').trim();
      if (line) events.push(JSON.parse(line) as AnyEvent);
    }
  }
  return events;
}

const mockProfile = {
  id: 'p1', name: 'Win64 Shipping', platform: 'Win64', config: 'Shipping', isDefault: false,
  cookSettings: {
    mapsToInclude: [], pluginsToDisable: [], usePak: true, compressPak: true, encryptPak: false,
    useIoStore: false, iterativeCooking: false, cookOnTheFly: false,
    textureStreamingBudgetMB: 0, compressTextures: true,
  },
  platformSettings: { architecture: 'x64', customFlags: [] },
  outputDir: '', stage: true, archive: false, archiveDir: '', runAfterPackage: false,
  createdAt: '2026-05-19T00:00:00.000Z', updatedAt: '2026-05-19T00:00:00.000Z',
};

const REQ = { profileId: 'p1', projectPath: 'C:\\x', projectName: 'PoF', ueVersion: '5.8.0' };

beforeEach(() => {
  vi.clearAllMocks();
  (getProfile as ReturnType<typeof vi.fn>).mockReturnValue(mockProfile);
  (insertBuild as ReturnType<typeof vi.fn>).mockReturnValue({ id: 42 });
  (autoIncrementOnSuccess as ReturnType<typeof vi.fn>).mockReturnValue('0.1.7');
});

function greenCook(): void {
  (cookExecutor as ReturnType<typeof vi.fn>).mockImplementationOnce(async function* () {
    yield { type: 'done', exePath: 'C:\\out\\PoF.exe', durationMs: 200, sizeBytes: 0, status: 'success', t: 200 } as CookEvent;
  });
}

describe('a cooked build carries the version it was built at', () => {
  it('stamps the version on the recorded row', async () => {
    greenCook();
    await readSSE((await POST(buildReq(REQ))).body!);
    expect(autoIncrementOnSuccess).toHaveBeenCalledTimes(1);
    const input = (insertBuild as ReturnType<typeof vi.fn>).mock.calls[0][0] as { version?: string | null };
    expect(input.version).toBe('0.1.7');
  });

  it('announces what was recorded, and under which version rule', async () => {
    greenCook();
    const events = await readSSE((await POST(buildReq(REQ))).body!);
    const recorded = events.find((e) => e.type === 'recorded');
    expect(recorded, 'the stream never said the build was recorded').toBeTruthy();
    expect(recorded!.buildId).toBe(42);
    expect(recorded!.version).toBe('0.1.7');
    expect(recorded!.versionRule).toBe('bump-per-green-cook');
  });

  it('does NOT bump the version for a failed cook', async () => {
    (cookExecutor as ReturnType<typeof vi.fn>).mockImplementationOnce(async function* () {
      yield { type: 'error', message: 'cook exited with code 1', status: 'failed', t: 100 } as CookEvent;
    });
    const events = await readSSE((await POST(buildReq(REQ))).body!);
    expect(autoIncrementOnSuccess).not.toHaveBeenCalled();
    const recorded = events.find((e) => e.type === 'recorded');
    expect(recorded!.version).toBeNull();
  });
});

describe('a persistence failure is reported, never swallowed', () => {
  it('emits a record-error event instead of closing on a clean success', async () => {
    greenCook();
    (insertBuild as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('SQLITE_READONLY: attempt to write a readonly database');
    });
    const events = await readSSE((await POST(buildReq(REQ))).body!);
    // The cook itself still reports done — it really did happen.
    expect(events.some((e) => e.type === 'done')).toBe(true);
    const err = events.find((e) => e.type === 'record-error');
    expect(err, 'the failed insert was swallowed by a bare catch {}').toBeTruthy();
    expect(String(err!.message)).toMatch(/SQLITE_READONLY/);
    expect(String(err!.note)).toMatch(/no row exists/i);
    // And it must NOT claim a build was recorded.
    expect(events.some((e) => e.type === 'recorded')).toBe(false);
  });

  it('reports a persistence failure on the FAILED path too', async () => {
    (cookExecutor as ReturnType<typeof vi.fn>).mockImplementationOnce(async function* () {
      yield { type: 'error', message: 'cook exited with code 1', status: 'failed', t: 100 } as CookEvent;
    });
    (insertBuild as ReturnType<typeof vi.fn>).mockImplementationOnce(() => { throw new Error('db gone'); });
    const events = await readSSE((await POST(buildReq(REQ))).body!);
    expect(events.find((e) => e.type === 'record-error')).toBeTruthy();
  });

  it('keeps streaming a normal cook unchanged when persistence works', async () => {
    // Preserved-behaviour pin: the cook events themselves are untouched.
    greenCook();
    const events = await readSSE((await POST(buildReq(REQ))).body!);
    expect(events[0].type).toBe('done');
    expect(events.some((e) => e.type === 'record-error')).toBe(false);
    expect(insertBuild).toHaveBeenCalledTimes(1);
  });
});
