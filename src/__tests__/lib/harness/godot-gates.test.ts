/**
 * Godot harness gates (spark gtai-phase-2, WP2): with no POF_GODOT_BIN or no game root the gate is
 * `unverifiable`, never a pass; with both it runs and is judged by the evidence file the run wrote,
 * not by exit code alone.
 */
import { describe, it, expect, vi } from 'vitest';
import { runGodotGate, planGodotGate, createGodotGate, deriveGodotCommand, resolveGodotEnv } from '@/lib/harness/godot-gates';
import { verify, checkSuccessReachable } from '@/lib/harness/verifier';
import type { ModuleArea } from '@/lib/harness/types';
import type { GodotEvidenceVerdict } from '@/lib/games/godot/evidenceTypes';

const ENV = { bin: 'C:/godot/godot.exe' };
const gate = createGodotGate('godot-test', 'gtai', { script: 'res://tools/evidence/run_tests.gd', required: true });
const okRun = vi.fn(async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }));

function evidence(status: 'pass' | 'fail', builtAt: string): GodotEvidenceVerdict {
  return {
    status, detail: `unit-tests: ${status}`,
    evidence: {
      schema: 'pof.godot-evidence/1', kind: 'unit-tests', gameId: 'gtai', commit: 'e'.repeat(40), builtAt,
      godotVersion: '4.7.2', status, summary: status,
    },
  };
}

describe('godot gate with no environment', () => {
  it('no POF_GODOT_BIN → unverifiable, never pass, and nothing runs', async () => {
    const run = vi.fn(okRun);
    const r = await runGodotGate(gate, { env: null, rootFor: () => 'D:/gtai', run });
    expect(r).toMatchObject({ passed: false, unverifiable: true });
    expect(r.output).toContain('UNVERIFIABLE');
    expect(r.output).toContain('POF_GODOT_BIN');
    expect(run).not.toHaveBeenCalled();
  });

  it('no game root → unverifiable', async () => {
    const r = await runGodotGate(gate, { env: ENV, rootFor: () => null, run: okRun });
    expect(r).toMatchObject({ passed: false, unverifiable: true });
    expect(r.output).toContain('no game root for gtai');
  });

  it('reads POF_GODOT_BIN from the env, and an empty value is no env', () => {
    expect(resolveGodotEnv({})).toBeNull();
    expect(resolveGodotEnv({ POF_GODOT_BIN: '  ' })).toBeNull();
    expect(resolveGodotEnv({ POF_GODOT_BIN: 'C:/godot.exe' })).toEqual({ bin: 'C:/godot.exe' });
  });

  it('verify() dispatches godot gates and reports a bare one unverifiable (no env in the test process)', async () => {
    const prev = process.env.POF_GODOT_BIN;
    delete process.env.POF_GODOT_BIN;
    try {
      const area = { id: 'a', moduleId: 'arpg-combat', label: 'a', description: '', checklistItemIds: [], featureNames: [], dependsOn: [], status: 'pending', features: [] } as unknown as ModuleArea;
      const report = await verify(area, 1, 'C:/proj', [gate, createGodotGate('godot-export', 'gtai', { command: 'x' })]);
      for (const g of report.gates) expect(g).toMatchObject({ passed: false, unverifiable: true });
      expect(report.allPassed).toBe(false);
      expect(checkSuccessReachable([gate], 'verified').reachable).toBe(false);
    } finally {
      if (prev !== undefined) process.env.POF_GODOT_BIN = prev;
    }
  });
});

describe('godot gate with an environment', () => {
  const deps = (read: () => GodotEvidenceVerdict, exitCode = 0) => ({
    env: ENV, rootFor: () => 'D:/gtai', now: () => Date.parse('2026-11-02T10:00:00Z'),
    run: vi.fn(async () => ({ exitCode, stdout: '', stderr: '' })), read,
  });

  it('runs the headless script in the game root', async () => {
    const d = deps(() => evidence('pass', '2026-11-02T10:00:01Z'));
    await runGodotGate(gate, d);
    expect(d.run).toHaveBeenCalledWith('"C:/godot/godot.exe" --headless --path "D:/gtai" -s res://tools/evidence/run_tests.gd', 'D:/gtai');
    expect(deriveGodotCommand(ENV, 'D:/gtai', { command: 'make test' })).toBe('make test');
  });

  it('fresh pass evidence + exit 0 → pass', async () => {
    expect(await runGodotGate(gate, deps(() => evidence('pass', '2026-11-02T10:00:01Z')))).toMatchObject({ passed: true });
  });

  it('fail evidence → fail, even with exit 0', async () => {
    const r = await runGodotGate(gate, deps(() => evidence('fail', '2026-11-02T10:00:01Z')));
    expect(r.passed).toBe(false);
    expect(r.unverifiable).toBeUndefined();
  });

  it('pass evidence the run did not write (older builtAt) → unverifiable', async () => {
    const r = await runGodotGate(gate, deps(() => evidence('pass', '2026-11-01T10:00:00Z')));
    expect(r).toMatchObject({ passed: false, unverifiable: true });
  });

  it('pass evidence with a non-zero exit → unverifiable, not pass', async () => {
    expect(await runGodotGate(gate, deps(() => evidence('pass', '2026-11-02T10:00:01Z'), 1))).toMatchObject({ passed: false, unverifiable: true });
  });

  it('absent or stale evidence (deferred) → unverifiable', async () => {
    const r = await runGodotGate(gate, deps(() => ({ status: 'deferred', detail: 'x', reason: 'no evidence yet' })));
    expect(r).toMatchObject({ passed: false, unverifiable: true });
    expect(r.output).toContain('no evidence yet');
  });

  it('a gate with neither command nor script cannot plan', () => {
    const plan = planGodotGate(createGodotGate('godot-test', 'gtai'), { env: ENV, rootFor: () => 'D:/gtai' });
    expect(plan).toEqual({ ok: false, error: 'the gate has neither a command nor a script' });
  });
});
