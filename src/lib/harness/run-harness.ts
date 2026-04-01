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
 *     [--timeout 1800000] \
 *     [--state-path ".harness"] \
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
 */

import * as path from 'path';
import {
  createHarnessOrchestrator,
  createDefaultConfig,
  buildGamePlan,
  type HarnessEvent,
} from './index';

// ── Arg Parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
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

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  const projectPath = args['project'];
  const projectName = args['name'];
  const ueVersion = args['ue-version'] ?? '5.5';
  const maxIterations = parseInt(args['max-iterations'] ?? '100');
  const targetPassRate = parseInt(args['target-pass-rate'] ?? '90');
  const sessionTimeoutMs = parseInt(args['timeout'] ?? String(30 * 60 * 1000));
  const statePath = args['state-path']
    ? path.resolve(args['state-path'])
    : path.join(projectPath ?? '.', '.harness');
  const dryRun = args['dry-run'] === 'true';
  const themeDirective = args['theme'] ?? undefined;

  if (!projectPath || !projectName) {
    console.error(`
Usage: npx tsx src/lib/harness/run-harness.ts \\
  --project <ue5-project-path> \\
  --name <project-name> \\
  [--ue-version <version>] \\
  [--max-iterations <n>] \\
  [--target-pass-rate <0-100>] \\
  [--timeout <ms>] \\
  [--state-path <dir>] \\
  [--theme "<creative direction>"] \\
  [--dry-run]
`);
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              PoF Harness — Autonomous Game Builder          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`  Project:     ${projectName}`);
  console.log(`  Path:        ${projectPath}`);
  console.log(`  UE Version:  ${ueVersion}`);
  console.log(`  State:       ${statePath}`);
  console.log(`  Max Iter:    ${maxIterations}`);
  console.log(`  Target:      ${targetPassRate}% pass rate`);
  console.log(`  Timeout:     ${(sessionTimeoutMs / 60_000).toFixed(0)} min per session`);
  if (themeDirective) console.log(`  Theme:       ${themeDirective.slice(0, 60)}...`);
  console.log();

  const config = createDefaultConfig({
    projectPath,
    projectName,
    ueVersion,
    statePath,
    maxIterations,
    targetPassRate,
    themeDirective,
    executor: {
      sessionTimeoutMs,
      maxRetriesPerArea: 3,
      allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
      skipPermissions: true,
      bareMode: false,
    },
  });

  // Dry run: just show the plan
  if (dryRun) {
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

  // Create and start orchestrator
  const harness = createHarnessOrchestrator(config);

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
      case 'harness:guide-updated':
        console.log(`[${ts}] GUIDE — Phase ${event.step.phase}: ${event.step.label}`);
        break;
      case 'harness:learning':
        console.log(`[${ts}] LEARNED — ${event.learning}`);
        break;
      case 'harness:progress': {
        const rate = event.plan.totalFeatures > 0
          ? Math.round((event.plan.passingFeatures / event.plan.totalFeatures) * 100)
          : 0;
        console.log(`[${ts}] PROGRESS — ${event.plan.passingFeatures}/${event.plan.totalFeatures} (${rate}%)`);
        break;
      }
      case 'harness:error':
        console.error(`[${ts}] ERROR — ${event.error}${event.fatal ? ' (FATAL)' : ''}`);
        break;
      case 'harness:paused':
        console.log(`[${ts}] PAUSED — ${event.reason}`);
        break;
      case 'harness:completed': {
        const finalRate = event.plan.totalFeatures > 0
          ? Math.round((event.plan.passingFeatures / event.plan.totalFeatures) * 100)
          : 0;
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`COMPLETED — ${event.plan.passingFeatures}/${event.plan.totalFeatures} features passing (${finalRate}%)`);
        console.log(`Guide: ${statePath}/guide.md`);
        console.log(`Plan:  ${statePath}/game-plan.json`);
        console.log('═'.repeat(60));
        break;
      }
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

main();
