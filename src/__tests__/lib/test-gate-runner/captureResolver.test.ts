import { describe, it, expect } from 'vitest';
import { makeUeCaptureResolver } from '@/lib/test-gate-runner/captureResolver';
import type { GateJob } from '@/lib/test-gate-runner/types';
import type { CaptureScenarioFrameOptions } from '@/lib/ue-launch/capture';

const job = (over: Partial<GateJob> = {}): GateJob =>
  ({ catalogId: 'zone-map', entityId: 'e1', step: 'verify', tier: 'L4', ...over } as GateJob);

describe('makeUeCaptureResolver', () => {
  it('captures via captureScenarioFrame and returns its path', async () => {
    let seen: CaptureScenarioFrameOptions | null = null;
    const resolve = makeUeCaptureResolver(
      { uproject: 'C:/p/PoF.uproject' },
      { capture: async (o) => { seen = o; return 'C:/out/shot_00.png'; } },
    );
    const out = await resolve(job());
    expect(out).toBe('C:/out/shot_00.png');
    expect(seen!.uproject).toBe('C:/p/PoF.uproject');
  });

  it('uses mapFor(job) and passes the engine', async () => {
    let seen: CaptureScenarioFrameOptions | null = null;
    const resolve = makeUeCaptureResolver(
      { uproject: 'C:/p/PoF.uproject', engine: '5.8', mapFor: (j) => `/Game/Maps/${j.catalogId}` },
      { capture: async (o) => { seen = o; return null; } },
    );
    const out = await resolve(job({ catalogId: 'combat-map' }));
    expect(out).toBeNull();
    expect(seen!.map).toBe('/Game/Maps/combat-map');
    expect(seen!.engine).toBe('5.8');
  });
});
