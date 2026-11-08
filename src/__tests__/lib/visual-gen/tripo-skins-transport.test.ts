import { describe, expect, it, vi } from 'vitest';
import { runTripoSkinSet } from '@/lib/visual-gen/tripo-skins';
import type { TripoHttp } from '@/lib/visual-gen/tripo-runner';

const CREATED = { status: 200, json: { code: 0, data: { task_id: 't1' } } };
const SUCCESS = { status: 200, json: { code: 0, data: { status: 'success', output: { model: 'https://x/m.glb' } } } };
const http = (over: Partial<TripoHttp>): TripoHttp => ({
  postJson: vi.fn(async () => CREATED),
  getJson: vi.fn(async () => SUCCESS),
  uploadImage: vi.fn(async () => ({ status: 200, json: undefined })),
  download: vi.fn(async () => true),
  ...over,
});
const run = (h: TripoHttp, names = ['gold', 'crimson']) => runTripoSkinSet(
  { originalTaskId: 'g', variants: names.map((name) => ({ name })), outputDir: 'o', maxPolls: 3 },
  { http: h, env: { TRIPO_API_KEY: 'k' }, fileExists: () => true, now: () => 1, sleep: async () => {} },
);

describe('runTripoSkinSet keeps paid skins through a transport failure', () => {
  it('a create that rejects fails that skin only', async () => {
    const postJson = vi.fn<TripoHttp['postJson']>()
      .mockResolvedValueOnce(CREATED)
      .mockRejectedValueOnce(new Error('fetch failed'));
    const r = await run(http({ postJson }));
    expect(r.skins.map((s) => s.ok)).toEqual([true, false]);
    expect(r.skins[1].error).toContain('fetch failed');
    expect(r.skins[0].meshPath).toBeTruthy();
  });

  it('a rejected poll is retried', async () => {
    const getJson = vi.fn<TripoHttp['getJson']>().mockRejectedValueOnce(new Error('reset')).mockResolvedValue(SUCCESS);
    const r = await run(http({ getJson }), ['gold']);
    expect(r.skins[0].ok).toBe(true);
    expect(getJson).toHaveBeenCalledTimes(2);
  });

  it('a rejected download keeps the skin task id', async () => {
    const download = vi.fn<TripoHttp['download']>().mockRejectedValue(new Error('ENOSPC'));
    const r = await run(http({ download }), ['gold']);
    expect(r.skins[0]).toMatchObject({ ok: false, taskId: 't1' });
    expect(r.skins[0].error).toContain('ENOSPC');
  });
});
