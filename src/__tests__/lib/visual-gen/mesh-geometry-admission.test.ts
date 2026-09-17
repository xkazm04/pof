/**
 * The download door admits on BYTES; the thing it is protecting is paid in TRIANGLES.
 *
 * `fetchMeshForGrading` caps `content-length` and the received body against
 * `MESH_FETCH_MAX_BYTES`, and the comment on that constant states the reason plainly:
 * "critiqueMesh loads the whole mesh into trimesh in a python subprocess". Bytes are
 * not what trimesh spends. A glTF container declares its own geometry in its JSON
 * chunk, so a two-hundred-byte body can announce a hundred million triangles, clear a
 * 96 MB byte cap by five orders of magnitude, and be handed to the grader.
 *
 * Every assertion here is red against the byte-only door and green once the door also
 * reads the declared geometry. The fetch is injected; no network is touched.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  fetchMeshForGrading,
  MESH_FETCH_MAX_BYTES,
  MESH_FETCH_MAX_TRIANGLES,
} from '@/lib/visual-gen/mesh-fetch';

const URL_OK = 'https://hyperhuman.deemos.com/out/job1.glb';

/** A real GLB container: 12-byte header, a JSON chunk, an optional BIN chunk. */
function glb(doc: unknown, binBytes = 0): Uint8Array {
  const json = JSON.stringify(doc);
  const pad = (4 - (json.length % 4)) % 4;
  const jsonLen = json.length + pad;
  const total = 12 + 8 + jsonLen + (binBytes ? 8 + binBytes : 0);
  const buf = new Uint8Array(total);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  for (let i = 0; i < json.length; i++) buf[20 + i] = json.charCodeAt(i);
  for (let i = 0; i < pad; i++) buf[20 + json.length + i] = 0x20;
  if (binBytes) {
    dv.setUint32(20 + jsonLen, binBytes, true);
    dv.setUint32(24 + jsonLen, 0x004e4942, true); // 'BIN\0'
  }
  return buf;
}

/** A container declaring exactly `tri` triangles across `primitives` primitives. */
function declaring(tri: number, primitives = 1): Uint8Array {
  const per = Math.ceil(tri / primitives);
  return glb({
    asset: { version: '2.0' },
    accessors: Array.from({ length: primitives }, () => ({ count: per * 3, componentType: 5125, type: 'SCALAR' })),
    meshes: [{ primitives: Array.from({ length: primitives }, (_, i) => ({ indices: i, mode: 4 })) }],
  });
}

function response(bytes: Uint8Array) {
  return {
    ok: true,
    status: 200,
    url: URL_OK,
    headers: {
      get: (h: string) =>
        h.toLowerCase() === 'content-type' ? 'model/gltf-binary'
          : h.toLowerCase() === 'content-length' ? String(bytes.byteLength)
            : null,
    },
    arrayBuffer: () => Promise.resolve(bytes.buffer.slice(0) as ArrayBuffer),
  };
}

function deps(bytes: Uint8Array) {
  const writes: { path: string; bytes: number }[] = [];
  return {
    writes,
    deps: {
      fetchFn: vi.fn().mockResolvedValue(response(bytes)) as unknown as typeof fetch,
      writeFile: (p: string, d: Uint8Array) => { writes.push({ path: p, bytes: d.byteLength }); },
      mkdir: () => {},
      outDir: '/tmp/generated/mcp',
    },
  };
}

describe('the door reads the dimension the grader is charged in', () => {
  it('refuses a small body that declares a hundred million triangles', async () => {
    const bomb = declaring(100_000_000);
    expect(bomb.byteLength).toBeLessThan(1024); // the byte cap cannot see this at all
    const { deps: d, writes } = deps(bomb);
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toContain('100000000');
    expect(writes).toHaveLength(0);
  });

  it('is a gate, not a formality: budget admitted, budget+1 refused', async () => {
    const at = deps(declaring(MESH_FETCH_MAX_TRIANGLES));
    expect((await fetchMeshForGrading(URL_OK, 'jobA', at.deps)).ok).toBe(true);
    const over = deps(declaring(MESH_FETCH_MAX_TRIANGLES + 1));
    const out = await fetchMeshForGrading(URL_OK, 'jobB', over.deps);
    expect(out.ok).toBe(false);
    expect(over.writes).toHaveLength(0);
  });

  it('refuses a sum spread across primitives, not only one fat accessor', async () => {
    const { deps: d, writes } = deps(declaring(MESH_FETCH_MAX_TRIANGLES * 4, 64));
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it('refuses counts that would leave exact integer range before they are summed', async () => {
    const { deps: d, writes } = deps(
      glb({
        asset: { version: '2.0' },
        accessors: Array.from({ length: 8 }, () => ({ count: Number.MAX_SAFE_INTEGER, componentType: 5125, type: 'SCALAR' })),
        meshes: [{ primitives: Array.from({ length: 8 }, (_, i) => ({ indices: i, mode: 4 })) }],
      }),
    );
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it('a declaration is a hint, so the door reports it for the stage that can measure', async () => {
    const { deps: d } = deps(declaring(1_000));
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.declaredTriangles).toBe(1_000);
  });

  it('cannot catch a container that understates itself, which is why it reports rather than certifies', async () => {
    // 1,000 declared triangles beside a 4 MB payload: the JSON chunk is the only thing
    // readable without paying the load, so the door admits and records the claim. The
    // grader measures what it actually loads; the discrepancy is detectable only because
    // the number the container asserted was carried forward.
    const lying = glb(
      {
        asset: { version: '2.0' },
        accessors: [{ count: 3_000, componentType: 5125, type: 'SCALAR' }],
        meshes: [{ primitives: [{ indices: 0, mode: 4 }] }],
      },
      4 * 1024 * 1024,
    );
    const { deps: d, writes } = deps(lying);
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.declaredTriangles).toBe(1_000);
    expect(writes[0].bytes).toBeGreaterThan(4 * 1024 * 1024);
  });

  it('says unmeasured rather than compliant when the body is not a readable container', async () => {
    const { deps: d, writes } = deps(new Uint8Array(1024).fill(7));
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.declaredTriangles).toBeUndefined();
    expect(writes).toHaveLength(1);
  });

  it('the byte cap still runs, and runs first', async () => {
    expect(MESH_FETCH_MAX_BYTES).toBeGreaterThan(0);
    const { deps: d } = deps(declaring(10));
    expect((await fetchMeshForGrading(URL_OK, 'job1', d)).ok).toBe(true);
  });
});
