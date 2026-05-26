import { describe, it, expect } from 'vitest';
import { buildAutomationArgs, parseAbslogVerdict, makeSpawnExecutor } from '@/lib/test-gate-runner/spawnExecutor';

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
