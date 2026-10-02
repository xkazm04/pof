/**
 * Transpiler runs are bound to the input they were computed from.
 *
 * The hook used to hold four nullable results, one isLoading and one error with
 * no memory of which Blueprint produced them: edit the JSON after a transpile and
 * the old header stayed on screen, ready for Write to Project. The run-state
 * reducer stamps every run with the fingerprint of its inputs, so a result is
 * recognisably stale, a late reply for a superseded request is dropped, and each
 * action owns its own error.
 */
import { describe, it, expect } from 'vitest';
import {
  initialRunState, runReducer, selectRun, transpileKey, diffKey,
  type RunState, type RunEvent,
} from '@/lib/blueprint-transpiler/run-state';
import type { TranspileResponse } from '@/types/blueprint';

const JSON_A = '{"ClassName":"BP_A"}';
const JSON_B = '{"ClassName":"BP_B"}';

const R1 = { className: 'AA', headerCode: '// A', summary: 'A' } as unknown as TranspileResponse;
const R2 = { className: 'AA2', headerCode: '// A2', summary: 'A2' } as unknown as TranspileResponse;

function play(state: RunState, ...events: RunEvent[]): RunState {
  return events.reduce(runReducer, state);
}

describe('run-state — a result carries the fingerprint of its input', () => {
  it('a transpile result goes stale when the Blueprint JSON changes', () => {
    const k = transpileKey(JSON_A, 'MyGame');
    const s = play(
      initialRunState({ blueprintJson: JSON_A, moduleName: 'MyGame' }),
      { type: 'started', action: 'transpile', key: k },
      { type: 'succeeded', action: 'transpile', key: k, result: R1 },
      { type: 'inputChanged', patch: { blueprintJson: JSON_B } },
    );
    const run = selectRun(s, 'transpile');
    expect(run.result).toBe(R1);
    expect(run.stale).toBe(true);
    expect(run.staleBecause).toEqual(['blueprintJson']);
  });

  it('changing the JSON back makes it fresh again (fingerprint equality, not a dirty flag)', () => {
    const k = transpileKey(JSON_A, 'MyGame');
    const s = play(
      initialRunState({ blueprintJson: JSON_A, moduleName: 'MyGame' }),
      { type: 'started', action: 'transpile', key: k },
      { type: 'succeeded', action: 'transpile', key: k, result: R1 },
      { type: 'inputChanged', patch: { blueprintJson: JSON_B } },
      { type: 'inputChanged', patch: { blueprintJson: JSON_A } },
    );
    expect(selectRun(s, 'transpile').stale).toBe(false);
    expect(selectRun(s, 'transpile').result).toBe(R1);
  });

  it('out-of-order replies: the last request wins, a superseded reply is dropped', () => {
    const k1 = transpileKey(JSON_A, 'MyGame');
    const k2 = transpileKey(JSON_A, 'Other');
    let s = play(
      initialRunState({ blueprintJson: JSON_A, moduleName: 'Other' }),
      { type: 'started', action: 'transpile', key: k1 },
      { type: 'started', action: 'transpile', key: k2 },
      { type: 'succeeded', action: 'transpile', key: k1, result: R1 },
    );
    expect(selectRun(s, 'transpile')).toMatchObject({ running: true, result: null });

    s = runReducer(s, { type: 'succeeded', action: 'transpile', key: k2, result: R2 });
    expect(selectRun(s, 'transpile')).toMatchObject({ running: false, result: R2, stale: false });
  });

  it('errors are per action, not one shared string', () => {
    const k = diffKey(JSON_A, 'class A {};');
    const s = play(
      initialRunState({ blueprintJson: JSON_A, existingCpp: 'class A {};' }),
      { type: 'started', action: 'diff', key: k },
      { type: 'failed', action: 'diff', key: k, error: 'bad C++' },
    );
    expect(selectRun(s, 'diff').error).toBe('bad C++');
    expect(selectRun(s, 'transpile').error).toBeNull();
  });
});
