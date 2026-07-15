import { describe, it, expect } from 'vitest';
import {
  buildAutomationArgs,
  parseAbslogVerdict,
  buildScenarioArgs,
  parseScenarioVerdict,
  scenarioInboxFor,
  makeSpawnExecutor,
} from '@/lib/test-gate-runner/spawnExecutor';
import type { GateScenario } from '@/lib/test-gate-runner/types';

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
  it('classifies a zero-match run as unregistered (planned test), NOT a failure', () => {
    // Ground truth from the 2026-07 sweep: the controller lists its set, matches nothing, exits.
    const log = 'LogAutomationController: 8621 tests available on 6A9A…\nLogExit: Exiting.';
    const v = parseAbslogVerdict(log);
    expect(v.status).toBe('unregistered');
    expect(v.detail).toMatch(/planned, not registered/);
  });
  it('a zero-match run that ALSO crashed still fails', () => {
    const log = '8621 tests available\nFatal error!';
    expect(parseAbslogVerdict(log).status).toBe('fail');
  });
  it('a completed test with a verdict is never unregistered', () => {
    expect(parseAbslogVerdict('10 tests available\nTest Completed. Result={Success}').status).toBe('pass');
    expect(parseAbslogVerdict('10 tests available\nTest Completed. Result={Failure}').status).toBe('fail');
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

// A spell cast: a montage plays and mana drops 50→30. vs nothing happening.
const FIREBALL_CAST = {
  started: true,
  samples: [
    { t: 0.3, loc_x: 0, loc_y: 0, loc_z: 90, speed: 0, droopL: 55, droopR: 55, montage_playing: false, mana: 50 },
    { t: 0.7, loc_x: 0, loc_y: 0, loc_z: 90, speed: 0, droopL: 55, droopR: 55, montage_playing: true, mana: 30 },
    { t: 1.1, loc_x: 0, loc_y: 0, loc_z: 90, speed: 0, droopL: 55, droopR: 55, montage_playing: true, mana: 30 },
    { t: 1.5, loc_x: 0, loc_y: 0, loc_z: 90, speed: 0, droopL: 55, droopR: 55, montage_playing: false, mana: 30 },
  ],
};
const NO_CAST = {
  started: true,
  samples: [
    { t: 0.3, loc_x: 0, loc_y: 0, loc_z: 90, speed: 0, droopL: 55, droopR: 55, montage_playing: false, mana: 50 },
    { t: 0.7, loc_x: 0, loc_y: 0, loc_z: 90, speed: 0, droopL: 55, droopR: 55, montage_playing: false, mana: 50 },
  ],
};

describe('parseScenarioVerdict — GAS/ability assertions', () => {
  it('ability-activated passes on a cast (montage + mana drop), fails when nothing happens', () => {
    expect(parseScenarioVerdict(FIREBALL_CAST, [{ kind: 'ability-activated' }]).status).toBe('pass');
    const v = parseScenarioVerdict(NO_CAST, [{ kind: 'ability-activated' }]);
    expect(v.status).toBe('fail');
    expect(v.detail).toMatch(/no montage and no resource/);
  });
  it('montage-playing requires a montage in ≥1 sample', () => {
    expect(parseScenarioVerdict(FIREBALL_CAST, [{ kind: 'montage-playing' }]).status).toBe('pass');
    expect(parseScenarioVerdict(NO_CAST, [{ kind: 'montage-playing' }]).status).toBe('fail');
  });
  it('attribute-drop measures the resource dip (mana 50→30 = 20)', () => {
    expect(parseScenarioVerdict(FIREBALL_CAST, [{ kind: 'attribute-drop', name: 'mana', minDelta: 10 }]).status).toBe('pass');
    expect(parseScenarioVerdict(FIREBALL_CAST, [{ kind: 'attribute-drop', name: 'mana', minDelta: 25 }]).status).toBe('fail');
    expect(parseScenarioVerdict(NO_CAST, [{ kind: 'attribute-drop', name: 'mana' }]).status).toBe('fail');
  });
});

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

  it('surfaces structured stats (evidence) alongside the verdict', () => {
    const v = parseScenarioVerdict(WALKING, [{ kind: 'animated' }, { kind: 'moved' }]);
    expect(v.stats).toBeDefined();
    expect(v.stats!.sampleCount).toBe(4);
    expect(v.stats!.distance).toBeGreaterThan(50);
    expect(v.stats!.swingDeg).toBeGreaterThan(10);
    // Stats accompany a fail verdict too (the proof of WHY it failed).
    expect(parseScenarioVerdict(TPOSE_STUCK, [{ kind: 'animated' }]).stats!.swingDeg).toBeCloseTo(0, 1);
    // A cast records montage seen.
    expect(parseScenarioVerdict(FIREBALL_CAST, [{ kind: 'montage-playing' }]).stats!.montagePlaying).toBe(1);
  });
});

// A knockback-onto-a-ledge: the pawn lifts off the ground plane (loc_z rises 90→300→300) and
// ends elevated while barely moving horizontally — the exact net displacement 2D hypot can't see.
const JUMP = {
  started: true,
  samples: [
    { t: 0.2, loc_x: 0, loc_y: 0, loc_z: 90, speed: 0, droopL: 55, droopR: 55 },
    { t: 0.5, loc_x: 0, loc_y: 10, loc_z: 300, speed: 420, droopL: 55, droopR: 55 },
    { t: 0.8, loc_x: 0, loc_y: 20, loc_z: 300, speed: 60, droopL: 55, droopR: 55 },
  ],
};
// A cast whose ability tag was blind-PascalCased WRONG: the ASC reports ability_found:false.
const WRONG_TAG_CAST = {
  started: true,
  samples: [
    { t: 0.3, loc_x: 0, loc_y: 0, loc_z: 90, speed: 0, droopL: 55, droopR: 55, montage_playing: false, mana: 50, ability_found: false },
    { t: 0.7, loc_x: 0, loc_y: 0, loc_z: 90, speed: 0, droopL: 55, droopR: 55, montage_playing: false, mana: 50, ability_found: false },
  ],
};

describe('parseScenarioVerdict — 3D displacement / speed / vertical (Direction 1)', () => {
  it('surfaces 2D + 3D distance, peak speed, and vertical rise as stats', () => {
    const v = parseScenarioVerdict(WALKING, [{ kind: 'moved' }]);
    expect(v.stats!.distance).toBeGreaterThan(50);
    expect(v.stats!.distance3d).toBeCloseTo(v.stats!.distance, 1); // flat walk → 3D≈2D
    expect(v.stats!.peakSpeed).toBe(600);
    expect(v.stats!.verticalRise).toBeCloseTo(0, 1);
  });

  it('3D displacement sees a jump that 2D misses', () => {
    const v = parseScenarioVerdict(JUMP, [{ kind: 'moved', in3D: true, minDist: 100 }]);
    // 2D barely moved (~20), so a 2D `moved` would FAIL; 3D includes the 210u lift → passes.
    expect(v.stats!.distance).toBeLessThan(50);
    expect(v.stats!.distance3d).toBeGreaterThan(100);
    expect(v.status).toBe('pass');
    expect(parseScenarioVerdict(JUMP, [{ kind: 'moved', minDist: 100 }]).status).toBe('fail'); // 2D default
  });

  it('moved in3D falls back to 2D with a note when loc_z is absent', () => {
    const flat2d = { started: true, samples: [
      { t: 0, loc_x: 0, loc_y: 0, droopL: 55, droopR: 55 },
      { t: 1, loc_x: 0, loc_y: 20, droopL: 55, droopR: 55 },
    ] } as unknown as Parameters<typeof parseScenarioVerdict>[0];
    const v = parseScenarioVerdict(flat2d, [{ kind: 'moved', in3D: true, minDist: 100 }]);
    expect(v.status).toBe('fail');
    expect(v.detail).toMatch(/2D — loc_z absent/);
  });

  it('min-speed gates on peak observed speed', () => {
    expect(parseScenarioVerdict(WALKING, [{ kind: 'min-speed', minSpeed: 300 }]).status).toBe('pass');
    // NO_CAST has speed:0 throughout → peak 0 < 300 → fails (a stalled pawn never reached speed).
    expect(parseScenarioVerdict(NO_CAST, [{ kind: 'min-speed', minSpeed: 300 }]).status).toBe('fail');
  });

  it('vertical-displacement sees the lift of a jump, and reports honestly when loc_z is missing', () => {
    expect(parseScenarioVerdict(JUMP, [{ kind: 'vertical-displacement', minRise: 100 }]).status).toBe('pass');
    expect(parseScenarioVerdict(WALKING, [{ kind: 'vertical-displacement', minRise: 100 }]).status).toBe('fail');
    const noZ = { started: true, samples: [{ t: 0, loc_x: 0, loc_y: 0, droopL: 1, droopR: 1 }] } as unknown as Parameters<typeof parseScenarioVerdict>[0];
    const v = parseScenarioVerdict(noZ, [{ kind: 'vertical-displacement' }]);
    expect(v.status).toBe('fail');
    expect(v.detail).toMatch(/loc_z not observed/);
  });
});

describe('parseScenarioVerdict — loud ability-tag mismatch (Direction 1)', () => {
  it('reports an unresolvable tag LOUDLY (distinct from the generic no-effect message)', () => {
    const v = parseScenarioVerdict(WRONG_TAG_CAST, [{ kind: 'ability-activated', tag: 'Ability.Frbal' }]);
    expect(v.status).toBe('fail');
    expect(v.detail).toMatch(/NOT FOUND on pawn ASC/);
    expect(v.detail).toContain('Ability.Frbal');
    expect(v.detail).not.toMatch(/no montage and no resource/);
  });

  it('still reports the generic no-effect message when the tag IS present but nothing fired', () => {
    const v = parseScenarioVerdict(NO_CAST, [{ kind: 'ability-activated', tag: 'Ability.Fireball' }]);
    expect(v.status).toBe('fail');
    expect(v.detail).toMatch(/no montage and no resource/);
  });
});

describe('scenarioInboxFor (Direction 1 — disableAI pass-through)', () => {
  const base: GateScenario = { map: '/Game/Maps/TestHarness', totalSeconds: 3, numSamples: 12, inputs: [], assert: [] };
  it('forwards disableAI onto the inbox options when the spec sets it', () => {
    expect(scenarioInboxFor({ ...base, disableAI: true })).toMatchObject({ disableAI: true, settle: 1.0 });
  });
  it('omits disableAI when the spec does not set it', () => {
    expect(scenarioInboxFor(base).disableAI).toBeUndefined();
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

  // The automation branch now routes through the same watchdog-protected spawnAndWait as the
  // scenario branch (it no longer reimplements a timeout-less inline spawn). Use the node
  // binary as a stand-in editor that exits immediately: spawnAndWait must resolve on exit
  // (well within automationTimeoutMs), then the missing abslog surfaces as a failure.
  it('automation branch spawns via the watchdog and surfaces a missing abslog', async () => {
    const ex = makeSpawnExecutor({
      allowSpawn: true,
      editorCmd: process.execPath,
      uproject: '/nonexistent/PoF.uproject',
      automationTimeoutMs: 5_000,
    });
    await expect(
      ex.run({ catalogId: 'c', entityId: 'e', step: 's', tier: 'L3', testName: 'VSFooTest' }),
    ).rejects.toThrow(/no abslog produced/);
  });
});
