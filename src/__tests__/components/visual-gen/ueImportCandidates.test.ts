/**
 * `importCandidates` / `suggestedAssetName` — the forge deliveries the UE import control can
 * offer, and the name each one lands under.
 *
 * Pinned: a finished mesh wins over the raw delivery; a job with nothing importable is never
 * offered; a delivery's verdict rides along verbatim (a rejected or ungated mesh is offered,
 * never as a pass); and no suggested name falls through to the shared 'TripoSRMesh'.
 */
import { describe, it, expect } from 'vitest';
import { importCandidates, suggestedAssetName } from '@/components/modules/visual-gen/asset-forge/ueImportCandidates';
import type { GenerationJob } from '@/components/modules/visual-gen/asset-forge/useForgeStore';

const job = (over: Partial<GenerationJob>): GenerationJob => ({
  id: 'j',
  mode: 'text-to-3d',
  prompt: 'a crate',
  providerId: 'triposr',
  status: 'completed',
  progress: 100,
  createdAt: 1,
  ...over,
});

describe('importCandidates', () => {
  it('offers only deliverable jobs, preferring the finished mesh over the raw delivery', () => {
    const out = importCandidates([
      job({
        id: 'done',
        accepted: true,
        meshPath: 'C:/p/generated/tripo3d/crate.glb',
        finish: { state: 'done', summary: 'decimated', improved: true, meshPath: 'C:/p/generated/mesh-finish/crate_lowpoly.glb' },
      }),
      job({ id: 'failed', status: 'failed', meshPath: 'C:/p/generated/tripo3d/x.glb' }),
      job({ id: 'gen', status: 'generating', meshPath: 'C:/p/generated/tripo3d/y.glb' }),
      job({ id: 'mismatch', meshPath: 'C:/p/generated/tripo3d/z.glb', formatMismatch: 'glTF JSON written as .glb' }),
      job({ id: 'mcp', mcpJobId: 'm1', mcpProvider: 'hyper3d' as GenerationJob['mcpProvider'] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      jobId: 'done',
      glbPath: 'C:/p/generated/mesh-finish/crate_lowpoly.glb',
      stage: 'finished',
    });
  });

  it('offers a raw delivery when no finish ran, and carries its verdict — never a pass for a rejected or ungated mesh', () => {
    const out = importCandidates([
      job({ id: 'rej', accepted: false, meshPath: 'C:/p/generated/triposr/a.glb' }),
      job({ id: 'ung', ungated: true, accepted: false, meshPath: 'C:/p/generated/triposr/b.glb' }),
      job({ id: 'acc', accepted: true, meshPath: 'C:/p/generated/triposr/c.glb', assetClass: 'prop' }),
    ]);
    const byId = Object.fromEntries(out.map((c) => [c.jobId, c]));
    expect(byId.rej).toMatchObject({ verdict: 'rejected', stage: 'raw' });
    expect(byId.ung).toMatchObject({ verdict: 'ungated' });
    expect(byId.acc).toMatchObject({ verdict: 'accepted', assetClass: 'prop' });
  });

  it('a finish that did not complete leaves the raw delivery as the candidate', () => {
    const [c] = importCandidates([
      job({ id: 'f', accepted: false, meshPath: 'C:/p/generated/triposr/a.glb', finish: { state: 'failed', error: 'boom' } }),
    ]);
    expect(c).toMatchObject({ glbPath: 'C:/p/generated/triposr/a.glb', stage: 'raw' });
  });
});

describe('suggestedAssetName', () => {
  it('derives an SM_ name from the prompt subject', () => {
    const n = suggestedAssetName({ prompt: 'a rusty iron-bound crate, game ready', glbPath: 'C:/p/generated/triposr/x.glb' });
    expect(n).toBe('SM_RustyIronBoundCrate');
    expect(n).toMatch(/^[A-Za-z0-9_]{1,40}$/);
  });

  it('falls back to the file basename when the prompt is empty', () => {
    expect(suggestedAssetName({ prompt: '', glbPath: 'C:/p/generated/tripo3d/props__crate.glb' })).toBe('SM_PropsCrate');
  });

  it('stays within 40 chars and never yields the shared TripoSRMesh', () => {
    const long = suggestedAssetName({
      prompt: 'an enormous ornate gilded cathedral organ with carved angels and brass pipes',
      glbPath: 'C:/p/generated/triposr/x.glb',
    });
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long).toMatch(/^SM_[A-Za-z0-9_]+$/);
    for (const glbPath of ['C:/p/generated/triposr/TripoSRMesh.glb', 'C:/p/generated/triposr/___.glb']) {
      const n = suggestedAssetName({ prompt: '', glbPath });
      expect(n).not.toBe('TripoSRMesh');
      expect(n).toMatch(/^SM_[A-Za-z0-9_]+$/);
    }
  });
});
