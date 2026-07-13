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

  if (!gate.command) {
    return {
      gate: gate.name,
      passed: true,
      output: 'No command specified — skipped',
      durationMs: 0,
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
 * Auto-detect project type and return appropriate gates.
 * Checks for package.json (webapp) vs Source/ (UE5).
 *
 * The UE5 gate is REAL (`detectUeGates`): a compile gate derived from the UE env
 * (`POF_UE_EDITOR_CMD` / `POF_UE_UPROJECT`), plus an opt-in automation-test gate.
 * When no UE env is configured the compile gate is commandless and `verify()`
 * reports it `unverifiable` — never the old `ls Source/ && echo` self-pass.
 */
export function detectGates(projectPath: string, opts: UeGateOptions = {}): VerificationGate[] {
  if (fs.existsSync(path.join(projectPath, 'package.json'))) {
    return WEBAPP_GATES;
  }
  if (fs.existsSync(path.join(projectPath, 'Source'))) {
    return detectUeGates(opts);
  }
  return detectUeGates(opts); // fallback: assume UE tree
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
