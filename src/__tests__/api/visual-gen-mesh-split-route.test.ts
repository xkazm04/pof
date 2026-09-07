import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Wiring + refusal guard for the split endpoint.
 *
 * The pure module cannot see whether anything calls it, and the endpoint's most
 * important answer is a REFUSAL: a shattered single object and a group of objects are
 * the same shape to a component count, so a route that reported only successes would
 * turn debris into assets (measured on props__crate.glb: 451 components, 23% coverage).
 */

const runMeshSplit = vi.fn();
vi.mock('@/lib/visual-gen/mesh-split', () => ({ runMeshSplit: (...a: unknown[]) => runMeshSplit(...a) }));
// No fs mock: the route's existence check is part of what is under test, so it runs
// against a real file that this repo ships under `generated/`.
const REAL = 'props__crate.glb';
const REAL_DIR = 'meshes';

async function post(body: unknown) {
  const { POST } = await import('@/app/api/visual-gen/mesh-split/route');
  const req = new Request('http://localhost/api/visual-gen/mesh-split', { method: 'POST', body: JSON.stringify(body) });
  return POST(req as never);
}

describe('POST /api/visual-gen/mesh-split', () => {
  beforeEach(() => runMeshSplit.mockReset());

  it('writes only inside the allow-listed split dir and never lets a caller name a path', async () => {
    runMeshSplit.mockResolvedValue({ ok: true, parts: [], durationMs: 1 });
    await post({ name: REAL, dir: REAL_DIR });
    const spec = runMeshSplit.mock.calls[0][0] as { inputPath: string; outputDir: string; prefix: string };
    expect(spec.inputPath.endsWith(`generated/${REAL_DIR}/${REAL}`)).toBe(true);
    expect(spec.outputDir.endsWith('generated/mesh-split')).toBe(true);
    expect(spec.prefix).toBe('props__crate');
  });

  it('refuses a basename that is really a path, before touching the filesystem', async () => {
    const res = await post({ name: '../../etc/passwd' });
    expect(res.status).toBe(400);
    expect(runMeshSplit).not.toHaveBeenCalled();
  });

  it('reports each written part with a servable URL', async () => {
    runMeshSplit.mockResolvedValue({
      ok: true, facesIn: 9800, components: 5, coverage: 0.998, discarded: 2, discardedFaces: 20, capped: 0,
      parts: [{ name: 'g_01.glb', path: '/g/g_01.glb', faces: 4200, share: 0.43 }],
      durationMs: 12,
    });
    const res = await post({ name: REAL, dir: REAL_DIR });
    const json = (await res.json()) as { data: { split: boolean; parts: { url: string }[]; coverage: number } };
    expect(json.data.split).toBe(true);
    expect(json.data.parts[0].url).toBe('/api/visual-gen/asset/g_01.glb?dir=mesh-split');
    expect(json.data.coverage).toBe(0.998);
  });

  it('returns a refusal with its reason and coverage, not an error and not assets', async () => {
    runMeshSplit.mockResolvedValue({
      ok: false, parts: [], components: 451, coverage: 0.2272, facesIn: 39882, durationMs: 9,
      error: 'the 24 components above the threshold cover only 23% of the faces (floor 80%) -- this is one fragmented mesh, not a group of objects; run mesh-finish on it instead of splitting it',
    });
    const res = await post({ name: REAL, dir: REAL_DIR });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { split: boolean; reason: string; coverage: number; components: number } };
    expect(json.data.split).toBe(false);
    expect(json.data.reason).toMatch(/one fragmented mesh/);
    expect(json.data.coverage).toBe(0.2272);
    expect(json.data.components).toBe(451);
  });
});
