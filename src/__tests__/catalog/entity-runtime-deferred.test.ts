import { describe, it, expect } from 'vitest';
import { entityRuntimeDeferred } from '@/lib/catalog/acceptance/deferred';
import { parseRuntimeDeferredTestName } from '@/types/observation';

/**
 * Guard for the 2026-07-22 evidence-miswiring fix: a pipeline-level hardcoded gate
 * name let one entity's Test Gate be "proven" by another entity's test (Force Push
 * passed on the Fireball test; Knockback on the Burning test). Every pipeline's
 * Test Gate accept now goes through entityRuntimeDeferred.
 */
describe('entityRuntimeDeferred', () => {
  const accept = entityRuntimeDeferred('PoF.Fallback.Test', 'gate label');

  it('prefers the artifact-declared automationName', () => {
    const r = accept({ automationName: 'PoF.GenForcePush.DazeConfig' });
    expect(r.status).toBe('deferred');
    expect(r.tier).toBe('L3');
    expect(parseRuntimeDeferredTestName(r.reason)).toBe('PoF.GenForcePush.DazeConfig');
  });

  it('falls back to the pipeline default when none declared', () => {
    expect(parseRuntimeDeferredTestName(accept({}).reason)).toBe('PoF.Fallback.Test');
    expect(parseRuntimeDeferredTestName(accept({ automationName: '' }).reason)).toBe('PoF.Fallback.Test');
    expect(parseRuntimeDeferredTestName(accept({ automationName: 42 }).reason)).toBe('PoF.Fallback.Test');
  });

  it('every registered pipeline Test Gate uses the per-entity accept (no hardcoded regressions)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.resolve(__dirname, '../../lib/catalog/pipelines');
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(dir, file), 'utf-8');
      expect(src.includes('accept: runtimeDeferred('), `${file} still hardcodes its gate name`).toBe(false);
    }
  });
});
