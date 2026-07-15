import { describe, it, expect, beforeEach } from 'vitest';
import { makeUeCaptureResolver, DEFAULT_LIT_MAP } from '@/lib/test-gate-runner/captureResolver';
import { clearScenarioRegistry, registerScenario, registerBuiltinScenarios } from '@/lib/test-gate-runner/scenarioRegistry';
import type { GateJob } from '@/lib/test-gate-runner/types';
import type { CaptureScenarioFrameOptions } from '@/lib/ue-launch/capture';

const job = (over: Partial<GateJob> = {}): GateJob =>
  ({ catalogId: 'zone-map', entityId: 'e1', step: 'verify', tier: 'L4', ...over } as GateJob);

beforeEach(() => { clearScenarioRegistry(); registerBuiltinScenarios(); });

describe('makeUeCaptureResolver — entity-context frames', () => {
  it('honors a scenario-DECLARED map (the entity is judged in its own scene)', async () => {
    let seen: CaptureScenarioFrameOptions | null = null;
    const resolve = makeUeCaptureResolver(
      { uproject: 'C:/p/PoF.uproject' },
      { capture: async (o) => { seen = o; return 'C:/out/shot_01.png'; } },
    );
    // The built-in `abilities` scenario declares its own (lit) map.
    const out = await resolve(job({ catalogId: 'abilities', entityId: 'fireball' }));
    expect(out.screenshot).toBe('C:/out/shot_01.png');
    expect(seen!.scenario).toBeDefined();
    expect(seen!.scenario!.inputs?.[0]?.event).toBe('activate_ability');
    // The declared map now wins (was forced to VerticalSlice before).
    expect(seen!.map).toBe('/Game/Maps/TestHarness');
    expect(out.map).toBe('/Game/Maps/TestHarness');
    expect(out.scenarioDriven).toBe(true);
  });

  it('falls back to the lit VerticalSlice when no map is declared (unchanged default)', async () => {
    let seen: CaptureScenarioFrameOptions | null = null;
    const resolve = makeUeCaptureResolver(
      { uproject: 'C:/p/PoF.uproject', engine: '5.8' },
      { capture: async (o) => { seen = o; return 'C:/out/shot.png'; } },
    );
    const out = await resolve(job({ catalogId: 'zone-map' })); // no scenario, no mapFor
    expect(seen!.scenario).toBeUndefined();
    expect(seen!.map).toBe(DEFAULT_LIT_MAP);
    expect(out.map).toBe(DEFAULT_LIT_MAP);
    expect(out.scenarioDriven).toBe(false);
    expect(seen!.engine).toBe('5.8');
  });

  it('an explicit operator mapFor wins over the scenario map', async () => {
    let seen: CaptureScenarioFrameOptions | null = null;
    const resolve = makeUeCaptureResolver(
      { uproject: 'C:/p/PoF.uproject', mapFor: (j) => `/Game/Maps/${j.catalogId}` },
      { capture: async (o) => { seen = o; return 'C:/out/shot.png'; } },
    );
    const out = await resolve(job({ catalogId: 'abilities', entityId: 'fireball' }));
    expect(seen!.map).toBe('/Game/Maps/abilities'); // operator override wins over TestHarness
    expect(out.map).toBe('/Game/Maps/abilities');
  });

  it('a DECLARED map that produces no frame → deferred with a reason (never a silent VerticalSlice fallback)', async () => {
    // A scenario declaring a map that renders nothing (missing / unlit) must DEFER honestly.
    registerScenario('zone-map', () => ({
      map: '/Game/Maps/AshenForest', totalSeconds: 2, numSamples: 4, inputs: [], assert: [{ kind: 'moved' }],
    }));
    let seen: CaptureScenarioFrameOptions | null = null;
    const resolve = makeUeCaptureResolver(
      { uproject: 'C:/p/PoF.uproject' },
      { capture: async (o) => { seen = o; return null; } }, // no frame produced
    );
    const out = await resolve(job({ catalogId: 'zone-map' }));
    expect(seen!.map).toBe('/Game/Maps/AshenForest'); // it TRIED the declared map
    expect(out.screenshot).toBeNull();
    expect(out.map).toBe('/Game/Maps/AshenForest');
    expect(out.deferredReason).toMatch(/AshenForest/);
    expect(out.deferredReason).toMatch(/LIT map/);
  });

  it('the DEFAULT lit slice producing no frame is NOT a declared-map defer (legacy null path)', async () => {
    const resolve = makeUeCaptureResolver(
      { uproject: 'C:/p/PoF.uproject' },
      { capture: async () => null },
    );
    const out = await resolve(job({ catalogId: 'zone-map' })); // no declared map
    expect(out.screenshot).toBeNull();
    expect(out.deferredReason).toBeUndefined(); // → visualExecutor's generic "no source" path
  });
});
