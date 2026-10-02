import { describe, it, expect } from 'vitest';
import { leaveRisk, describeLeaveRisk } from '@/lib/shell/leaveRisk';
import { IN_FLIGHT_PHASES, type OneShotPhase } from '@/stores/oneShotJobStore';

const ALL_PHASES: readonly OneShotPhase[] = [
  'idle', 'analyzing', 'analyzed', 'proposing', 'refining', 'awaitingRun', 'running', 'completed', 'failed',
];

describe('leaveRisk — what leaving would interrupt', () => {
  it('unload: a pane hold is a reason, labelled with its module (a held cook reaches the unload guard)', () => {
    const reasons = leaveRisk('unload', { sessions: {}, holds: { packaging: ['UE cook running'] }, oneShotPhase: 'idle' });
    expect(reasons).toEqual([{ source: 'pane-hold', what: 'UE cook running', where: 'Packaging' }]);
  });

  it('unload: exactly the store\'s exported in-flight phases are one-shot reasons (imported, not restated)', () => {
    expect([...IN_FLIGHT_PHASES]).toEqual(['analyzing', 'proposing', 'refining', 'awaitingRun', 'running']);
    for (const p of ALL_PHASES) {
      const reasons = leaveRisk('unload', { oneShotPhase: p });
      if (IN_FLIGHT_PHASES.includes(p)) {
        expect(reasons).toHaveLength(1);
        expect(reasons[0].source).toBe('one-shot');
      } else {
        expect(reasons).toEqual([]);
      }
    }
  });

  it('[guard] unload: a running CLI session is still a reason naming its terminal', () => {
    const reasons = leaveRisk('unload', { sessions: { t1: { isRunning: true, label: 'Terminal 1' } } });
    expect(reasons).toHaveLength(1);
    expect(reasons[0].source).toBe('cli-session');
    expect(`${reasons[0].what} ${reasons[0].where}`).toContain('Terminal 1');
    expect(leaveRisk('unload', { sessions: { t1: { isRunning: false, label: 'Terminal 1' } } })).toEqual([]);
  });

  it('shell-switch: only pane holds count (the one-shot orchestrator and CLI state survive an unmount)', () => {
    expect(leaveRisk('shell-switch', { oneShotPhase: 'running', holds: {} })).toEqual([]);
    expect(leaveRisk('shell-switch', { sessions: { t1: { isRunning: true, label: 'Terminal 1' } } })).toEqual([]);
    const reasons = leaveRisk('shell-switch', { holds: { 'arpg-character': ['Predictive sweep running'] } });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatchObject({ source: 'pane-hold', what: 'Predictive sweep running' });
  });

  it('describeLeaveRisk names every reason with its place', () => {
    const text = describeLeaveRisk([
      { source: 'pane-hold', what: 'UE cook running', where: 'Packaging' },
      { source: 'pane-hold', what: 'Batch fix running', where: 'Combat' },
    ]);
    expect(text).toContain('UE cook running (Packaging)');
    expect(text).toContain('Batch fix running (Combat)');
  });
});
