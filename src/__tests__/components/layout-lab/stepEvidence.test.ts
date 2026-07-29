import { describe, it, expect } from 'vitest';
import { collectStepEvidence, evidenceBlock } from '@/components/layout-lab/steps/shared/stepEvidence';
import { GEN_HISTORY_KEY } from '@/components/layout-lab/steps/shared/genHistory';
import type { GenHistory } from '@/components/layout-lab/steps/shared/genHistory';

/** Minimal history with one batch and an explicit selection. */
const history = (
  candidates: { id: string; swatch: string; imageUrl?: string; payload?: Record<string, unknown> }[],
  selectedId: string | null,
): GenHistory => ({
  batches: [{
    id: 'b0',
    at: '2026-07-20T10:00:00.000Z',
    direction: 'brass and soot',
    prompt: 'P',
    candidates: candidates.map((c) => ({ ...c, payload: c.payload ?? {} })),
  }],
  selectedId,
});

describe('collectStepEvidence', () => {
  it('finds nothing on an empty artifact', () => {
    expect(collectStepEvidence({})).toEqual([]);
    expect(collectStepEvidence(undefined)).toEqual([]);
  });

  it('picks up a served mesh on a non-gallery step', () => {
    const ev = collectStepEvidence({ glbUrl: '/api/visual-gen/asset/hero.glb' });
    expect(ev).toHaveLength(1);
    expect(ev[0].kind).toBe('mesh');
    expect(ev[0].url).toBe('/api/visual-gen/asset/hero.glb');
  });

  it('picks up the SELECTED gallery candidate’s served image', () => {
    const ev = collectStepEvidence({
      [GEN_HISTORY_KEY]: history(
        [
          { id: 'b0-c0', swatch: '#111', imageUrl: '/api/visual-gen/asset/a.png' },
          { id: 'b0-c1', swatch: '#222', imageUrl: '/api/visual-gen/asset/b.png' },
        ],
        'b0-c1',
      ),
    });
    expect(ev.map((e) => e.url)).toEqual(['/api/visual-gen/asset/b.png']);
  });

  it('ignores unselected candidates — evidence is what is ON SCREEN, not the whole batch', () => {
    const ev = collectStepEvidence({
      [GEN_HISTORY_KEY]: history(
        [
          { id: 'b0-c0', swatch: '#111', imageUrl: '/a.png' },
          { id: 'b0-c1', swatch: '#222', imageUrl: '/b.png' },
        ],
        'b0-c0',
      ),
    });
    expect(ev).toHaveLength(1);
  });

  it('refuses to cite a swatch — a deterministic colour preview is not an asset', () => {
    const ev = collectStepEvidence({
      [GEN_HISTORY_KEY]: history([{ id: 'b0-c0', swatch: 'linear-gradient(#123,#456)' }], 'b0-c0'),
    });
    expect(ev).toEqual([]);
  });

  it('reports both an image and a mesh when the step has each', () => {
    const ev = collectStepEvidence({
      glbUrl: '/api/visual-gen/asset/hero.glb',
      [GEN_HISTORY_KEY]: history([{ id: 'b0-c0', swatch: '#111', imageUrl: '/shot.png' }], 'b0-c0'),
    });
    expect(ev.map((e) => e.kind).sort()).toEqual(['image', 'mesh']);
  });

  it('does not duplicate a mesh that is both the selection payload and top-level data', () => {
    const ev = collectStepEvidence({
      glbUrl: '/api/visual-gen/asset/hero.glb',
      [GEN_HISTORY_KEY]: history(
        [{ id: 'b0-c0', swatch: '#111', payload: { glbUrl: '/api/visual-gen/asset/hero.glb' } }],
        'b0-c0',
      ),
    });
    expect(ev).toHaveLength(1);
  });

  it('ignores a non-string url rather than emitting a broken reference', () => {
    expect(collectStepEvidence({ glbUrl: 42 })).toEqual([]);
    expect(collectStepEvidence({ glbUrl: '' })).toEqual([]);
  });

  it('survives a malformed history without throwing', () => {
    expect(collectStepEvidence({ [GEN_HISTORY_KEY]: 'not a history' })).toEqual([]);
    expect(collectStepEvidence({ [GEN_HISTORY_KEY]: { batches: 'nope' } })).toEqual([]);
  });
});

describe('evidenceBlock', () => {
  it('is empty when there is nothing to cite — a produce prompt gains no dead section', () => {
    expect(evidenceBlock([])).toBe('');
  });

  it('lists each asset with its kind and served url', () => {
    const block = evidenceBlock([
      { kind: 'image', url: '/api/visual-gen/asset/a.png', label: 'selected candidate' },
      { kind: 'mesh', url: '/api/visual-gen/asset/h.glb', label: 'step mesh' },
    ]);
    expect(block).toContain('/api/visual-gen/asset/a.png');
    expect(block).toContain('/api/visual-gen/asset/h.glb');
    expect(block).toMatch(/image/i);
    expect(block).toMatch(/mesh/i);
  });

  it('tells the session these are the artifacts currently on screen', () => {
    const block = evidenceBlock([{ kind: 'image', url: '/a.png', label: 'selected candidate' }]);
    expect(block).toMatch(/on screen|currently|being looked at|under review/i);
  });
});
