import { describe, it, expect } from 'vitest';
import { makeUeCaptureResolver } from '@/lib/test-gate-runner/captureResolver';
import type { GateJob } from '@/lib/test-gate-runner/types';
import type { CaptureFrameOptions } from '@/lib/ue-launch/capture';

const job = (over: Partial<GateJob> = {}): GateJob =>
  ({ catalogId: 'zone-map', entityId: 'e1', step: 'verify', tier: 'L4', ...over } as GateJob);

describe('makeUeCaptureResolver', () => {
  it('captures via captureFrame and returns its path', async () => {
    let seen: CaptureFrameOptions | null = null;
    const resolve = makeUeCaptureResolver(
      { uproject: 'C:/p/PoF.uproject' },
      { capture: async (o) => { seen = o; return 'C:/shots/a.png'; } },
    );
    const out = await resolve(job());
    expect(out).toBe('C:/shots/a.png');
    expect(seen!.uproject).toBe('C:/p/PoF.uproject');
  });

  it('passes the engine through and surfaces a null capture', async () => {
    let seen: CaptureFrameOptions | null = null;
    const resolve = makeUeCaptureResolver(
      { uproject: 'C:/p/PoF.uproject', engine: '5.8' },
      { capture: async (o) => { seen = o; return null; } },
    );
    const out = await resolve(job({ catalogId: 'combat-map' }));
    expect(out).toBeNull();
    expect(seen!.engine).toBe('5.8');
  });
});
