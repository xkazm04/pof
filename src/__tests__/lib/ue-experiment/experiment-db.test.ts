import { describe, it, expect, afterEach } from 'vitest';
import { saveExperimentRun, listExperimentRuns, getExperimentRun, deleteExperimentRun, labelForSpec } from '@/lib/ue-experiment/experiment-db';
import type { ExperimentResult, ExperimentSpec } from '@/lib/ue-experiment/runner';

const ids: string[] = [];
afterEach(() => { for (const id of ids.splice(0)) deleteExperimentRun(id); });

function save(id: string, spec: ExperimentSpec, result: Partial<ExperimentResult>): void {
  ids.push(id);
  saveExperimentRun({ id, createdAt: '2026-06-19T00:00:00.000Z', spec, result: { ok: true, logs: [], markers: {}, durationMs: 1, binary: 'b', args: [], ...result } });
}

describe('labelForSpec', () => {
  it('summarizes python and scenario specs', () => {
    expect(labelForSpec({ python: "unreal.log('x')\nmore" })).toContain("unreal.log('x')");
    expect(labelForSpec({ python: '', scenario: { map: '/Game/M', assert: [{ kind: 'moved' }] } })).toMatch(/scenario.*\/Game\/M/);
  });
});

describe('experiment run persistence', () => {
  it('saves, lists, gets, and deletes a run', () => {
    const id = `test-exp-${Date.now()}`;
    save(id, { python: "unreal.log('hi')", capture: true }, { markers: { RESULT: '5.8.0' }, screenshotPath: 'C:/x.png' });

    const got = getExperimentRun(id);
    expect(got?.id).toBe(id);
    expect(got?.mode).toBe('python');
    expect(got?.markers.RESULT).toBe('5.8.0');
    expect(got?.hasScreenshot).toBe(true);

    expect(listExperimentRuns(50).some((r) => r.id === id)).toBe(true);

    expect(deleteExperimentRun(id)).toBe(true);
    ids.length = 0; // already deleted
    expect(getExperimentRun(id)).toBeNull();
  });

  it('stores scenario observation summary + behavioral verdict', () => {
    const id = `test-exp-scn-${Date.now()}`;
    save(id, { python: '', scenario: { map: '/m' } }, {
      observationSummary: { sampleCount: 8, maxSpeed: 0, maxAnimSpeed: 0, displacement: 65, montagePlayed: false },
      behavioralVerdict: { status: 'pass', detail: 'dist=65' },
    });
    const got = getExperimentRun(id);
    expect(got?.mode).toBe('scenario');
    expect(got?.observationSummary?.displacement).toBe(65);
    expect(got?.behavioralVerdict?.status).toBe('pass');
  });
});
