/**
 * The self-heal's post-fix re-run must not be stricter than the gate it re-runs.
 *
 * `attemptSelfHeal` confirms a repair by exec'ing the failing gate's OWN command
 * again. The verifier runs that same command with a 10 MB output budget
 * (`runCommand`'s `maxBuffer`), but the heal's `exec` used Node's 1 MB default —
 * and `exec` does not truncate on overflow, it KILLS the child and returns an
 * ENOBUFS error. A chatty-but-successful re-run (a full tsc pass, a UBT log)
 * therefore came back as "verify command still failing after the fix session"
 * for a repair that had actually landed, and the area spent its next retry — a
 * whole `claude -p` session — on a measurement artefact.
 *
 * The case below is the smallest thing that separates the two: a command that
 * exits 0 and prints more than 1 MB.
 */

import { describe, it, expect, vi } from 'vitest';

// attemptSelfHeal spawns a real `claude -p` before re-verifying — stub it out so
// the test exercises only the confirmation step.
vi.mock('@/lib/harness/claude-session', () => ({
  spawnClaudeSession: async () => ({ output: 'fixed', exitCode: 0, errors: [], costUsd: 0.1 }),
  wrapHarnessResult: (body: string) => `@@HARNESS_RESULT\n${body}\n@@END_HARNESS_RESULT`,
  killProcessTree: async () => ({ method: 'none', killed: false, detail: 'stub' }),
}));

import { attemptSelfHeal, HEAL_VERIFY_MAX_BUFFER_BYTES } from '@/lib/harness/orchestrator';

const HEAL_CONFIG = { sessionTimeoutMs: 60_000, skipPermissions: true };

/** A verify command that SUCCEEDS (exit 0) while printing well past Node's 1 MB default. */
const LOUD_SUCCESS = `"${process.execPath}" -e "process.stdout.write('x'.repeat(2*1024*1024))"`;

describe('attemptSelfHeal — a loud but passing re-verify is a heal, not a failure', () => {
  it('treats a >1 MB successful verify command as healed', async () => {
    const result = await attemptSelfHeal('.', ['TS2322: something broke'], LOUD_SUCCESS, HEAL_CONFIG);

    expect(result.sessionSpawned).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.healed).toBe(true);
  }, 60_000);

  it('still reports a genuinely failing verify command as not healed', async () => {
    const failing = `"${process.execPath}" -e "process.exit(3)"`;
    const result = await attemptSelfHeal('.', ['TS2322: something broke'], failing, HEAL_CONFIG);

    expect(result.healed).toBe(false);
    expect(result.reason).toMatch(/still failing/);
  }, 60_000);

  it('matches the verifier\'s own gate budget rather than exec\'s default', () => {
    expect(HEAL_VERIFY_MAX_BUFFER_BYTES).toBe(10 * 1024 * 1024);
    // The default this defends against; a regression back to it would let the
    // first case above fail again.
    expect(HEAL_VERIFY_MAX_BUFFER_BYTES).toBeGreaterThan(1024 * 1024);
  });
});
