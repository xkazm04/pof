import { describe, it, expect } from 'vitest';
import {
  buildAutomationArgs,
  parseAbslogVerdict,
  buildScenarioArgs,
  parseScenarioVerdict,
  makeSpawnExecutor,
} from '@/lib/test-gate-runner/spawnExecutor';

describe('buildAutomationArgs', () => {
  it('runs one automation test headlessly with a unique abslog (matches the project invocation)', () => {
    const args = buildAutomationArgs('VSFooTest', 'C:/p/PoF.uproject', 'C:/tmp/g.log');
    expect(args[0]).toBe('C:/p/PoF.uproject');
    expect(args).toContain('-ExecCmds=Automation RunTests VSFooTest;Quit');
    expect(args).toContain('-nullrhi');
    expect(args).toContain('-unattended');
    expect(args).toContain('-nopause');
    expect(args).toContain('-log');
    expect(args).toContain('-abslog=C:/tmp/g.log');
  });
});

describe('parseAbslogVerdict', () => {
  it('passes on the gate marker', () => {
    expect(parseAbslogVerdict('… [gate] RESULT=PASS …').status).toBe('pass');
  });
  it('passes on the automation success marker', () => {
    expect(parseAbslogVerdict('Test Completed. Result={Success}').status).toBe('pass');
  });
  it('fails on explicit fail markers (real UE marker is Result={Failure})', () => {
    expect(parseAbslogVerdict('[gate] RESULT=FAIL').status).toBe('fail');
    expect(parseAbslogVerdict('LogAutomationController: ... Result={Failure}').status).toBe('fail');
    expect(parseAbslogVerdict('Result={Fail}').status).toBe('fail'); // tolerate the short form too
  });
  it('fails when no success marker is present (crashed/aborted run)', () => {
    expect(parseAbslogVerdict('some unrelated log with no verdict').status).toBe('fail');
  });
});

describe('buildScenarioArgs', () => {
  it('opens the map in -game and arms the controller via -PoFScenario, headless', () => {
    const args = buildScenarioArgs('C:/p/PoF.uproject', '/Game/Maps/TestHarness', 'C:/tmp/scn.json', 'C:/tmp/e.log');
    expect(args[0]).toBe('C:/p/PoF.uproject');
    expect(args).toContain('/Game/Maps/TestHarness');
    expect(args).toContain('-game');
    expect(args).toContain('-PoFScenario=C:/tmp/scn.json');
    expect(args).toContain('-nullrhi');
    expect(args).toContain('-abslog=C:/tmp/e.log');
  });
});

// Real calibration samples: the walking Manny (arms swing, travels) vs the T-posing
// player (arm-droop constant, stalls). The gate's discriminator must separate them.
const WALKING = {
  started: true,
  samples: [
    { t: 0.5, loc_x: 0, loc_y: 69, loc_z: 90, speed: 600, droopL: 65, droopR: 28 },
    { t: 1.0, loc_x: 0, loc_y: 370, loc_z: 90, speed: 600, droopL: 60, droopR: -2 },
    { t: 1.5, loc_x: 0, loc_y: 672, loc_z: 90, speed: 600, droopL: 34, droopR: 65 },
    { t: 2.0, loc_x: 0, loc_y: 973, loc_z: 90, speed: 600, droopL: 14, droopR: 67 },
  ],
};
const TPOSE_STUCK = {
  started: true,
  samples: [
    { t: 0.5, loc_x: 0, loc_y: 69, loc_z: 90, speed: 600, droopL: 54.8, droopR: 54.8 },
    { t: 1.0, loc_x: 0, loc_y: 366, loc_z: 90, speed: 0, droopL: 54.8, droopR: 54.8 },
    { t: 1.5, loc_x: 0, loc_y: 366, loc_z: 90, speed: 0, droopL: 54.8, droopR: 54.8 },
    { t: 2.0, loc_x: 0, loc_y: 366, loc_z: 90, speed: 0, droopL: 54.8, droopR: 54.8 },
  ],
};

describe('parseScenarioVerdict', () => {
  it('passes animated+moved for a real walk cycle (known-good calibration)', () => {
    expect(parseScenarioVerdict(WALKING, [{ kind: 'animated' }, { kind: 'moved' }]).status).toBe('pass');
  });
  it('fails animated for a static / T-pose (known-bad calibration)', () => {
    const v = parseScenarioVerdict(TPOSE_STUCK, [{ kind: 'animated' }]);
    expect(v.status).toBe('fail');
    expect(v.detail).toMatch(/arm-swing/);
  });
  it('static assertion separates the two (passes T-pose, fails walk)', () => {
    expect(parseScenarioVerdict(TPOSE_STUCK, [{ kind: 'static' }]).status).toBe('pass');
    expect(parseScenarioVerdict(WALKING, [{ kind: 'static' }]).status).toBe('fail');
  });
  it('honors custom thresholds', () => {
    expect(parseScenarioVerdict(WALKING, [{ kind: 'animated', minSwingDeg: 100 }]).status).toBe('fail');
    expect(parseScenarioVerdict(WALKING, [{ kind: 'moved', minDist: 5000 }]).status).toBe('fail');
  });
  it('fails when the scenario never started / no samples', () => {
    expect(parseScenarioVerdict({ started: false, samples: [] }, [{ kind: 'animated' }]).status).toBe('fail');
    expect(parseScenarioVerdict({ samples: [] }, [{ kind: 'moved' }]).status).toBe('fail');
  });
});

describe('makeSpawnExecutor', () => {
  it('is tier L3 and unavailable unless explicitly enabled + configured', async () => {
    const ex = makeSpawnExecutor({ editorCmd: 'x', uproject: 'y' }); // allowSpawn omitted
    expect(ex.tier).toBe('L3');
    expect(await ex.available()).toBe(false);
  });
  it('reports available when allowSpawn + paths are set', async () => {
    const ex = makeSpawnExecutor({ allowSpawn: true, editorCmd: 'x', uproject: 'y' });
    expect(await ex.available()).toBe(true);
  });
  it('refuses to run while disabled', async () => {
    const ex = makeSpawnExecutor({ editorCmd: 'x', uproject: 'y' });
    await expect(ex.run({ catalogId: 'c', entityId: 'e', step: 's', tier: 'L3', testName: 'T' })).rejects.toThrow(/disabled/);
  });
});
