/**
 * The three headless-Blender spawns (mesh-finish / -split / -views) run through the one
 * local-process seam, so a run that printed no marker says HOW it ended — exited with a
 * code, killed by our timer, never started — instead of `error: undefined` (finish), a
 * false "no part above the speck threshold" (split), or "the render did not finish"
 * (views). No Blender is launched: every run is a fake outcome.
 */
import { describe, it, expect, vi } from 'vitest';
import { runMeshFinish } from '@/lib/visual-gen/mesh-finish';
import { runMeshSplit } from '@/lib/visual-gen/mesh-split';
import { runMeshViews } from '@/lib/visual-gen/mesh-views';

const getMeshFinishJob = vi.fn();
vi.mock('@/lib/visual-gen/mesh-finish-job-store', () => ({
  getMeshFinishJob: (...a: unknown[]) => getMeshFinishJob(...a),
}));

const yes = () => true;
const ENV = { POF_BLENDER: 'C:/b/blender.exe' };

describe('Blender spawns name their ending', () => {
  it('mesh-finish: a crash with no marker carries the exit code and the last output', async () => {
    const r = await runMeshFinish(
      { highPolyPath: 'C:/g/hi.glb', outputPath: 'C:/g/lo.glb' },
      { fileExists: yes, env: ENV, run: async () => ({ stdout: 'Traceback (most recent call last)\nMemoryError', code: 1 }) },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/exited with code 1/);
    expect(r.error).toContain('MemoryError');
  });

  it('mesh-split: a killed run is a timeout, not a speck-threshold miss', async () => {
    const r = await runMeshSplit(
      { inputPath: 'C:/g/props.glb', outputDir: 'C:/g/split', prefix: 'props', timeoutMs: 600_000 },
      { fileExists: yes, env: ENV, run: async () => ({ stdout: '', code: null, timedOut: true }) },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timed out after 10 min/);
    expect(r.error).not.toContain('speck threshold');
  });

  it('mesh-views: a Blender that never started says so', async () => {
    const r = await runMeshViews(
      { meshPath: 'C:/g/crate.glb', outDir: 'C:/g/views' },
      { fileExists: yes, env: ENV, run: async () => ({ stdout: '', code: null, spawnError: 'spawn blender.exe ENOENT' }) },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/could not start/);
  });

  it('mesh-finish status: the poll forwards failed and refused bakes', async () => {
    getMeshFinishJob.mockReturnValue({
      status: 'done',
      spec: { highPolyPath: 'C:/g/hi.glb', outputPath: 'C:/g/lo.glb' },
      result: {
        ok: true, meshPath: 'C:/g/lo.glb', durationMs: 5,
        bakeFailed: [{ map: 'ao', reason: 'Circular dependency for image' }],
        bakeSkipped: [{ map: 'metallic', reason: 'no metallic pass' }],
      },
    });
    const { GET } = await import('@/app/api/visual-gen/mesh-finish/status/route');
    const res = await GET({ nextUrl: new URL('http://localhost/api/visual-gen/mesh-finish/status?jobId=j1') } as never);
    const json = (await res.json()) as { data: { bakeFailed?: unknown; bakeSkipped?: unknown } };
    expect(json.data.bakeFailed).toEqual([{ map: 'ao', reason: 'Circular dependency for image' }]);
    expect(json.data.bakeSkipped).toEqual([{ map: 'metallic', reason: 'no metallic pass' }]);
  });
});
