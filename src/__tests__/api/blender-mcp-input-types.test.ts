/**
 * Fields the bridge forwards are checked for type first. A non-string prompt started a PAID
 * job, and an unknown asset source silently downloaded from Poly Haven.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ok } from '@/types/result';

const svc = {
  generateHyper3D: vi.fn(async () => ok({ jobId: 'j', status: 'generating' })),
  generateHunyuan3D: vi.fn(async () => ok({ jobId: 'j', status: 'generating' })),
  importGeneratedAsset: vi.fn(async () => ok({ objectName: 'o' })),
  downloadPolyHaven: vi.fn(async () => ok({ objectName: 'o' })),
  downloadSketchfab: vi.fn(async () => ok({ objectName: 'o' })),
};
vi.mock('@/lib/blender-mcp/service', () => ({ getService: () => svc }));
vi.mock('@/lib/blender-mcp/generation-ledger', () => ({
  ledger: { record: vi.fn(), importOnce: vi.fn(async (_j: string, _p: string, run: () => unknown) => run()) },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { POST: generate } = await import('@/app/api/blender-mcp/generate/route');
const { POST: importJob } = await import('@/app/api/blender-mcp/generate/import/route');
const { POST: download } = await import('@/app/api/blender-mcp/assets/download/route');

const req = (body: unknown) =>
  new NextRequest('http://localhost:3001/api/blender-mcp/x', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => {
  for (const fn of Object.values(svc)) fn.mockClear();
});

describe('blender-mcp field types', () => {
  it.each([[123], [true], [['a']], [{ a: 1 }]])('generate refuses prompt %j and starts no job', async (prompt) => {
    expect((await generate(req({ provider: 'hyper3d', prompt }))).status).toBe(400);
    expect(svc.generateHyper3D).not.toHaveBeenCalled();
  });

  it('import refuses a non-string jobId', async () => {
    expect((await importJob(req({ provider: 'hyper3d', jobId: { a: 1 } }))).status).toBe(400);
    expect(svc.importGeneratedAsset).not.toHaveBeenCalled();
  });

  it('download refuses an unknown source and fetches nothing', async () => {
    expect((await download(req({ source: 'evilhaven', id: 'x' }))).status).toBe(400);
    expect(svc.downloadPolyHaven).not.toHaveBeenCalled();
  });

  it('download refuses a non-string id', async () => {
    expect((await download(req({ source: 'polyhaven', id: 7 }))).status).toBe(400);
    expect(svc.downloadPolyHaven).not.toHaveBeenCalled();
  });

  it('[guard] valid requests still dispatch', async () => {
    expect((await generate(req({ provider: 'hunyuan3d', prompt: 'a rock' }))).status).toBe(201);
    expect((await download(req({ source: 'sketchfab', id: 'x' }))).status).toBe(200);
    expect(svc.generateHunyuan3D).toHaveBeenCalledOnce();
    expect(svc.downloadSketchfab).toHaveBeenCalledOnce();
  });
});
