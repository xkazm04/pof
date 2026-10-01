import { describe, it, expect } from 'vitest';
import { arbitrateRunEnd } from '@/components/cli/runArbiter';

// scan-sweep --challenge cli-terminal-shell/A — the server decides when a run ends. Every
// non-positive observation (stream drop, silence, stuck poll, hidden poll) is arbitrated
// over the server's execution status by ONE pure rule.

describe('arbitrateRunEnd', () => {
  it('a live run is never ended by a client observation — it reconnects', () => {
    expect(arbitrateRunEnd({ kind: 'status', status: { status: 'running' } }, { declared: false })).toEqual({ kind: 'reconnect' });
  });

  it('a clean run with declared callbacks waits for the server verdict, then ends with it', () => {
    expect(arbitrateRunEnd(
      { kind: 'status', status: { status: 'completed', isError: false, callbackStatus: null } }, { declared: true },
    )).toEqual({ kind: 'wait' });
    expect(arbitrateRunEnd(
      { kind: 'status', status: { status: 'completed', isError: false, callbackStatus: 'confirmed' } }, { declared: true },
    )).toEqual({ kind: 'end', success: true, callbackStatus: 'confirmed' });
  });

  it('error, aborted and an error result end the run as failed', () => {
    expect(arbitrateRunEnd({ kind: 'status', status: { status: 'error' } }, { declared: false })).toEqual({ kind: 'end', success: false });
    expect(arbitrateRunEnd({ kind: 'status', status: { status: 'aborted' } }, { declared: false })).toEqual({ kind: 'end', success: false });
    expect(arbitrateRunEnd({ kind: 'status', status: { status: 'completed', isError: true } }, { declared: false })).toEqual({ kind: 'end', success: false });
  });

  it('a gone run ends as unknown; an unreachable server never concludes a run', () => {
    expect(arbitrateRunEnd({ kind: 'not-found' }, { declared: false })).toEqual({ kind: 'end', success: false, outcomeUnknown: true });
    expect(arbitrateRunEnd({ kind: 'not-found' }, { declared: true })).toEqual({ kind: 'end', success: false, outcomeUnknown: true });
    expect(arbitrateRunEnd({ kind: 'unreachable' }, { declared: false })).toEqual({ kind: 'wait' });
    expect(arbitrateRunEnd({ kind: 'unreachable' }, { declared: true })).toEqual({ kind: 'wait' });
  });
});
