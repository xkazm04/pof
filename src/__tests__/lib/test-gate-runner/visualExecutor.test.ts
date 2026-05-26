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
    const fetchImpl = (() => resp({ success: true, data: { verdict: 'pass' } })) as unknown as typeof fetch;
    const ex = makeVisualExecutor({
      appOrigin: 'http://x',
      fetchImpl,
      screenshotResolver: async () => 'C:/shots/x.png',
    });
    const v = await ex.run(job);
    expect(v.status).toBe('pass');
    expect(v.detail).toContain('texture');
  });

  it('maps a fail verdict and throws on an error envelope', async () => {
    const pass = makeVisualExecutor({ appOrigin: 'http://x', screenshotResolver: async () => 'p.png', fetchImpl: (() => resp({ success: true, data: { verdict: 'fail' } })) as unknown as typeof fetch });
    expect((await pass.run(job)).status).toBe('fail');

    const err = makeVisualExecutor({ appOrigin: 'http://x', screenshotResolver: async () => 'p.png', fetchImpl: (() => resp({ success: false, error: 'no gemini key' }, false, 503)) as unknown as typeof fetch });
    await expect(err.run(job)).rejects.toThrow(/verify\/visual failed/);
  });
});
