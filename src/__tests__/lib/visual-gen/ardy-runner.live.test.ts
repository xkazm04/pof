/**
 * LIVE smoke for the ARDY text→motion install.
 *
 * Skipped unless `POF_ARDY_ROOT` points at a real checkout, so `npm run validate` is
 * unaffected — the unit suite in `ardy-runner.test.ts` covers the pure cores with a fake
 * spawn seam, and this exercises the DEFAULT spawn seam against the actual model.
 *
 * This exists because the install silently vanished once (2026-08-19: the spec still read
 * "PROVEN LIVE" while nothing was on disk, and only a filesystem check could tell them
 * apart). A pipeline that claims to be proven should be re-provable in one command:
 *
 *   POF_ARDY_ROOT=C:/Users/kazda/kiro/ardy npx vitest run src/__tests__/lib/visual-gen/ardy-runner.live.test.ts
 */
import { describe, it, expect } from 'vitest';
import { runArdy, preflightArdy } from '@/lib/visual-gen/ardy-runner';

const ROOT = process.env.POF_ARDY_ROOT;
const live = ROOT ? describe : describe.skip;

live('ARDY live smoke (POF_ARDY_ROOT set)', () => {
  it('preflights the real install — every check green', async () => {
    const r = await preflightArdy({ ardyRoot: ROOT });
    // Name the failing check in the assertion message; a bare `false` here would send the
    // reader back to the shell to find out which of the four gates tripped.
    const failed = r.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
    expect(failed, failed.join(' | ')).toEqual([]);
    expect(r.ok).toBe(true);
  }, 180_000);

  it('generates a real clip through the default spawn seam', async () => {
    const r = await runArdy({
      prompt: 'a person walks forward at a steady pace',
      outputPath: './outputs/pof_runner_smoke',
      durationSec: 3,
      seed: 7,
      ardyRoot: ROOT,
    });
    expect(r.error ?? '', r.error ?? '').toBe('');
    expect(r.ok).toBe(true);
    expect(r.npzPath).toBeTruthy();
    // 3 s at the Core model's 20 fps. Pins that the runner reads the real shape line rather
    // than echoing back the duration it was asked for.
    expect(r.frames).toBe(60);
    expect(r.fps).toBe(20);
    expect(r.model).toContain('ARDY-Core');
  }, 900_000);
});
