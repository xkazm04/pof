import { describe, it, expect } from 'vitest';
import {
  buildPerfCaptureLaunchArgs,
  buildPerfCapturePlan,
  buildScenarioLaunchArgs,
  buildScenarioInbox,
  PERF_CAPTURE_EVENTS,
  PERF_CAPTURE_SLACK_FRAMES,
  SCENARIO_FIXED_FPS,
  type ScenarioLaunchArgsOptions,
} from '@/types/observation';

const NULLRHI: ScenarioLaunchArgsOptions = {
  uproject: 'C:/p/PoF.uproject',
  map: '/Game/Maps/TestHarness',
  scenarioPath: 'C:/tmp/scn.json',
  render: { mode: 'nullrhi', abslog: 'C:/tmp/e.log' },
};

describe('perf-capture plan', () => {
  it('derives the baseline phase from settle and the window from totalSeconds, at the fixed step', () => {
    const plan = buildPerfCapturePlan({ settle: 1, totalSeconds: 10 });
    expect(plan).toEqual({
      fps: SCENARIO_FIXED_FPS,
      baselineFrames: 60,
      windowFrames: 600,
      captureFrameCap: 60 + 600 + PERF_CAPTURE_SLACK_FRAMES,
    });
  });

  it('falls back to the inbox defaults, the same numbers buildScenarioInbox writes', () => {
    const inbox = JSON.parse(buildScenarioInbox('o'));
    const plan = buildPerfCapturePlan({});
    expect(plan.baselineFrames).toBe(Math.round(inbox.settle * SCENARIO_FIXED_FPS));
    expect(plan.windowFrames).toBe(Math.round(inbox.total_seconds * SCENARIO_FIXED_FPS));
  });

  it('refuses a window that covers no frame, and honors explicit slack', () => {
    expect(() => buildPerfCapturePlan({ totalSeconds: 0 })).toThrow(RangeError);
    expect(buildPerfCapturePlan({ settle: 0, totalSeconds: 1 }, 0).captureFrameCap).toBe(60);
  });
});

describe('perf-capture launch args', () => {
  const plan = buildPerfCapturePlan({ settle: 1, totalSeconds: 10 });

  it('is the scenario launch verbatim (same fixed timestep) plus CSV Profiler bracketing', () => {
    const scenario = buildScenarioLaunchArgs(NULLRHI);
    const args = buildPerfCaptureLaunchArgs({ ...NULLRHI, plan });
    expect(args.slice(0, scenario.length)).toEqual(scenario);
    expect(args.slice(scenario.length)).toEqual([
      `-csvStartOnEvent=${PERF_CAPTURE_EVENTS.baselineStart}`,
      `-csvStopOnEvent=${PERF_CAPTURE_EVENTS.windowEnd}`,
      `-csvCaptureOnEventFrameCount=${plan.captureFrameCap}`,
    ]);
    for (const flag of ['-benchmark', `-fps=${SCENARIO_FIXED_FPS}`, '-nullrhi']) expect(args).toContain(flag);
  });

  it('carries the offscreen render mode through unchanged', () => {
    const render = { mode: 'offscreen', resX: 1280, resY: 720 } as const;
    const args = buildPerfCaptureLaunchArgs({ ...NULLRHI, render, plan });
    expect(args).toContain('-RenderOffScreen');
    expect(args).not.toContain('-nullrhi');
  });

  it('is a separate boot: the L3 scenario args gain no capture flag', () => {
    expect(buildScenarioLaunchArgs(NULLRHI).some((a) => a.toLowerCase().includes('csv'))).toBe(false);
  });

  it('names three distinct events, so baseline, window start and window end cannot collide', () => {
    expect(new Set(Object.values(PERF_CAPTURE_EVENTS)).size).toBe(3);
  });
});
