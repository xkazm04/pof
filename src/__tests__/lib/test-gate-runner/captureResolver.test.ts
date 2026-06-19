import { describe, it, expect, beforeEach } from 'vitest';
import { makeUeCaptureResolver } from '@/lib/test-gate-runner/captureResolver';
import { clearScenarioRegistry, registerBuiltinScenarios } from '@/lib/test-gate-runner/scenarioRegistry';
import type { GateJob } from '@/lib/test-gate-runner/types';
import type { CaptureScenarioFrameOptions } from '@/lib/ue-launch/capture';

const job = (over: Partial<GateJob> = {}): GateJob =>
  ({ catalogId: 'zone-map', entityId: 'e1', step: 'verify', tier: 'L4', ...over } as GateJob);

beforeEach(() => { clearScenarioRegistry(); registerBuiltinScenarios(); });

describe('makeUeCaptureResolver', () => {
  it('drives the registered per-gate scenario when one matches the job', async () => {
    let seen: CaptureScenarioFrameOptions | null = null;
    const resolve = makeUeCaptureResolver(
      { uproject: 'C:/p/PoF.uproject' },
      { capture: async (o) => { seen = o; return 'C:/out/shot_01.png'; } },
    );
    const out = await resolve(job({ catalogId: 'abilities', entityId: 'fireball' }));
    expect(out).toBe('C:/out/shot_01.png');
    expect(seen!.scenario).toBeDefined();
    expect(seen!.scenario!.inputs?.[0]?.event).toBe('activate_ability');
  });

  it('uses a generic frame (no scenario) for an unregistered catalog, with mapFor', async () => {
    let seen: CaptureScenarioFrameOptions | null = null;
    const resolve = makeUeCaptureResolver(
      { uproject: 'C:/p/PoF.uproject', engine: '5.8', mapFor: (j) => `/Game/Maps/${j.catalogId}` },
      { capture: async (o) => { seen = o; return null; } },
    );
    const out = await resolve(job({ catalogId: 'zone-map' }));
    expect(out).toBeNull();
    expect(seen!.scenario).toBeUndefined();
    expect(seen!.map).toBe('/Game/Maps/zone-map');
    expect(seen!.engine).toBe('5.8');
  });
});
