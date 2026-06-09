import { describe, it, expect } from 'vitest';
import { classifyVerdictChange, shouldNotify, type GateNotifyMode } from '@/lib/notify/verdict-change';

describe('classifyVerdictChange', () => {
  it('flags deferred→fail as a failure (a new failing gate), not a regression', () => {
    const c = classifyVerdictChange('deferred', 'fail');
    expect(c).toEqual({ changed: true, regression: false, failure: true, recovery: false });
  });

  it('flags pass→fail as a regression and a failure', () => {
    const c = classifyVerdictChange('pass', 'fail');
    expect(c).toEqual({ changed: true, regression: true, failure: true, recovery: false });
  });

  it('flags deferred→pass as a recovery', () => {
    const c = classifyVerdictChange('deferred', 'pass');
    expect(c).toEqual({ changed: true, regression: false, failure: false, recovery: true });
  });

  it('flags fail→pass as a recovery', () => {
    const c = classifyVerdictChange('fail', 'pass');
    expect(c.recovery).toBe(true);
    expect(c.failure).toBe(false);
  });

  it('treats a null prior (no artifact) as a change', () => {
    expect(classifyVerdictChange(null, 'fail').changed).toBe(true);
  });

  it('reports no change when the verdict is unchanged', () => {
    expect(classifyVerdictChange('pass', 'pass').changed).toBe(false);
    expect(classifyVerdictChange('fail', 'fail').changed).toBe(false);
  });
});

describe('shouldNotify', () => {
  const modes: GateNotifyMode[] = ['all', 'failures', 'regressions'];

  it('never notifies on a no-op change in any mode', () => {
    const noChange = classifyVerdictChange('pass', 'pass');
    for (const m of modes) expect(shouldNotify(m, noChange)).toBe(false);
  });

  it("'all' fires on every change including recoveries", () => {
    expect(shouldNotify('all', classifyVerdictChange('deferred', 'pass'))).toBe(true);
    expect(shouldNotify('all', classifyVerdictChange('pass', 'fail'))).toBe(true);
  });

  it("'failures' fires on deferred→fail and pass→fail, but not recoveries", () => {
    expect(shouldNotify('failures', classifyVerdictChange('deferred', 'fail'))).toBe(true);
    expect(shouldNotify('failures', classifyVerdictChange('pass', 'fail'))).toBe(true);
    expect(shouldNotify('failures', classifyVerdictChange('deferred', 'pass'))).toBe(false);
  });

  it("'regressions' fires only on pass→fail", () => {
    expect(shouldNotify('regressions', classifyVerdictChange('pass', 'fail'))).toBe(true);
    expect(shouldNotify('regressions', classifyVerdictChange('deferred', 'fail'))).toBe(false);
    expect(shouldNotify('regressions', classifyVerdictChange('deferred', 'pass'))).toBe(false);
  });
});
