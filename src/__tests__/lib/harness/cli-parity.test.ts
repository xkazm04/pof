/**
 * CLI ↔ HTTP parity for the harness control surface.
 *
 * The doc claims every surface reaches the whole engine. For the CLI that means
 * three things this file pins down:
 *  1. every HTTP steering lever has a flag (budget/unlimited, pass-rate basis,
 *     the UE gates, fork),
 *  2. a start over an existing `.harness` RESUMES that run (same runId) instead
 *     of minting a new one and fragmenting history — the fix the HTTP route got
 *     in round 6 and the CLI never did,
 *  3. the console headline reports the VERIFIED rate (the same numerator the
 *     stop condition uses), with the executor's self-report clearly secondary.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// In-memory DB, mocked before importing anything that touches harness-runs-db.
const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import { startRun, finalizeRun } from '@/lib/harness-runs-db';
import { createDefaultConfig, type RunMeta } from '@/lib/harness/orchestrator';
import { detectGates } from '@/lib/harness/verifier';
import {
  parseCliOptions,
  configFromCliOptions,
  cliOrchestratorOptions,
  formatRateLine,
  formatCompletionHeadline,
} from '@/lib/harness/run-harness';
import type { GamePlan } from '@/lib/harness/types';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS harness_runs');
  testDb.exec('DROP TABLE IF EXISTS harness_runs_old');
});

/** argv as node hands it over (argv[0]=node, argv[1]=script). */
function argv(...flags: string[]): string[] {
  return ['node', 'run-harness.ts', ...flags];
}

const REQUIRED = ['--project', 'C:/proj', '--name', 'Proj'];

// ── 1. Every HTTP lever has a flag ──────────────────────────────────────────

describe('parseCliOptions — HTTP-surface parity', () => {
  it('parses the levers the CLI previously could not express at all', () => {
    const o = parseCliOptions(argv(
      ...REQUIRED,
      '--budget', '12.5',
      '--pass-rate-basis', 'self-reported',
      '--ue-tests',
      '--ue-test-filter', 'PoF.Combat',
      '--ue-visual',
      '--fork',
    ));
    expect(o.errors).toEqual([]);
    expect(o.budgetUsd).toBe(12.5);
    expect(o.passRateBasis).toBe('self-reported');
    expect(o.ueTests).toBe(true);
    expect(o.ueTestFilter).toBe('PoF.Combat');
    expect(o.ueVisual).toBe(true);
    expect(o.fork).toBe(true);
  });

  it('defaults every new lever to "not requested" (no accidental opt-ins)', () => {
    const o = parseCliOptions(argv(...REQUIRED));
    expect(o.budgetUsd).toBeUndefined();
    expect(o.unlimited).toBe(false);
    expect(o.passRateBasis).toBeUndefined();
    expect(o.ueTests).toBe(false);
    expect(o.ueVisual).toBe(false);
    expect(o.fork).toBe(false);
    expect(o.errors).toEqual([]);
  });

  it('--unlimited is the explicit opt-out of any spend cap', () => {
    expect(parseCliOptions(argv(...REQUIRED, '--unlimited')).unlimited).toBe(true);
  });

  it('rejects junk loudly instead of silently coercing it', () => {
    expect(parseCliOptions(argv(...REQUIRED, '--pass-rate-basis', 'vibes')).errors)
      .toEqual([expect.stringContaining('--pass-rate-basis')]);
    expect(parseCliOptions(argv(...REQUIRED, '--budget', 'lots')).errors)
      .toEqual([expect.stringContaining('--budget')]);
    expect(parseCliOptions(argv(...REQUIRED, '--budget', '5', '--unlimited')).errors)
      .toEqual([expect.stringContaining('mutually exclusive')]);
    expect(parseCliOptions(argv(...REQUIRED, '--scenario', 'nope')).errors)
      .toEqual([expect.stringContaining('Unknown scenario')]);
  });
});

describe('configFromCliOptions — the levers reach the engine', () => {
  const proj = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cli-proj-'));

  it('threads budget / unlimited / basis / concurrency into HarnessConfig', () => {
    const projectPath = proj();
    const cfg = configFromCliOptions(parseCliOptions(argv(
      '--project', projectPath, '--name', 'Proj',
      '--budget', '7', '--pass-rate-basis', 'self-reported', '--concurrency', '3',
      '--target-pass-rate', '80',
    )));
    expect(cfg.budgetUsd).toBe(7);
    expect(cfg.passRateBasis).toBe('self-reported');
    expect(cfg.executor.maxConcurrent).toBe(3);
    expect(cfg.targetPassRate).toBe(80);
  });

  it('--unlimited reaches config.unlimited (the only way to run uncapped)', () => {
    const cfg = configFromCliOptions(parseCliOptions(argv('--project', proj(), '--name', 'P', '--unlimited')));
    expect(cfg.unlimited).toBe(true);
    expect(cfg.budgetUsd).toBeUndefined();
  });

  it('--ue-visual adds the game-runs gate; without it the gate is absent', () => {
    const projectPath = proj();
    const withGate = configFromCliOptions(parseCliOptions(argv('--project', projectPath, '--name', 'P', '--ue-visual')));
    expect(withGate.gates.map(g => g.type)).toContain('ue-visual');

    const without = configFromCliOptions(parseCliOptions(argv('--project', projectPath, '--name', 'P')));
    expect(without.gates.map(g => g.type)).not.toContain('ue-visual');
  });

  it('--ue-tests / --ue-test-filter reach detectGates identically to the HTTP body', () => {
    // The automation-test gate only materializes when a UE env is configured
    // (detectUeGates), which a test box does not have — so parity is asserted
    // against detectGates itself: the CLI must ask for exactly the same gates
    // the HTTP route asks for with the same flags.
    const projectPath = proj();
    const cfg = configFromCliOptions(parseCliOptions(argv(
      '--project', projectPath, '--name', 'P', '--ue-tests', '--ue-test-filter', 'PoF.Combat',
    )));
    expect(cfg.gates).toEqual(detectGates(projectPath, { ueTests: true, ueTestFilter: 'PoF.Combat' }));
  });
});

// ── 2. Durable identity: resume-not-fork ────────────────────────────────────

/** A statePath dir bound to `runId` with a real config snapshot on disk. */
function seedStateDir(runId: string): { statePath: string; projectPath: string } {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-proj-'));
  const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-state-'));
  const config = createDefaultConfig({ projectPath, projectName: 'PoF', ueVersion: '5.8', statePath });
  fs.writeFileSync(path.join(statePath, 'harness-config.json'), JSON.stringify(config, null, 2));
  const meta: RunMeta = { runId, projectPath, statePath, startedAt: '2026-01-01T00:00:00.000Z' };
  fs.writeFileSync(path.join(statePath, 'run-meta.json'), JSON.stringify(meta, null, 2));
  return { statePath, projectPath };
}

function cliConfig(projectPath: string, statePath: string) {
  return configFromCliOptions(parseCliOptions(argv(
    '--project', projectPath, '--name', 'PoF', '--state-path', statePath,
  )));
}

describe('cliOrchestratorOptions — the CLI stops fragmenting run history', () => {
  it('RESUMES the run already bound to the statePath (same runId, no new row)', () => {
    const { statePath, projectPath } = seedStateDir('run-cli-paused');
    startRun({ runId: 'run-cli-paused', projectName: 'PoF', projectPath, startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    finalizeRun({ runId: 'run-cli-paused', status: 'paused', endedAt: '2026-01-01T00:01:00.000Z', plan: null, progress: [], guide: null, cost: null });

    const { identity, options } = cliOrchestratorOptions(cliConfig(projectPath, statePath), false);
    expect(identity.mode).toBe('resume');
    expect(options.resumeRunId).toBe('run-cli-paused');
    expect(options.parentRunId).toBeUndefined();
  });

  it('FORKS with provenance from a terminal run', () => {
    const { statePath, projectPath } = seedStateDir('run-cli-done');
    startRun({ runId: 'run-cli-done', projectName: 'PoF', projectPath, startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    finalizeRun({ runId: 'run-cli-done', status: 'completed', endedAt: '2026-01-01T00:05:00.000Z', plan: null, progress: [], guide: null, cost: null });

    const { identity, options } = cliOrchestratorOptions(cliConfig(projectPath, statePath), false);
    expect(identity.mode).toBe('fork');
    expect(options.parentRunId).toBe('run-cli-done');
    expect(options.resumeRunId).toBeUndefined();
  });

  it('--fork forces a fork even over a resumable run', () => {
    const { statePath, projectPath } = seedStateDir('run-cli-paused2');
    startRun({ runId: 'run-cli-paused2', projectName: 'PoF', projectPath, startedAt: '2026-01-01T00:00:00.000Z', plan: null, cost: null });
    finalizeRun({ runId: 'run-cli-paused2', status: 'paused', endedAt: '2026-01-01T00:01:00.000Z', plan: null, progress: [], guide: null, cost: null });

    const { identity, options } = cliOrchestratorOptions(cliConfig(projectPath, statePath), true);
    expect(identity.mode).toBe('fork');
    expect(options.parentRunId).toBe('run-cli-paused2');
  });

  it('a virgin statePath is fresh (no adopted id)', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-proj-'));
    const statePath = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-state-'));
    const { identity, options } = cliOrchestratorOptions(cliConfig(projectPath, statePath), false);
    expect(identity.mode).toBe('fresh');
    expect(options).toEqual({});
  });

  it('refuses a statePath owned by a DIFFERENT project instead of resuming it', () => {
    const { statePath } = seedStateDir('run-cli-other');
    const otherProject = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-other-'));
    expect(() => cliOrchestratorOptions(cliConfig(otherProject, statePath), false)).toThrow(/belongs to project/);
  });
});

// ── 3. The headline is the verified rate ────────────────────────────────────

function plan(total: number, passing: number, verified: number): GamePlan {
  return {
    game: 'PoF', projectPath: 'C:/p', ueVersion: '5.8', areas: [], iteration: 1,
    totalFeatures: total, passingFeatures: passing, verifiedFeatures: verified,
    createdAt: '', updatedAt: '',
  };
}

describe('console rate reporting is honest', () => {
  it('headlines VERIFIED and labels the self-report as secondary', () => {
    const line = formatCompletionHeadline(plan(40, 30, 12));
    expect(line).toMatch(/12\/40 features VERIFIED \(30%\)/);
    expect(line).toMatch(/self-reported \(executor's own claim\): 30\/40 \(75%\)/);
    // Verified must come first — it is what the stop condition compares.
    expect(line.indexOf('VERIFIED')).toBeLessThan(line.indexOf('self-reported'));
  });

  it('progress lines lead with verified too', () => {
    const line = formatRateLine(plan(10, 8, 2));
    expect(line).toBe('2/10 verified (20%) · self-reported 8/10 (80%)');
  });

  it('a legacy plan without verifiedFeatures reports 0 verified, never the self-report', () => {
    const legacy = plan(10, 9, 0);
    delete (legacy as { verifiedFeatures?: number }).verifiedFeatures;
    expect(formatRateLine(legacy)).toBe('0/10 verified (0%) · self-reported 9/10 (90%)');
  });

  it('handles a zero-feature plan without dividing by zero', () => {
    expect(formatRateLine(plan(0, 0, 0))).toBe('0/0 verified (0%) · self-reported 0/0 (0%)');
  });
});
