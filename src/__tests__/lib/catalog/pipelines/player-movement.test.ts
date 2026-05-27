import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/player-movement';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('player-movement pipeline', () => {
  const pipeline = getCatalogPipeline('player-movement');

  it('is registered', () => {
    expect(pipeline).not.toBeNull();
  });

  it('has 10 steps', () => {
    expect(pipeline?.steps).toHaveLength(10);
  });

  it('step 1 is the mesh+skeleton verify with an L2 ok-style accept', () => {
    const s = pipeline?.steps[0];
    expect(s?.label).toMatch(/mesh/i);
    const result = s?.accept({ ok: true });
    expect(result?.status).toBe('pass');
    expect(result?.tier).toBe('L2');
  });

  it('step 2 is the human-confirmed Mixamo source list (L1)', () => {
    const s = pipeline?.steps[1];
    expect(s?.label).toMatch(/mixamo source/i);
    const pending = s?.accept({ confirmed: false });
    expect(pending?.status).toBe('pending');
    expect(pending?.tier).toBe('L1');
    const passed = s?.accept({ confirmed: true });
    expect(passed?.status).toBe('pass');
  });

  it('steps 3-5 use pythonStepSuccess with expected artifact counts', () => {
    for (const idx of [2, 3, 4]) {
      const s = pipeline?.steps[idx];
      const r = s?.accept({});
      expect(r?.status).toBe('pending');
      expect(r?.tier).toBe('L2');
    }
  });

  it('step 6 (blend space) expects 11 samples', () => {
    const s = pipeline?.steps[5];
    expect(s?.label).toMatch(/blend space/i);
    const r10 = s?.accept({ created: Array(10).fill('x'), skipped: [], failed: [] });
    expect(r10?.status).toBe('pending');
    const r11 = s?.accept({ created: Array(11).fill('x'), skipped: [], failed: [] });
    expect(r11?.status).toBe('pass');
  });

  it('step 7 (PoFEditor build) verifies the library symbol via ok-checker', () => {
    const s = pipeline?.steps[6];
    expect(s?.label).toMatch(/pofeditor/i);
    const ok = s?.accept({ ok: true });
    expect(ok?.status).toBe('pass');
  });

  it('step 8 (AnimBP) expects 1 created asset', () => {
    const s = pipeline?.steps[7];
    expect(s?.label).toMatch(/ABP_VSPlayer/i);
    const r = s?.accept({ created: ['ABP_VSPlayer'], skipped: [], failed: [] });
    expect(r?.status).toBe('pass');
  });

  it('step 9 (montage) expects AM_Roll', () => {
    const s = pipeline?.steps[8];
    expect(s?.label).toMatch(/AM_Roll/i);
    const r = s?.accept({ created: ['AM_Roll'], skipped: [], failed: [] });
    expect(r?.status).toBe('pass');
  });

  it('step 10 (playable gate) is L4 deferred (visual)', () => {
    const s = pipeline?.steps[9];
    expect(s?.label).toMatch(/playable gate/i);
    expect(s?.archetype).toBe('custom');
    const r = s?.accept({});
    expect(r?.tier).toBe('L4');
    expect(r?.status).toBe('deferred');
  });

  it('every step has produce() returning a python descriptor in data', () => {
    // Step 2 is the human-confirmed step (no python call)
    const pythonSteps = pipeline?.steps.filter((_, i) => i !== 1) ?? [];
    for (const s of pythonSteps) {
      const out = s.produce({ id: 'test', name: 'Test', lifecycle: 'planned', data: {} });
      const py = (out.data as { python?: { module?: string } })?.python;
      expect(py?.module).toMatch(/^player_movement\./);
    }
  });
});
