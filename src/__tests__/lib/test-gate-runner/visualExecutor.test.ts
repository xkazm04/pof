import { describe, it, expect } from 'vitest';
import { makeVisualExecutor, visualModeFor } from '@/lib/test-gate-runner/visualExecutor';

function resp(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) } as Response);
}
const job = { catalogId: 'materials', entityId: 'mat-weathered-stone', step: 'Test Gate', tier: 'L4' as const };

describe('visualModeFor', () => {
  it('maps catalogs to Gemini check modes', () => {
    expect(visualModeFor('materials')).toBe('texture');
    expect(visualModeFor('zone-map')).toBe('lighting');
    expect(visualModeFor('combat-map')).toBe('lighting');
    expect(visualModeFor('characters')).toBe('character');
    expect(visualModeFor('hud-elements')).toBe('hud');
  });
});

describe('makeVisualExecutor', () => {
  it('is tier L4', () => {
    expect(makeVisualExecutor({ appOrigin: 'http://x' }).tier).toBe('L4');
  });

  it('throws (→ stays deferred) when no screenshot source resolves', async () => {
    const ex = makeVisualExecutor({ appOrigin: 'http://x' }); // default resolver → null
    await expect(ex.run(job)).rejects.toThrow(/no screenshot source/);
  });

  it('runs the Gemini check and maps the verdict when a screenshot resolves', async () => {
    const fetchImpl = (() => resp({ success: true, data: { verdict: 'pass', notes: 'crisp tileable texture' } })) as unknown as typeof fetch;
    const ex = makeVisualExecutor({
      appOrigin: 'http://x',
      fetchImpl,
      screenshotResolver: async () => 'C:/shots/x.png',
    });
    const v = await ex.run(job);
    expect(v.status).toBe('pass');
    expect(v.detail).toContain('texture');
    // Evidence carries the frame + the judge's notes so the flip keeps its proof.
    expect(v.evidence).toMatchObject({ kind: 'visual', screenshotPath: 'C:/shots/x.png' });
    expect(v.evidence!.judgeText).toContain('crisp tileable texture');
    expect(typeof v.evidence!.at).toBe('string');
  });

  it('maps a real fail verdict (the judge actually judged and said fail)', async () => {
    const pass = makeVisualExecutor({ appOrigin: 'http://x', screenshotResolver: async () => 'p.png', fetchImpl: (() => resp({ success: true, data: { verdict: 'fail' } })) as unknown as typeof fetch });
    expect((await pass.run(job)).status).toBe('fail');
  });

  it('a judge OUTAGE stays deferred (not fail) and still surfaces the captured frame', async () => {
    // The judge couldn't run (bad model, no key, network) — an outage is NOT an observed failure,
    // so the gate stays deferred (no false regression). The frame is preserved for eye review.
    const err = makeVisualExecutor({ appOrigin: 'http://x', screenshotResolver: async () => 'p.png', fetchImpl: (() => resp({ success: false, error: 'no gemini key' }, false, 503)) as unknown as typeof fetch });
    const v = await err.run(job);
    expect(v.status).toBe('deferred');
    expect(v.screenshot).toBe('p.png');
    expect(v.detail).toContain('auto-judge unavailable');
    // Even on outage the evidence keeps the captured frame + the outage reason.
    expect(v.evidence).toMatchObject({ kind: 'visual', screenshotPath: 'p.png' });
    expect(v.evidence!.judgeText).toContain('auto-judge unavailable');
  });

  it('still THROWS when there is no screenshot source at all (nothing to review)', async () => {
    const none = makeVisualExecutor({ appOrigin: 'http://x', screenshotResolver: async () => null });
    await expect(none.run(job)).rejects.toThrow(/no screenshot source/);
  });

  it('stamps entity/map/scenario frame context into the evidence markers', async () => {
    const fetchImpl = (() => resp({ success: true, data: { verdict: 'pass', notes: 'crisp' } })) as unknown as typeof fetch;
    const ex = makeVisualExecutor({
      appOrigin: 'http://x',
      fetchImpl,
      // The richer resolution carries WHAT was photographed.
      screenshotResolver: async () => ({ screenshot: 'C:/shots/x.png', map: '/Game/Maps/AshenForest', scenarioDriven: true }),
    });
    const v = await ex.run(job);
    expect(v.status).toBe('pass');
    const markers = v.evidence!.markers!;
    expect(markers).toContain('entity=materials/mat-weathered-stone');
    expect(markers).toContain('map=/Game/Maps/AshenForest');
    expect(markers).toContain('scenario=driven');
  });

  it('a declared map that fails to load → deferred with a named reason (no VerticalSlice fallback)', async () => {
    let fetched = false;
    const fetchImpl = (() => { fetched = true; return resp({ success: true, data: { verdict: 'pass' } }); }) as unknown as typeof fetch;
    const ex = makeVisualExecutor({
      appOrigin: 'http://x',
      fetchImpl,
      screenshotResolver: async () => ({ screenshot: null, map: '/Game/Maps/AshenForest', scenarioDriven: true,
        deferredReason: 'declared map /Game/Maps/AshenForest produced no frame — it may not exist or may be unlit (L4 capture needs a LIT map)' }),
    });
    const v = await ex.run(job);
    expect(v.status).toBe('deferred');
    expect(v.detail).toMatch(/AshenForest/);
    expect(v.detail).toMatch(/LIT map/);
    expect(v.screenshot).toBeUndefined(); // there is no frame
    expect(fetched).toBe(false); // never called the judge on a non-existent frame
    // The attempted map is still stamped for the audit.
    expect(v.evidence!.markers).toContain('map=/Game/Maps/AshenForest');
  });
});
