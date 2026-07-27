/**
 * Verifier — runs quality gates after each executor session.
 *
 * Gates are configurable and include:
 * - TypeScript/ESLint validation (npm run validate)
 * - UE5 headless builds
 * - Git status checks (clean state)
 * - Custom commands
 *
 * The verifier produces a VerificationReport that the orchestrator
 * uses to decide whether to advance or retry.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import type {
  VerificationGate,
  VerificationResult,
  VerificationReport,
  ModuleArea,
} from './types';
import { runVisualGate, createVisualGate } from './visual-gate';
import { detectUeGates, deriveUeTestCommand, parseAutomationLog, resolveUeEnv, type UeGateOptions } from './ue-gates';
import { runUeVisualGate, createUeVisualGate } from './ue-visual-gate';

// ── Gate Execution ──────────────────────────────────────────────────────────

function runCommand(
  command: string,
  cwd: string,
  timeoutMs: number = 120_000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = exec(command, { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      // Command settled normally — cancel the pending fallback kill timer.
      // (fallbackKill is initialized synchronously below, before any async
      // exec callback can fire, so it is always defined here.)
      clearTimeout(fallbackKill);
      resolve({
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        exitCode: error?.code ?? (error ? 1 : 0),
      });
    });

    // Fallback kill if the command genuinely hangs past exec's own `timeout`
    // (belt-and-suspenders). unref'd so an armed-but-unfired timer can never
    // hold the event loop open after the gate completes.
    const fallbackKill = setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch { /* already dead */ }
    }, timeoutMs + 1000);
    fallbackKill.unref?.();
  });
}

function parseErrors(output: string): Array<{ file?: string; line?: number; message: string }> {
  const errors: Array<{ file?: string; line?: number; message: string }> = [];

  // Match TypeScript errors: src/file.ts(10,5): error TS1234: message
  const tsRegex = /([^\s(]+)\((\d+),\d+\):\s*error\s+TS\d+:\s*(.+)/g;
  let match;
  while ((match = tsRegex.exec(output)) !== null) {
    errors.push({ file: match[1], line: parseInt(match[2]), message: match[3] });
  }

  // Match ESLint errors: /path/file.ts:10:5 error message rule-name
  const eslintRegex = /([^\s:]+):(\d+):\d+\s+error\s+(.+)/g;
  while ((match = eslintRegex.exec(output)) !== null) {
    errors.push({ file: match[1], line: parseInt(match[2]), message: match[3] });
  }

  // Match UE5 build errors: file.cpp(10): error C1234: message
  const ue5Regex = /([^\s(]+)\((\d+)\):\s*error\s+\w+:\s*(.+)/g;
  while ((match = ue5Regex.exec(output)) !== null) {
    errors.push({ file: match[1], line: parseInt(match[2]), message: match[3] });
  }

  // If no structured errors found, add the raw output as a single error
  if (errors.length === 0 && output.trim()) {
    const lines = output.trim().split('\n');
    const relevant = lines.filter(l => /error|fail|fatal/i.test(l)).slice(0, 5);
    if (relevant.length > 0) {
      errors.push(...relevant.map(l => ({ message: l.trim() })));
    }
  }

  return errors;
}

// ── Built-in Gates ──────────────────────────────────────────────────────────

async function runGitCleanCheck(cwd: string): Promise<VerificationResult> {
  const start = Date.now();
  const result = await runCommand('git status --porcelain', cwd);

  // We expect no untracked/unstaged files (clean working tree)
  const untracked = result.stdout.split('\n').filter(l => l.startsWith('??')).length;
  const modified = result.stdout.split('\n').filter(l => l.startsWith(' M') || l.startsWith('M ')).length;

  return {
    gate: 'git-clean',
    passed: untracked === 0 && modified === 0,
    output: result.stdout || 'Working tree clean',
    durationMs: Date.now() - start,
    errors: untracked + modified > 0
      ? [{ message: `${untracked} untracked, ${modified} modified files — commit or discard before proceeding` }]
      : undefined,
  };
}

async function runGate(
  gate: VerificationGate,
  cwd: string,
): Promise<VerificationResult> {
  const start = Date.now();

  // A commandless gate SELF-CERTIFIED here ("No command specified — skipped",
  // passed:true) — any custom/build/test/lint/typecheck gate configured without
  // a command silently green-lit the area. Only `ue-compile` had ever been given
  // the honest treatment; it is now uniform: no command → nothing was run →
  // `unverifiable`, with exactly the same requiredGates consequences (counts
  // toward requiredFailures, excluded from self-heal, records
  // verification:'unverifiable').
  if (!gate.command) {
    return {
      gate: gate.name,
      passed: false,
      unverifiable: true,
      output:
        `Gate "${gate.name}" (${gate.type}) UNVERIFIABLE — no command configured, so nothing was run. `
        + 'The area is NOT self-certified; configure a command for this gate to verify it.',
      durationMs: 0,
      errors: [{ message: `no command configured for gate "${gate.name}"` }],
    };
  }

  const result = await runCommand(gate.command, cwd);
  const passed = result.exitCode === 0;
  const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');

  return {
    gate: gate.name,
    passed,
    output: combinedOutput.slice(0, 5000), // Cap output size
    durationMs: Date.now() - start,
    errors: !passed ? parseErrors(combinedOutput) : undefined,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * True when the tree carries an unambiguous UE5 marker: a `Source/` directory or
 * a `*.uproject` file at the root. A UE project frequently also carries JS
 * tooling (a `package.json` for scripts/lint/hooks), so this MUST be checked
 * before package.json — otherwise a C++ tree would be handed WEBAPP_GATES and
 * `npx next build` would run against it (a category error).
 */
function isUeTree(projectPath: string): boolean {
  if (fs.existsSync(path.join(projectPath, 'Source'))) return true;
  try {
    return fs.readdirSync(projectPath).some(f => f.toLowerCase().endsWith('.uproject'));
  } catch {
    return false;
  }
}

/**
 * Auto-detect project type and return appropriate gates.
 * Checks UE markers (Source/ or *.uproject) FIRST, then package.json (webapp).
 *
 * The UE5 gate is REAL (`detectUeGates`): a compile gate derived from the UE env
 * (`POF_UE_EDITOR_CMD` / `POF_UE_UPROJECT`), plus an opt-in automation-test gate.
 * When no UE env is configured the compile gate is commandless and `verify()`
 * reports it `unverifiable` — never the old `ls Source/ && echo` self-pass.
 *
 * UE markers win over package.json so a UE tree that carries JS tooling still
 * gets UE gates instead of `npx next build`.
 */
/**
 * Options for {@link detectGates}. Extends the sibling `UeGateOptions` (owned by
 * ue-gates.ts) with the opt-in `ueVisual` game-runs gate, wired HERE rather than
 * inside `detectUeGates` so this context never edits ue-gates.ts.
 */
export interface DetectGateOptions extends UeGateOptions {
  /** Opt-in the advisory `ue-visual` game-runs gate (boots the game, judges a frame). */
  ueVisual?: boolean;
}

export function detectGates(projectPath: string, opts: DetectGateOptions = {}): VerificationGate[] {
  const { ueVisual, ...ueOpts } = opts;
  const withUeVisual = (gates: VerificationGate[]): VerificationGate[] =>
    ueVisual ? [...gates, createUeVisualGate()] : gates;

  if (isUeTree(projectPath)) {
    return withUeVisual(detectUeGates(ueOpts));
  }
  if (fs.existsSync(path.join(projectPath, 'package.json'))) {
    // The game-runs gate is UE-only; a webapp tree never gets it.
    return WEBAPP_GATES;
  }
  return withUeVisual(detectUeGates(ueOpts)); // fallback: assume UE tree
}

/** Verification gates for PoF webapp (TypeScript/Next.js) */
export const WEBAPP_GATES: VerificationGate[] = [
  {
    name: 'build',
    type: 'build',
    required: true,
    command: 'npx next build',
  },
  {
    name: 'lint',
    type: 'lint',
    required: false,
    command: 'npx eslint src/ --quiet',
  },
  {
    name: 'test',
    type: 'test',
    required: false,
    command: 'npx vitest run --reporter=verbose',
  },
  createVisualGate(),
];

/**
 * UE5 compile gate. A commandless gate means NO UE env is configured → the gate
 * is `unverifiable` (passed:false, never a silent pass). With a command, run UBT
 * and judge by exit code (deterministic, unlike the editor's shutdown).
 */
async function runUeCompileGate(gate: VerificationGate, cwd: string): Promise<VerificationResult> {
  if (!gate.command) {
    return {
      gate: gate.name,
      passed: false,
      unverifiable: true,
      output:
        'UE compile gate UNVERIFIABLE — no UE environment configured '
        + '(set POF_UE_EDITOR_CMD and POF_UE_UPROJECT to derive a real build command). '
        + 'The area is NOT self-certified.',
      durationMs: 0,
      errors: [{ message: 'UE env not configured (POF_UE_EDITOR_CMD / POF_UE_UPROJECT)' }],
    };
  }
  const start = Date.now();
  const result = await runCommand(gate.command, cwd, 30 * 60 * 1000); // UBT can take a while
  const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
  const passed = result.exitCode === 0;
  return {
    gate: gate.name,
    passed,
    output: combined.slice(0, 5000),
    durationMs: Date.now() - start,
    errors: !passed ? parseErrors(combined) : undefined,
  };
}

/**
 * UE5 automation-test gate. Runs the editor headlessly and judges by ABSLOG
 * CONTENT (not exit code — the editor can crash on shutdown after a clean run).
 * Needs `statePath` to place the abslog; without it (or without UE env) the gate
 * is `unverifiable`. A zero-match filter is also `unverifiable`, not a failure.
 */
async function runUeTestGate(
  gate: VerificationGate,
  cwd: string,
  statePath: string | undefined,
  iteration: number,
): Promise<VerificationResult> {
  const env = resolveUeEnv();
  if (!env || !statePath) {
    return {
      gate: gate.name,
      passed: false,
      unverifiable: true,
      output: !statePath
        ? 'UE test gate UNVERIFIABLE — no statePath to place the abslog.'
        : 'UE test gate UNVERIFIABLE — no UE environment configured.',
      durationMs: 0,
    };
  }
  const start = Date.now();
  const abslog = path.join(statePath, `ue-tests-${iteration}.log`);
  const command = deriveUeTestCommand(env, gate.filter ?? 'Project', abslog);
  await runCommand(command, cwd, 30 * 60 * 1000);
  // Judge by the abslog UE wrote, NOT the exec exit code.
  let logContent = '';
  try { logContent = fs.readFileSync(abslog, 'utf-8'); } catch { /* missing log → unverifiable below */ }
  const verdict = parseAutomationLog(logContent);
  return {
    gate: gate.name,
    passed: verdict.verdict === 'pass',
    unverifiable: verdict.verdict === 'unverifiable',
    output: `${verdict.reason} (${verdict.passed} passed / ${verdict.failed} failed)`,
    durationMs: Date.now() - start,
    errors: verdict.verdict === 'fail' ? [{ message: verdict.reason }] : undefined,
  };
}

// ── Launch preflight: is success even reachable? ─────────────────────────────

/**
 * Can this gate be evaluated AT ALL, given only its static configuration?
 *
 * `visual` / `ue-visual` are excluded: they carry no command by design and
 * their verifiability depends on runtime inputs (statePath, a captured frame),
 * so a static answer would be a guess. Everything else needs a command; a
 * required `ue-test` additionally needs the UE env to derive one.
 */
function gateCannotVerify(gate: VerificationGate, hasUeEnv: boolean): boolean {
  if (gate.type === 'visual' || gate.type === 'ue-visual') return false;
  if (gate.type === 'ue-test') return !hasUeEnv;
  return !gate.command;
}

export interface SuccessReachability {
  /** False when the stop condition can never be satisfied as configured. */
  reachable: boolean;
  /** Names of the required gates that cannot verify (empty when reachable). */
  blockingGates: string[];
  /** Operator-facing explanation naming the specific cause + the fixes. */
  reason?: string;
}

/**
 * Detect the UNREACHABLE-SUCCESS combination BEFORE a run burns money on it.
 *
 * With `passRateBasis: 'verified'` (the default) a feature only counts toward
 * the target when the area's REQUIRED gates all passed. So a required gate that
 * can never pass — a commandless gate, or a UE gate with no UE env — pins the
 * verified rate at 0 forever: the loop grinds every one of `maxIterations`
 * sessions and stops only at the budget cap, with nothing ever warning the
 * operator why. This is a WARNING, never a block: an operator may legitimately
 * want the run's side effects (code + guide) without a reachable stop condition.
 */
export function checkSuccessReachable(
  gates: VerificationGate[],
  passRateBasis: 'verified' | 'self-reported',
  opts: { hasUeEnv?: boolean } = {},
): SuccessReachability {
  if (passRateBasis !== 'verified') return { reachable: true, blockingGates: [] };
  const hasUeEnv = opts.hasUeEnv ?? resolveUeEnv() !== null;
  const blockingGates = gates
    .filter(g => g.required && gateCannotVerify(g, hasUeEnv))
    .map(g => g.name);
  if (blockingGates.length === 0) return { reachable: true, blockingGates: [] };
  return {
    reachable: false,
    blockingGates,
    reason:
      `Success is UNREACHABLE as configured: passRateBasis 'verified' only counts a feature when every `
      + `required gate passes, but required gate(s) [${blockingGates.join(', ')}] cannot verify `
      + '(no command configured, or no UE env for a UE gate). The verified pass-rate will stay at 0%, so the loop '
      + 'will run every iteration and stop only at the budget cap. Fix: configure the gate command '
      + '(POF_UE_EDITOR_CMD + POF_UE_UPROJECT for UE gates), drop the gate\'s `required` flag, '
      + "or set passRateBasis:'self-reported' to score on the executor's own reports.",
  };
}

/**
 * Run all verification gates for a completed area.
 * Returns a VerificationReport with individual gate results.
 */
export async function verify(
  area: ModuleArea,
  iteration: number,
  projectPath: string,
  gates: VerificationGate[],
  statePath?: string,
): Promise<VerificationReport> {
  const results: VerificationResult[] = [];

  // Run configured gates
  for (const gate of gates) {
    if (gate.type === 'visual' && statePath) {
      // Visual gate uses Playwright — special handler
      const vResult = await runVisualGate(projectPath, statePath, iteration);
      results.push({
        gate: gate.name,
        passed: vResult.passed,
        output: vResult.output,
        durationMs: vResult.durationMs,
        errors: vResult.errors,
      });
    } else if (gate.type === 'visual') {
      // Skip visual gate if no statePath provided
      results.push({
        gate: gate.name,
        passed: true,
        output: 'Visual gate skipped (no statePath)',
        durationMs: 0,
      });
    } else if (gate.type === 'ue-compile') {
      results.push(await runUeCompileGate(gate, projectPath));
    } else if (gate.type === 'ue-test') {
      results.push(await runUeTestGate(gate, projectPath, statePath, iteration));
    } else if (gate.type === 'ue-visual') {
      if (!statePath) {
        // No statePath → nowhere to store the frame; report unverifiable, never a pass.
        results.push({
          gate: gate.name,
          passed: false,
          unverifiable: true,
          output: 'UE visual gate UNVERIFIABLE — no statePath to store the captured frame.',
          durationMs: 0,
        });
      } else {
        const gv = await runUeVisualGate(projectPath, statePath, iteration);
        results.push({
          gate: gate.name,
          passed: gv.passed,
          ...(gv.unverifiable ? { unverifiable: true } : {}),
          output: gv.output,
          durationMs: gv.durationMs,
          errors: gv.errors,
        });
      }
    } else {
      const result = await runGate(gate, projectPath);
      results.push(result);
    }
  }

  const requiredFailures = results.filter(r => {
    const gate = gates.find(g => g.name === r.gate);
    return gate?.required && !r.passed;
  }).length;

  return {
    iteration,
    areaId: area.id,
    timestamp: new Date().toISOString(),
    gates: results,
    allPassed: results.every(r => r.passed),
    requiredFailures,
  };
}

/**
 * Format verification results as a summary string for progress logs.
 */
export function formatVerificationSummary(report: VerificationReport): string {
  const lines = report.gates.map(r => {
    const icon = r.unverifiable ? 'UNVERIFIABLE' : r.passed ? 'PASS' : 'FAIL';
    const duration = `${(r.durationMs / 1000).toFixed(1)}s`;
    const errorCount = r.errors?.length ?? 0;
    const errorSuffix = errorCount > 0 ? ` (${errorCount} errors)` : '';
    return `  ${icon} ${r.gate} [${duration}]${errorSuffix}`;
  });

  const header = report.allPassed
    ? `Verification PASSED — all ${report.gates.length} gates green`
    : `Verification FAILED — ${report.requiredFailures} required gate(s) failed`;

  return [header, ...lines].join('\n');
}
