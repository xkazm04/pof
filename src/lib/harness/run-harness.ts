#!/usr/bin/env tsx
/**
 * Standalone harness runner — executes the autonomous game build loop
 * from the command line without needing the Next.js dev server.
 *
 * Usage:
 *   npx tsx src/lib/harness/run-harness.ts \
 *     --project "C:/UE/MyARPG" \
 *     --name "MyARPG" \
 *     --ue-version "5.5" \
 *     [--max-iterations 50] \
 *     [--target-pass-rate 90] \
 *     [--pass-rate-basis verified|self-reported] \
 *     [--budget 25] [--unlimited] \
 *     [--ue-tests] [--ue-test-filter "PoF.Combat"] [--ue-visual] \
 *     [--timeout 1800000] \
 *     [--state-path ".harness"] \
 *     [--fork] \
 *     [--dry-run]
 *
 * The script:
 * 1. Builds a game plan from the module registry
 * 2. Iterates through areas in dependency order
 * 3. Spawns Claude Code sessions to implement each area
 * 4. Runs verification gates after each session
 * 5. Generates a reproducible guide as output
 *
 * State persists to <state-path>/ so the process can be interrupted and resumed.
 *
 * PARITY: every steering lever the HTTP surface (`POST /api/harness`) accepts is
 * reachable here, and a start over an existing `.harness` resolves its DURABLE
 * IDENTITY exactly like the HTTP route (`resolveRunIdentity`) — it RESUMES the
 * same runId instead of minting a new one and fragmenting history. See the
 * control-surface parity table in
 * `docs/features/harness-llm-unreal/autonomous-builder.md`.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  createHarnessOrchestrator,
  createDefaultConfig,
  buildGamePlan,
  resolveRunIdentity,
  type HarnessEvent,
  type OrchestratorOptions,
  type RunIdentity,
} from './index';
import type { GamePlan, HarnessConfig, PassRateBasis } from './types';
import { SCENARIOS } from './scenarios';

// ── Scenario Registry ───────────────────────────────────────────────────────
// Named scenarios swap the auto-generated registry plan for a curated set of
// areas. The map now lives in the shared `./scenarios` module so the CLI, the
// HTTP API, and the MCP tool all select from the SAME source (Direction 1c).

// ── Arg Parsing ─────────────────────────────────────────────────────────────

export function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = 'true';
      }
    }
  }
  return args;
}

/** Every lever the CLI understands, normalized. Mirrors the HTTP start body. */
export interface CliOptions {
  projectPath?: string;
  projectName?: string;
  ueVersion: string;
  statePath: string;
  maxIterations: number;
  targetPassRate: number;
  sessionTimeoutMs: number;
  concurrency: number;
  areaPassThreshold?: number;
  themeDirective?: string;
  scenario?: string;
  checkpoint: boolean;
  budgetUsd?: number;
  unlimited: boolean;
  passRateBasis?: PassRateBasis;
  ueTests: boolean;
  ueTestFilter?: string;
  ueVisual: boolean;
  /** Force a fresh forked run even over a resumable statePath (HTTP `fork`). */
  fork: boolean;
  dryRun: boolean;
  /** Loud validation failures — main() prints these and exits 1. */
  errors: string[];
}

function optInt(args: Record<string, string>, key: string): number | undefined {
  const raw = args[key];
  if (raw == null || raw === 'true') return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function optFloat(args: Record<string, string>, key: string, errors: string[]): number | undefined {
  const raw = args[key];
  if (raw == null || raw === 'true') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    errors.push(`--${key} must be a positive number (got "${raw}")`);
    return undefined;
  }
  return n;
}

/**
 * Parse argv into the full option set. PURE (no fs, no process exit) so the
 * parity between this surface and the HTTP body is directly testable.
 */
export function parseCliOptions(argv: string[]): CliOptions {
  const args = parseArgs(argv);
  const errors: string[] = [];

  const projectPath = args['project'];
  const projectName = args['name'];

  const scenario = args['scenario'] && args['scenario'] !== 'true' ? args['scenario'] : undefined;
  if (scenario && !SCENARIOS[scenario]) {
    errors.push(`Unknown scenario "${scenario}". Available: ${Object.keys(SCENARIOS).join(', ')}.`);
  }

  const basisRaw = args['pass-rate-basis'];
  let passRateBasis: PassRateBasis | undefined;
  if (basisRaw != null && basisRaw !== 'true') {
    if (basisRaw === 'verified' || basisRaw === 'self-reported') passRateBasis = basisRaw;
    else errors.push(`--pass-rate-basis must be "verified" or "self-reported" (got "${basisRaw}")`);
  }

  const budgetUsd = optFloat(args, 'budget', errors);
  const unlimited = args['unlimited'] === 'true';
  if (budgetUsd != null && unlimited) {
    errors.push('--budget and --unlimited are mutually exclusive — pick a cap or opt out of one.');
  }

  return {
    projectPath,
    projectName,
    ueVersion: args['ue-version'] ?? '5.5',
    statePath: args['state-path'] && args['state-path'] !== 'true'
      ? path.resolve(args['state-path'])
      : path.join(projectPath ?? '.', '.harness'),
    maxIterations: optInt(args, 'max-iterations') ?? 100,
    targetPassRate: optInt(args, 'target-pass-rate') ?? 90,
    sessionTimeoutMs: optInt(args, 'timeout') ?? 30 * 60 * 1000,
    concurrency: optInt(args, 'concurrency') ?? 4,
    areaPassThreshold: optInt(args, 'area-threshold') || undefined,
    themeDirective: args['theme'] && args['theme'] !== 'true' ? args['theme'] : undefined,
    scenario,
    checkpoint: args['checkpoint'] === 'true',
    budgetUsd,
    unlimited,
    passRateBasis,
    ueTests: args['ue-tests'] === 'true',
    ueTestFilter: args['ue-test-filter'] && args['ue-test-filter'] !== 'true' ? args['ue-test-filter'] : undefined,
    ueVisual: args['ue-visual'] === 'true',
    fork: args['fork'] === 'true',
    dryRun: args['dry-run'] === 'true',
    errors,
  };
}

/** Build the harness config from parsed options — the CLI's half of the parity. */
export function configFromCliOptions(opts: CliOptions): HarnessConfig {
  const scenarioAreas = opts.scenario ? SCENARIOS[opts.scenario]?.areas : undefined;
  return createDefaultConfig({
    projectPath: opts.projectPath!,
    projectName: opts.projectName!,
    ueVersion: opts.ueVersion,
    statePath: opts.statePath,
    maxIterations: opts.maxIterations,
    targetPassRate: opts.targetPassRate,
    themeDirective: opts.themeDirective,
    checkpoint: opts.checkpoint,
    ...(scenarioAreas ? { areas: scenarioAreas } : {}),
    ...(opts.budgetUsd != null ? { budgetUsd: opts.budgetUsd } : {}),
    ...(opts.unlimited ? { unlimited: true } : {}),
    ...(opts.passRateBasis ? { passRateBasis: opts.passRateBasis } : {}),
    ...(opts.ueTests ? { ueTests: true } : {}),
    ...(opts.ueTestFilter != null ? { ueTestFilter: opts.ueTestFilter } : {}),
    ...(opts.ueVisual ? { ueVisual: true } : {}),
    executor: {
      sessionTimeoutMs: opts.sessionTimeoutMs,
      maxRetriesPerArea: 3,
      allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
      skipPermissions: true,
      bareMode: false,
      maxConcurrent: opts.concurrency,
      areaPassThreshold: opts.areaPassThreshold,
    },
  });
}

/**
 * Resolve the run's DURABLE IDENTITY the same way `POST /api/harness` does.
 *
 * Without this a CLI start over an existing `.harness` minted a brand-new runId
 * every time, fragmenting one build's history across many rows — exactly the
 * bug the HTTP surface fixed. Resume-not-fork is the default; `--fork` forces a
 * fork with recorded provenance.
 */
export function cliOrchestratorOptions(
  config: HarnessConfig,
  forceFork: boolean,
): { identity: RunIdentity; options: OrchestratorOptions } {
  const identity = resolveRunIdentity(config.statePath, {
    forceFork,
    projectPath: config.projectPath,
  });
  return {
    identity,
    options: {
      ...(identity.resumeRunId ? { resumeRunId: identity.resumeRunId } : {}),
      ...(identity.parentRunId ? { parentRunId: identity.parentRunId } : {}),
    },
  };
}

// ── Rate reporting ──────────────────────────────────────────────────────────

function pct(numerator: number, total: number): number {
  return total > 0 ? Math.round((numerator / total) * 100) : 0;
}

/**
 * The headline is the VERIFIED rate — the same numerator the stop condition
 * uses by default. The executor's self-report is a T0 claim, so it is still
 * shown but explicitly labeled and secondary; headlining it made the console
 * disagree with the loop's own termination arithmetic.
 */
export function formatRateLine(plan: GamePlan): string {
  const verified = plan.verifiedFeatures ?? 0;
  const total = plan.totalFeatures;
  return (
    `${verified}/${total} verified (${pct(verified, total)}%)`
    + ` · self-reported ${plan.passingFeatures}/${total} (${pct(plan.passingFeatures, total)}%)`
  );
}

/** Terminal summary line — verified first, self-report labeled. */
export function formatCompletionHeadline(plan: GamePlan): string {
  const verified = plan.verifiedFeatures ?? 0;
  const total = plan.totalFeatures;
  return (
    `COMPLETED — ${verified}/${total} features VERIFIED (${pct(verified, total)}%)`
    + ` — self-reported (executor's own claim): ${plan.passingFeatures}/${total} (${pct(plan.passingFeatures, total)}%)`
  );
}

const USAGE = `
Usage: npx tsx src/lib/harness/run-harness.ts \\
  --project <project-path> \\
  --name <project-name> \\
  [--ue-version <version>]              engine version string (default 5.5)
  [--max-iterations <n>]                loop ceiling (default 100)
  [--target-pass-rate <0-100>]          stop condition (default 90)
  [--pass-rate-basis <basis>]           verified (default) | self-reported — which
                                        numerator the stop condition compares
  [--budget <usd>]                      spend cap; omitted → the default $25 cap
  [--unlimited]                         opt OUT of any spend cap (required to run uncapped)
  [--timeout <ms>]                      per-session wall clock (default 30 min)
  [--concurrency <n>]                   max concurrent executor sessions (default 4)
  [--area-threshold <0-100>]            min pass-rate to accept an AREA
  [--state-path <dir>]                  default <project>/.harness
  [--theme "<creative direction>"]      injected into every executor prompt
  [--scenario <scenario-name>]          curated area set instead of the registry plan
  [--checkpoint]                        git snapshot per green area + rollback-to-green
  [--ue-tests]                          opt in the UE5 automation-test gate (advisory)
  [--ue-test-filter <filter>]           automation filter for --ue-tests (default "Project")
  [--ue-visual]                         opt in the game-runs gate (boots the game, judges a frame)
  [--fork]                              force a NEW forked run over a resumable statePath
                                        (default: RESUME the run already at this statePath)
  [--dry-run]                           print the plan and exit

Scenarios:
${Object.entries(SCENARIOS)
  .map(([name, def]) => `  ${name.padEnd(16)} — ${def.label} (${def.total} areas across ${def.phases.length} phases)`)
  .join('\n')}
`;

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseCliOptions(process.argv);

  if (parseArgs(process.argv)['help'] === 'true') {
    console.log(USAGE);
    process.exit(0);
  }
  if (!opts.projectPath || !opts.projectName) {
    console.error(USAGE);
    process.exit(1);
  }
  if (opts.errors.length > 0) {
    for (const e of opts.errors) console.error(e);
    process.exit(1);
  }

  const { statePath } = opts;

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              PoF Harness — Autonomous Game Builder          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`  Project:     ${opts.projectName}`);
  console.log(`  Path:        ${opts.projectPath}`);
  console.log(`  UE Version:  ${opts.ueVersion}`);
  console.log(`  State:       ${statePath}`);
  console.log(`  Max Iter:    ${opts.maxIterations}`);
  console.log(`  Target:      ${opts.targetPassRate}% pass rate (${opts.passRateBasis ?? 'verified'} basis)`);
  console.log(`  Timeout:     ${(opts.sessionTimeoutMs / 60_000).toFixed(0)} min per session`);
  console.log(`  Concurrent:  ${opts.concurrency} sessions`);
  console.log(`  Budget:      ${opts.unlimited ? 'UNLIMITED (no cap)' : opts.budgetUsd != null ? `$${opts.budgetUsd.toFixed(2)}` : 'default cap ($25) — pass --unlimited to run uncapped'}`);
  if (opts.checkpoint) console.log(`  Checkpoint:  git snapshot per area + rollback-to-green`);
  if (opts.scenario) console.log(`  Scenario:    ${opts.scenario}`);
  if (opts.ueTests) console.log(`  UE tests:    on${opts.ueTestFilter ? ` (filter ${opts.ueTestFilter})` : ''}`);
  if (opts.ueVisual) console.log(`  UE visual:   on (game-runs gate — boots the game, judges a frame)`);
  if (opts.themeDirective) console.log(`  Theme:       ${opts.themeDirective.slice(0, 60)}...`);
  console.log();

  const scenarioDef = opts.scenario ? SCENARIOS[opts.scenario] : undefined;
  if (scenarioDef) {
    console.log(`  Loading ${scenarioDef.label} scenario:`);
    for (const phase of scenarioDef.phases) {
      console.log(`    ${`${phase.label}:`.padEnd(29)}${phase.count} areas`);
    }
    console.log(`    ${'Total:'.padEnd(29)}${scenarioDef.total} areas`);
    console.log();
  }

  const config = configFromCliOptions(opts);

  // Dry run: just show the plan
  if (opts.dryRun) {
    const plan = buildGamePlan(config);
    console.log(`Game Plan: ${plan.totalFeatures} features across ${plan.areas.length} areas\n`);
    console.log('Build Order:');
    for (let i = 0; i < plan.areas.length; i++) {
      const area = plan.areas[i];
      const deps = area.dependsOn.length > 0
        ? ` (after: ${area.dependsOn.join(', ')})`
        : ' (no deps)';
      console.log(`  ${i + 1}. [${area.moduleId}] ${area.label} — ${area.features.length} features${deps}`);
    }
    console.log('\nRun without --dry-run to start building.');
    process.exit(0);
  }

  // Durable identity — resume the run already bound to this statePath instead of
  // minting a new id (parity with POST /api/harness).
  let identity: RunIdentity;
  let orchestratorOptions: OrchestratorOptions;
  try {
    ({ identity, options: orchestratorOptions } = cliOrchestratorOptions(config, opts.fork));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }
  console.log(
    identity.mode === 'resume'
      ? `  Run:         RESUMING ${identity.resumeRunId} (same run — history stays one build)`
      : identity.mode === 'fork'
        ? `  Run:         FORK from ${identity.parentRunId} (provenance recorded)`
        : '  Run:         fresh',
  );
  console.log();

  // Create and start orchestrator
  const harness = createHarnessOrchestrator(config, orchestratorOptions);

  // Event logging
  harness.on((event: HarnessEvent) => {
    const ts = new Date().toISOString().split('T')[1].split('.')[0];
    switch (event.type) {
      case 'harness:started':
        console.log(`[${ts}] STARTED — ${event.plan.areas.length} areas, ${event.plan.totalFeatures} features`);
        break;
      case 'harness:planning':
        console.log(`[${ts}] PLANNING — iteration ${event.iteration}`);
        break;
      case 'harness:executing':
        console.log(`[${ts}] EXECUTING — ${event.areaId} (iter ${event.iteration})`);
        break;
      case 'harness:verifying':
        console.log(`[${ts}] VERIFYING — ${event.areaId}`);
        break;
      case 'harness:area-completed':
        console.log(`[${ts}] ✓ COMPLETED — ${event.areaId}`);
        break;
      case 'harness:area-failed':
        console.log(`[${ts}] ✗ FAILED — ${event.areaId}: ${event.reason}`);
        break;
      case 'harness:checkpoint':
        console.log(`[${ts}] ⎘ CHECKPOINT — ${event.areaId} @ ${event.sha.slice(0, 8)}`);
        break;
      case 'harness:rollback':
        console.log(`[${ts}] ↩ ROLLBACK — ${event.areaId} → last green ${event.toSha.slice(0, 8)}`);
        break;
      case 'harness:guide-updated':
        console.log(`[${ts}] GUIDE — Phase ${event.step.phase}: ${event.step.label}`);
        break;
      case 'harness:learning':
        console.log(`[${ts}] LEARNED — ${event.learning}`);
        break;
      case 'harness:progress':
        console.log(`[${ts}] PROGRESS — ${formatRateLine(event.plan)}`);
        break;
      case 'harness:error':
        // Non-fatal errors are advisories — notably the launch preflight's
        // "success is UNREACHABLE as configured" warning (checkSuccessReachable).
        // Never swallow it, and never dress it as a crash.
        if (event.fatal) console.error(`[${ts}] ERROR — ${event.error} (FATAL)`);
        else console.error(`[${ts}] ⚠ WARNING — ${event.error}`);
        break;
      case 'harness:paused':
        console.log(`[${ts}] PAUSED — ${event.reason}`);
        break;
      case 'harness:completed':
        console.log(`\n${'═'.repeat(60)}`);
        console.log(formatCompletionHeadline(event.plan));
        console.log(`Guide: ${statePath}/guide.md`);
        console.log(`Plan:  ${statePath}/game-plan.json`);
        console.log('═'.repeat(60));
        break;
    }
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT — pausing harness after current iteration...');
    harness.pause();
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM — pausing harness...');
    harness.pause();
  });

  try {
    const guide = await harness.start();
    console.log(`\nGuide generated with ${guide.steps.length} steps.`);
    console.log(`Output: ${statePath}/guide.md`);
    process.exit(0);
  } catch (err) {
    console.error('Harness crashed:', err);
    process.exit(1);
  }
}

// Only auto-run when invoked as a script — importing this module (tests) must
// not launch a build loop.
function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) void main();
