import { describe, it, expect, vi } from 'vitest';
import { drainPythonAll, readDispatch, hasResult, type PythonDrainDeps } from '@/lib/catalog/acceptance/pythonDrain';
import { pythonStepSuccess, pythonStepOk } from '@/lib/catalog/acceptance/pythonStepCheckers';

const ORDER = ['Mesh + Skeleton', 'Import Mixamo Clips', 'IK Rigs', 'Retarget Clips'];
const py = (module: string) => ({ python: { module, function: 'run' } });

function artifact(step: string, module: string, data: Record<string, unknown> = {}) {
  return { catalogId: 'player-movement', entityId: 'player-locomotion-manny', step, status: 'deferred', data: { ...py(module), ...data } };
}

function deps(over: Partial<PythonDrainDeps> = {}): PythonDrainDeps & { saved: { step: string; data: Record<string, unknown> }[] } {
  const saved: { step: string; data: Record<string, unknown> }[] = [];
  return {
    saved,
    listArtifacts: () => [artifact('Import Mixamo Clips', 'player_movement.import_clips')],
    stepOrder: () => ORDER,
    run: async () => ({ ok: true, data: { created: ['a'], skipped: [], failed: [] } }),
    grade: (_c, step, data) => pythonStepSuccess(step, 1)(data),
    save: (_c, _e, step, data) => { saved.push({ step, data }); },
    ...over,
  };
}

describe('readDispatch / hasResult', () => {
  it('reads a well-formed dispatch descriptor', () => {
    expect(readDispatch(py('m'))).toEqual({ module: 'm', function: 'run' });
  });

  it('never invents a dispatch from junk', () => {
    expect(readDispatch({})).toBeNull();
    expect(readDispatch({ python: 'm' })).toBeNull();
    expect(readDispatch({ python: { module: '', function: 'run' } })).toBeNull();
    expect(readDispatch({ python: { module: 'm' } })).toBeNull();
  });

  it('recognises both result envelopes', () => {
    expect(hasResult({ created: [] })).toBe(true);
    expect(hasResult({ ok: false })).toBe(true);
    expect(hasResult(py('m'))).toBe(false);
  });
});

describe('drainPythonAll', () => {
  it('runs the module, merges its return and re-grades to pass', async () => {
    const d = deps();
    const s = await drainPythonAll({}, d);
    expect(s).toMatchObject({ dispatched: 1, passed: 1, failed: 0, errors: 0, changed: 1 });
    expect(s.results[0]).toMatchObject({ outcome: 'drained', from: 'deferred', to: 'pass', changed: true, module: 'player_movement.import_clips' });
    // The dispatch descriptor survives the merge — the step stays re-runnable.
    expect(d.saved[0].data).toMatchObject({ created: ['a'], python: { module: 'player_movement.import_clips' } });
  });

  it('a bridge error writes NOTHING — "could not ask" is not "failed"', async () => {
    const d = deps({ run: async () => ({ ok: false, error: 'ECONNREFUSED localhost:30040' }) });
    const s = await drainPythonAll({}, d);
    expect(s).toMatchObject({ errors: 1, dispatched: 0, changed: 0 });
    expect(s.results[0]).toMatchObject({ outcome: 'bridge-error', from: 'deferred', to: 'deferred', changed: false });
    expect(s.results[0].detail).toContain('ECONNREFUSED');
    expect(d.saved).toHaveLength(0);
  });

  it('reports the module\'s own failure verdict rather than a verdict of its own', async () => {
    const d = deps({ run: async () => ({ ok: true, data: { created: [], skipped: [], failed: ['no source FBX'] } }) });
    const s = await drainPythonAll({}, d);
    expect(s).toMatchObject({ dispatched: 1, passed: 0, failed: 1 });
    expect(s.results[0]).toMatchObject({ outcome: 'drained', to: 'fail' });
    expect(s.results[0].detail).toContain('no source FBX');
  });

  it('skips a step that declares no python module', async () => {
    const d = deps({ listArtifacts: () => [{ catalogId: 'player-movement', entityId: 'e', step: 'Mixamo Source', status: 'deferred', data: { confirmed: false } }] });
    const s = await drainPythonAll({}, d);
    expect(s).toMatchObject({ skipped: 1, dispatched: 0 });
    expect(s.results[0].outcome).toBe('no-dispatch');
    expect(d.saved).toHaveLength(0);
  });

  it('skips an already-drained step unless force is set', async () => {
    const list = () => [artifact('IK Rigs', 'player_movement.build_ik_rigs', { created: ['x'], skipped: [], failed: [] })];
    expect((await drainPythonAll({}, deps({ listArtifacts: list }))).results[0].outcome).toBe('already-drained');
    expect((await drainPythonAll({}, deps({ listArtifacts: list }), { force: true })).results[0].outcome).toBe('drained');
  });

  it('runs a chain in the pipeline\'s declared order, not db order', async () => {
    const seen: string[] = [];
    const d = deps({
      listArtifacts: () => [
        artifact('Retarget Clips', 'player_movement.retarget'),
        artifact('Mesh + Skeleton', 'player_movement.verify_mesh'),
        artifact('IK Rigs', 'player_movement.build_ik_rigs'),
      ],
      run: async (m) => { seen.push(m); return { ok: true, data: { created: ['a'], skipped: [], failed: [] } }; },
    });
    await drainPythonAll({}, d);
    expect(seen).toEqual(['player_movement.verify_mesh', 'player_movement.build_ik_rigs', 'player_movement.retarget']);
  });

  it('stops a chain after a condemned step — a cascade is not an independent finding', async () => {
    const d = deps({
      listArtifacts: () => [
        artifact('Import Mixamo Clips', 'player_movement.import_clips'),
        artifact('IK Rigs', 'player_movement.build_ik_rigs'),
        artifact('Retarget Clips', 'player_movement.retarget'),
      ],
      run: async (m) => m.endsWith('import_clips')
        ? { ok: true, data: { created: [], skipped: [], failed: ['boom'] } }
        : { ok: true, data: { created: ['a'], skipped: [], failed: [] } },
    });
    const s = await drainPythonAll({}, d);
    expect(s).toMatchObject({ failed: 1, dispatched: 1 });
    expect(s.results.map((r) => r.outcome)).toEqual(['drained', 'upstream-failed', 'upstream-failed']);
    expect(d.saved).toHaveLength(1);
  });

  it('continueOnFail keeps the chain going', async () => {
    const d = deps({
      listArtifacts: () => [
        artifact('Import Mixamo Clips', 'player_movement.import_clips'),
        artifact('IK Rigs', 'player_movement.build_ik_rigs'),
      ],
      run: async (m) => m.endsWith('import_clips')
        ? { ok: true, data: { created: [], skipped: [], failed: ['boom'] } }
        : { ok: true, data: { created: ['a'], skipped: [], failed: [] } },
    });
    const s = await drainPythonAll({}, d, { continueOnFail: true });
    expect(s).toMatchObject({ dispatched: 2, failed: 1, passed: 1 });
  });

  it('one entity\'s broken chain does not stop another entity', async () => {
    const other = { catalogId: 'player-movement', entityId: 'test-headless-mcp', status: 'deferred', data: py('player_movement.build_ik_rigs'), step: 'IK Rigs' };
    const d = deps({
      listArtifacts: () => [
        artifact('Import Mixamo Clips', 'player_movement.import_clips'),
        artifact('IK Rigs', 'player_movement.build_ik_rigs'),
        other,
      ],
      run: async (m) => m.endsWith('import_clips')
        ? { ok: true, data: { created: [], skipped: [], failed: ['boom'] } }
        : { ok: true, data: { created: ['a'], skipped: [], failed: [] } },
    });
    const s = await drainPythonAll({}, d);
    expect(s.results.find((r) => r.entityId === 'test-headless-mcp')?.outcome).toBe('drained');
  });

  it('apply:false is a dry run — the module runs, nothing is written', async () => {
    const d = deps();
    const s = await drainPythonAll({}, d, { apply: false });
    expect(s.changed).toBe(1);
    expect(d.saved).toHaveLength(0);
  });

  it('handles the {ok, issues} envelope through its own checker', async () => {
    const d = deps({
      listArtifacts: () => [artifact('Mesh + Skeleton', 'player_movement.verify_mesh')],
      run: async () => ({ ok: true, data: { ok: false, issues: ['capsule half-height 90 != 88'] } }),
      grade: (_c, step, data) => pythonStepOk(step)(data),
    });
    const s = await drainPythonAll({}, d);
    expect(s.results[0]).toMatchObject({ to: 'fail' });
    expect(s.results[0].detail).toContain('capsule half-height');
  });

  it('writes nothing when no server checker resolves', async () => {
    const d = deps({ grade: () => null });
    const s = await drainPythonAll({}, d);
    expect(s).toMatchObject({ skipped: 1, dispatched: 0 });
    expect(s.results[0].outcome).toBe('not-gradable');
    expect(d.saved).toHaveLength(0);
  });

  it('ignores a non-object module return instead of corrupting the artifact', async () => {
    const run = vi.fn(async () => ({ ok: true as const, data: 'oops' }));
    const d = deps({ run });
    const s = await drainPythonAll({}, d);
    // Merged data is unchanged, so the checker still says "not yet run" → stays deferred.
    expect(s.results[0]).toMatchObject({ to: 'deferred', changed: false });
  });
});
