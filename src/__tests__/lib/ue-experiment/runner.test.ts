import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  buildExperimentProbe,
  buildExperimentArgs,
  parseExperimentLog,
  summarizeObservations,
  runExperiment,
} from '@/lib/ue-experiment/runner';

const ABSLOG_RE = /^-abslog=(.*)$/;
const ENV = { POF_UE_UPROJECT: 'C:/p/PoF.uproject' };

describe('buildExperimentProbe', () => {
  it('wraps the user python in try/except with a DONE marker', () => {
    const probe = buildExperimentProbe("unreal.log('hi')");
    expect(probe).toContain("unreal.log('hi')");
    expect(probe).toMatch(/try:/);
    expect(probe).toContain("POF_EXPERIMENT_DONE=ok");
    expect(probe).toMatch(/except Exception/);
    expect(probe).toContain('POF_EXPERIMENT_ERROR');
  });

  it('adds a screenshot call only when a capture path is given', () => {
    expect(buildExperimentProbe("pass")).not.toContain('take_high_res_screenshot');
    const withCap = buildExperimentProbe('pass', { capturePath: 'C:/tmp/shot.png', resX: 800, resY: 600 });
    expect(withCap).toContain("take_high_res_screenshot(800, 600, 'C:/tmp/shot.png')");
  });
});

describe('buildExperimentArgs', () => {
  const base = { uproject: 'C:/p/PoF.uproject', probePath: 'C:/tmp/probe.py', abslog: 'C:/tmp/x.log' };

  it('non-capture run is headless (-nullrhi), with plugins + python exec + abslog', () => {
    const args = buildExperimentArgs({ ...base, capture: false });
    expect(args).toContain('-nullrhi');
    expect(args).not.toContain('-RenderOffScreen');
    expect(args).toContain('-EnablePlugins=PythonScriptPlugin');
    expect(args.some((a) => a.startsWith("-ExecCmds=py exec(open('C:/tmp/probe.py')"))).toBe(true);
    expect(args).toContain('-abslog=C:/tmp/x.log');
  });

  it('capture run renders (-RenderOffScreen, no -nullrhi)', () => {
    const args = buildExperimentArgs({ ...base, capture: true });
    expect(args).toContain('-RenderOffScreen');
    expect(args).not.toContain('-nullrhi');
  });
});

describe('parseExperimentLog', () => {
  it('pulls KEY=VALUE markers from LogPython lines and ignores the echoed command line', () => {
    const log = [
      "[2026.06.19] LogInit: Command line: ... -ExecCmds=py ... RESULT=should_be_ignored",
      '[2026.06.19] LogPython: RESULT=5.8.0',
      '[2026.06.19] LogPython: POF_EXPERIMENT_DONE=ok',
    ].join('\n');
    const r = parseExperimentLog(log);
    expect(r.markers.RESULT).toBe('5.8.0');
    expect(r.markers.RESULT).not.toBe('should_be_ignored');
    expect(r.ok).toBe(true);
    expect(r.error).toBeUndefined();
    expect(r.logs).toContain('RESULT=5.8.0');
  });

  it('reports ok=false + error when the probe raised', () => {
    const log = "[x] LogPython: POF_EXPERIMENT_ERROR=AttributeError('no such api')";
    const r = parseExperimentLog(log);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/AttributeError/);
  });
});

describe('runExperiment (orchestration, deps-seam)', () => {
  it('runs, parses markers, captures, and verifies — no real editor', async () => {
    const run = async (_b: string, args: string[]) => {
      const abslog = args.map((a) => a.match(ABSLOG_RE)?.[1]).find(Boolean)!;
      writeFileSync(abslog, '[x] LogPython: RESULT=5.8.0\n[x] LogPython: POF_EXPERIMENT_DONE=ok\n');
    };
    const res = await runExperiment(
      { python: "unreal.log('hi')", capture: true, verify: { prompt: 'looks right?' } },
      { run, fileExists: () => true, verifyVisual: async () => ({ status: 'pass', detail: 'ok' }), env: ENV, now: () => 1 },
    );
    expect(res.ok).toBe(true);
    expect(res.markers.RESULT).toBe('5.8.0');
    expect(res.screenshotPath).toBeTruthy();
    expect(res.verdict?.status).toBe('pass');
    expect(res.args).toContain('-RenderOffScreen');
  });

  it('errors cleanly when the UE editor binary is missing', async () => {
    const res = await runExperiment(
      { python: 'pass' },
      { run: async () => {}, fileExists: () => false, env: ENV },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/UE editor not found/);
  });

  it('errors when no uproject is configured', async () => {
    const res = await runExperiment({ python: 'pass' }, { run: async () => {}, env: {} });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/POF_UE_UPROJECT/);
  });
});

describe('summarizeObservations', () => {
  it('summarizes speed / displacement / montage from samples', () => {
    const s = summarizeObservations([
      { t: 0, loc_x: 0, loc_y: 0, speed: 0 },
      { t: 1, loc_x: 3, loc_y: 4, speed: 300, anim_speed: 5, montage_playing: true },
    ]);
    expect(s.sampleCount).toBe(2);
    expect(s.maxSpeed).toBe(300);
    expect(s.displacement).toBeCloseTo(5); // sqrt(3^2 + 4^2)
    expect(s.montagePlayed).toBe(true);
  });

  it('handles no samples', () => {
    expect(summarizeObservations([]).sampleCount).toBe(0);
  });
});

describe('runExperiment scenario mode', () => {
  const scnRun = (obs: unknown, shot = 'shot_01.png') => async (_b: string, args: string[]) => {
    const inbox = args.map((a) => a.match(/^-PoFScenario=(.*)$/)?.[1]).find(Boolean)!;
    const dir = dirname(inbox);
    writeFileSync(join(dir, 'observations.json'), JSON.stringify(obs));
    writeFileSync(join(dir, shot), 'PNG');
  };

  it('drives a scenario, summarizes observations + picks the action frame', async () => {
    const res = await runExperiment(
      { python: '', scenario: { map: '/Game/Maps/VerticalSlice', inputs: [{ key: 'W', start: 0, duration: 2 }] } },
      { run: scnRun({ samples: [{ t: 0, speed: 0 }, { t: 1, speed: 300, anim_speed: 5, montage_playing: true }] }), fileExists: () => true, env: ENV, now: () => 1 },
    );
    expect(res.observationSummary?.maxSpeed).toBe(300);
    expect(res.observationSummary?.montagePlayed).toBe(true);
    expect(res.screenshotPath).toMatch(/shot_01\.png/);
    expect(res.ok).toBe(true);
  });

  it('applies behavioral assertions (pass when moved far enough)', async () => {
    const obs = { started: true, samples: [{ t: 0, loc_x: 0, loc_y: 0, droopL: 60, droopR: 60 }, { t: 1, loc_x: 100, loc_y: 0, droopL: 80, droopR: 80 }] };
    const res = await runExperiment(
      { python: '', scenario: { map: '/m', inputs: [{ key: 'W', start: 0, duration: 1 }], assert: [{ kind: 'moved', minDist: 50 }] } },
      { run: scnRun(obs, 'shot_00.png'), fileExists: () => true, env: ENV, now: () => 1 },
    );
    expect(res.behavioralVerdict?.status).toBe('pass');
  });

  it('behavioral assertion fails when the metric is not met', async () => {
    const obs = { started: true, samples: [{ t: 0, loc_x: 0, loc_y: 0, droopL: 60, droopR: 60 }, { t: 1, loc_x: 10, loc_y: 0, droopL: 60, droopR: 60 }] };
    const res = await runExperiment(
      { python: '', scenario: { map: '/m', inputs: [{ key: 'W', start: 0, duration: 1 }], assert: [{ kind: 'moved', minDist: 200 }] } },
      { run: scnRun(obs, 'shot_00.png'), fileExists: () => true, env: ENV, now: () => 1 },
    );
    expect(res.behavioralVerdict?.status).toBe('fail');
    expect(res.behavioralVerdict?.detail).toMatch(/moved/);
  });
});
