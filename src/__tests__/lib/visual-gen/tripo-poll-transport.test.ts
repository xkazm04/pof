import { describe, expect, it, vi } from 'vitest';
import { awaitTripoTask, isRecoverableTripoFailure, type TripoHttp } from '@/lib/visual-gen/tripo-runner';

const SUCCESS = { status: 200, json: { code: 0, data: { status: 'success', output: { model: 'https://x/m.glb' } } } };
const http = (over: Partial<TripoHttp>): TripoHttp => ({
  postJson: vi.fn(async () => ({ status: 200, json: undefined })),
  getJson: vi.fn(async () => SUCCESS),
  uploadImage: vi.fn(async () => ({ status: 200, json: undefined })),
  download: vi.fn(async () => true),
  ...over,
});
const deps = (h: TripoHttp) => ({
  http: h, env: { TRIPO_API_KEY: 'k' }, fileExists: () => true, now: () => 1, sleep: async () => {}, maxPolls: 3,
});

describe('Tripo polling survives a transport failure on a paid task', () => {
  it('a rejected poll is one unreadable read, and the next poll collects the mesh', async () => {
    const getJson = vi.fn<TripoHttp['getJson']>()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue(SUCCESS);
    const r = await awaitTripoTask('task-1', 'o.glb', deps(http({ getJson })));
    expect(r.ok).toBe(true);
    expect(getJson).toHaveBeenCalledTimes(2);
  });

  it('every poll rejecting returns a recoverable failure holding the task id', async () => {
    const getJson = vi.fn<TripoHttp['getJson']>().mockRejectedValue(new Error('fetch failed'));
    const r = await awaitTripoTask('task-1', 'o.glb', deps(http({ getJson })));
    expect(r.ok).toBe(false);
    expect(r.taskId).toBe('task-1');
    expect(r.error).toContain('fetch failed');
    expect(isRecoverableTripoFailure(r)).toBe(true);
  });

  it('a rejected download of a finished task stays recoverable and names the reason', async () => {
    const download = vi.fn<TripoHttp['download']>().mockRejectedValue(new Error('ENOSPC'));
    const r = await awaitTripoTask('task-1', 'o.glb', deps(http({ download })));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('ENOSPC');
    expect(isRecoverableTripoFailure(r)).toBe(true);
  });
});
