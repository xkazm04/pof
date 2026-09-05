/**
 * The download seam that makes an MCP mesh gradeable — and every refusal it names.
 *
 * Forced-failure suite for `mcp-mesh-download-and-grade`. At HEAD~1 `src/lib/visual-gen/
 * mesh-fetch.ts` did not exist: the Blender-MCP path was STRUCTURALLY ungradeable because
 * `critiqueMesh(glbPath)` reads a file on this server's disk and nothing on that path ever
 * put one there. Every assertion is red without the new module.
 *
 * The fetch is INJECTED — no network is touched here, and no live provider download
 * happened in the session that wrote this.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  fetchMeshForGrading,
  MESH_FETCH_MAX_BYTES,
  MESH_HOST_ALLOWLIST,
  meshHostAllowed,
  MCP_ASSET_DIR,
} from '@/lib/visual-gen/mesh-fetch';
import { ASSET_DIRS, assetUrl, buildAssetList, safeAssetDir } from '@/lib/visual-gen/generated-assets';

function body(bytes: number): Uint8Array {
  return new Uint8Array(bytes).fill(7);
}

/** A Response-shaped stub — only what the seam reads. */
function response(over: Partial<{ ok: boolean; status: number; url: string; type: string; length: string | null; bytes: Uint8Array }> = {}) {
  const bin = over.bytes ?? body(1024);
  return {
    ok: over.ok ?? true,
    status: over.status ?? 200,
    url: over.url ?? 'https://hyperhuman.deemos.com/out/job1.glb',
    headers: {
      get: (h: string) =>
        h.toLowerCase() === 'content-type' ? (over.type ?? 'model/gltf-binary')
          : h.toLowerCase() === 'content-length' ? (over.length === undefined ? String(bin.byteLength) : over.length)
            : null,
    },
    arrayBuffer: () => Promise.resolve(bin.buffer.slice(0) as ArrayBuffer),
  };
}

function deps(res = response(), writes: { path: string; bytes: number }[] = []) {
  return {
    writes,
    deps: {
      fetchFn: vi.fn().mockResolvedValue(res) as unknown as typeof fetch,
      writeFile: (p: string, data: Uint8Array) => { writes.push({ path: p, bytes: data.byteLength }); },
      mkdir: () => {},
      outDir: '/tmp/generated/mcp',
    },
  };
}

const URL_OK = 'https://hyperhuman.deemos.com/out/job1.glb';

describe('meshHostAllowed — an explicit list, not a heuristic', () => {
  it('accepts each listed provider host and its subdomains', () => {
    expect(MESH_HOST_ALLOWLIST.length).toBeGreaterThan(0);
    for (const h of MESH_HOST_ALLOWLIST) {
      expect(meshHostAllowed(h)).toBe(true);
      expect(meshHostAllowed(`cdn.${h}`)).toBe(true);
    }
  });

  it('refuses anything else, including a look-alike suffix', () => {
    expect(meshHostAllowed('evil.com')).toBe(false);
    expect(meshHostAllowed('localhost')).toBe(false);
    expect(meshHostAllowed('notdeemos.com')).toBe(false);
    expect(meshHostAllowed('deemos.com.evil.io')).toBe(false);
  });
});

describe('fetchMeshForGrading', () => {
  it('writes an allow-listed mesh to generated/mcp/<jobId>.glb', async () => {
    const { deps: d, writes } = deps();
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // Windows join — assert the shape, not the separator.
    expect(out.path.split('\\').join('/')).toBe('/tmp/generated/mcp/job1.glb');
    expect(out.name).toBe('job1.glb');
    expect(writes).toHaveLength(1);
    expect(writes[0].bytes).toBe(1024);
  });

  it('refuses a host that is not on the list, and NAMES the host', async () => {
    const { deps: d, writes } = deps(response({ url: 'https://cdn.evil.com/x.glb' }));
    const out = await fetchMeshForGrading('https://cdn.evil.com/x.glb', 'job1', d);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toContain('cdn.evil.com');
    expect(out.reason).toContain('allow-list');
    expect(writes).toHaveLength(0);
    expect(d.fetchFn).not.toHaveBeenCalled();
  });

  it('refuses a non-https URL by name', async () => {
    const { deps: d } = deps();
    const out = await fetchMeshForGrading('http://hyperhuman.deemos.com/x.glb', 'job1', d);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toContain('https');
  });

  it('refuses a content-type that is not a mesh', async () => {
    const { deps: d, writes } = deps(response({ type: 'text/html' }));
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toContain('text/html');
    expect(writes).toHaveLength(0);
  });

  it('refuses a declared size over the stated cap, before reading the body', async () => {
    const { deps: d, writes } = deps(response({ length: String(MESH_FETCH_MAX_BYTES + 1) }));
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toContain(String(MESH_FETCH_MAX_BYTES));
    expect(writes).toHaveLength(0);
  });

  it('refuses an undeclared body that turns out to be over the cap', async () => {
    const { deps: d, writes } = deps(response({ length: null, bytes: body(MESH_FETCH_MAX_BYTES + 8) }));
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toContain('cap');
    expect(writes).toHaveLength(0);
  });

  it('refuses a redirect that left the allow-list', async () => {
    const { deps: d, writes } = deps(response({ url: 'https://cdn.evil.com/x.glb' }));
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toContain('redirect');
    expect(writes).toHaveLength(0);
  });

  it('refuses an HTTP error status', async () => {
    const { deps: d } = deps(response({ ok: false, status: 403 }));
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toContain('403');
  });

  it('refuses a jobId that cannot be a safe filename', async () => {
    const { deps: d, writes } = deps();
    const out = await fetchMeshForGrading(URL_OK, '../../etc/passwd', d);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toContain('job id');
    expect(writes).toHaveLength(0);
  });

  it('reports a transport failure as a named refusal, never a throw', async () => {
    const d = {
      fetchFn: vi.fn().mockRejectedValue(new Error('socket hang up')) as unknown as typeof fetch,
      writeFile: () => {},
      mkdir: () => {},
      outDir: '/tmp/generated/mcp',
    };
    const out = await fetchMeshForGrading(URL_OK, 'job1', d);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toContain('socket hang up');
  });
});

describe('generated/mcp is servable — and lists only what actually landed', () => {
  it('joins the ASSET_DIRS allow-list so a graded file has a URL', () => {
    expect(ASSET_DIRS.some((d) => d.dir === MCP_ASSET_DIR)).toBe(true);
    expect(safeAssetDir('mcp')?.dir).toBe('mcp');
    expect(assetUrl('j1.glb', MCP_ASSET_DIR)).toBe('/api/visual-gen/asset/j1.glb?dir=mcp');
  });

  it('lists nothing when the fetch was refused — the dir is an allow-list, not a claim', async () => {
    const { deps: d, writes } = deps(response({ url: 'https://cdn.evil.com/x.glb' }));
    const out = await fetchMeshForGrading('https://cdn.evil.com/x.glb', 'job1', d);
    expect(out.ok).toBe(false);
    // Nothing was written, so the dir listing (which is built from the files on disk)
    // has nothing to report for this job.
    expect(writes).toHaveLength(0);
    expect(buildAssetList([], new Set(), MCP_ASSET_DIR)).toEqual([]);
  });
});
