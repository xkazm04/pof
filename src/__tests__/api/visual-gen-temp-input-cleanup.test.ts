/**
 * `writeTemp` puts each generate input image in the OS temp dir. Once the job settles the
 * dispatch must remove it: one orphaned image per submit otherwise grows the temp dir for
 * ever. Every runner is stubbed (a failing result, no GPU, no provider, no network); the
 * assertion is on the real temp file the real dispatch table wrote.
 */
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const failed = vi.hoisted(() => vi.fn(async () => ({ ok: false, error: 'stubbed runner failure' })));

vi.mock('@/lib/visual-gen/triposr-runner', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/triposr-runner')>()), runTriposr: failed,
}));
vi.mock('@/lib/visual-gen/hunyuan-runner', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/hunyuan-runner')>()), runHunyuan: failed,
}));
vi.mock('@/lib/visual-gen/trellis-runner', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/trellis-runner')>()), runTrellis: failed,
}));
vi.mock('@/lib/visual-gen/tripo-runner', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/tripo-runner')>()), runTripo: failed,
}));

const { runnerDispatchFor } = await import('@/lib/visual-gen/runner-dispatch');

const PNG = `data:image/png;base64,${Buffer.from('fake-png-bytes').toString('base64')}`;

/**
 * A private temp dir: the shared test setup sweeps `pof_*_in_*` files from the real temp dir in
 * every test file's afterAll, so a parallel run would delete these inputs and the assertion could
 * not tell the dispatch's cleanup from a sibling's sweep.
 */
const saved = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR };
let privateTmp = '';
beforeAll(() => {
  privateTmp = mkdtempSync(join(tmpdir(), 'pof-test-tmpin-'));
  process.env.TEMP = privateTmp; process.env.TMP = privateTmp; process.env.TMPDIR = privateTmp;
});
afterAll(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  rmSync(privateTmp, { recursive: true, force: true });
});
afterEach(cleanup);

type TempSpec = { imagePath?: string; views?: Record<string, { path: string }> };

/** Start a job on `providerId`, return its temp inputs as written (present until it settles). */
function submit(providerId: string, mode: string, extra: object = {}) {
  const dispatch = runnerDispatchFor(providerId)!;
  const started = dispatch.start({ mode, imageDataUrl: PNG, ...extra } as never);
  if (!started.ok) throw new Error(started.error);
  const spec = (dispatch.getJob(started.data.jobId) as unknown as { spec: TempSpec }).spec;
  const paths = spec.imagePath ? [spec.imagePath] : Object.values(spec.views ?? {}).map((v) => v.path);
  expect(paths.every((p) => p.startsWith(privateTmp.split('\\').join('/')) && existsSync(p))).toBe(true);
  return paths;
}

describe('runner dispatch removes its temp inputs once the job settles', () => {
  it.each(['triposr', 'hunyuan3d', 'trellis2', 'tripo3d'])('%s image-to-3d', async (providerId) => {
    const paths = submit(providerId, 'image-to-3d');
    expect(paths).toHaveLength(1);
    await vi.waitFor(() => expect(paths.map((p) => existsSync(p))).toEqual([false]));
  });

  it('tripo3d multiview: one temp file per supplied slot, all gone', async () => {
    const paths = submit('tripo3d', 'multiview-to-3d', {
      imageDataUrl: undefined, viewDataUrls: { front: PNG, left: PNG, back: PNG },
    });
    expect(paths).toHaveLength(3);
    expect(new Set(paths).size).toBe(3);
    await vi.waitFor(() => expect(paths.some((p) => existsSync(p))).toBe(false));
  });
});
