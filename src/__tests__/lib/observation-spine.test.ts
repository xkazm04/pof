import { describe, it, expect } from 'vitest';
import {
  buildScenarioLaunchArgs,
  buildScenarioInbox,
  buildRuntimeDeferredReason,
  parseRuntimeDeferredTestName,
  mapScenarioInputs,
  RUNTIME_DEFERRED_PREFIX,
} from '@/types/observation';
import { buildScenarioArgs as spawnScenarioArgs } from '@/lib/test-gate-runner/spawnExecutor';
import { buildScenarioArgs as captureScenarioArgs, buildScenarioInbox as captureInbox } from '@/lib/ue-launch/capture';
import { parseTestName } from '@/lib/test-gate-runner/parse';

// The spine is the ONE contract. These tests fail if a launch path ever drifts from it.
describe('observation spine — buildScenarioLaunchArgs', () => {
  it('nullrhi (L3) form matches the spawn path exactly', () => {
    const spine = buildScenarioLaunchArgs({ uproject: 'C:/p/PoF.uproject', map: '/Game/Maps/TestHarness', scenarioPath: 'C:/tmp/scn.json', render: { mode: 'nullrhi', abslog: 'C:/tmp/e.log' } });
    expect(spine).toEqual(spawnScenarioArgs('C:/p/PoF.uproject', '/Game/Maps/TestHarness', 'C:/tmp/scn.json', 'C:/tmp/e.log'));
    expect(spine).toContain('-nullrhi');
    expect(spine).toContain('-abslog=C:/tmp/e.log');
    expect(spine).not.toContain('-RenderOffScreen');
  });

  it('offscreen (L4) form matches the capture path exactly', () => {
    const spine = buildScenarioLaunchArgs({ uproject: 'C:/p/PoF.uproject', map: '/Game/Maps/VerticalSlice', scenarioPath: 'C:/t/inbox.json', render: { mode: 'offscreen', resX: 1280, resY: 720 } });
    expect(spine).toEqual(captureScenarioArgs({ uproject: 'C:/p/PoF.uproject', map: '/Game/Maps/VerticalSlice', inboxPath: 'C:/t/inbox.json', resX: 1280, resY: 720 }));
    expect(spine).toContain('-RenderOffScreen');
    expect(spine).toContain('-ResX=1280');
    expect(spine).not.toContain('-nullrhi');
  });

  it('both forms share the deterministic head + fixed-timestep tail', () => {
    const a = buildScenarioLaunchArgs({ uproject: 'u', map: 'm', scenarioPath: 's', render: { mode: 'nullrhi', abslog: 'l' } });
    expect(a.slice(0, 4)).toEqual(['u', 'm', '-game', '-PoFScenario=s']);
    for (const flag of ['-benchmark', '-fps=60', '-unattended', '-nopause', '-nosplash']) expect(a).toContain(flag);
  });
});

describe('observation spine — buildScenarioInbox', () => {
  it('capture-only default shape (via the capture wrapper too)', () => {
    const inbox = JSON.parse(buildScenarioInbox('C:/t/out'));
    expect(inbox).toMatchObject({ out_dir: 'C:/t/out', total_seconds: 3, num_samples: 1, settle: 1.5, inputs: [] });
    expect(inbox.disable_ai).toBeUndefined();
    expect(JSON.parse(captureInbox('C:/t/out'))).toEqual(inbox); // wrapper delegates
  });

  it('emits play_anim (L3) and disable_ai (L4) only when set, and snake_cases inputs', () => {
    const l3 = JSON.parse(buildScenarioInbox('o', { totalSeconds: 2, numSamples: 5, settle: 1.0, playAnim: '/Game/A', inputs: [{ event: 'activate_ability', eventArg: 'Ability.Fireball', start: 0.5, duration: 0.1 }] }));
    expect(l3.play_anim).toBe('/Game/A');
    expect(l3.disable_ai).toBeUndefined();
    expect(l3.inputs[0]).toMatchObject({ event: 'activate_ability', event_arg: 'Ability.Fireball', start: 0.5, duration: 0.1 });
    expect(JSON.parse(buildScenarioInbox('o', { disableAI: true })).disable_ai).toBe(true);
  });

  it('mapScenarioInputs omits empty optionals', () => {
    expect(mapScenarioInputs([{ start: 0, duration: 1 }])).toEqual([{ start: 0, duration: 1 }]);
  });
});

describe('observation spine — deferred-reason contract (single source)', () => {
  it('round-trips the test name through build → parse', () => {
    const reason = buildRuntimeDeferredReason('VSItemsTest');
    expect(reason).toBe('live-UE runner not yet run: VSItemsTest');
    expect(reason.startsWith(RUNTIME_DEFERRED_PREFIX)).toBe(true);
    expect(parseRuntimeDeferredTestName(reason)).toBe('VSItemsTest');
  });

  it('parse.ts parseTestName delegates to the spine parser', () => {
    expect(parseTestName(buildRuntimeDeferredReason('VSFooTest'))).toBe('VSFooTest');
    expect(parseTestName('unrelated reason')).toBeNull();
    expect(parseRuntimeDeferredTestName(undefined)).toBeNull();
  });
});
