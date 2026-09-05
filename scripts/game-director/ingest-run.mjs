#!/usr/bin/env node
/**
 * Ingest a REAL harness run into the Game Director as an `external` session.
 *
 *   node scripts/game-director/ingest-run.mjs <state-dir-or-run.json> [options]
 *
 * The run record is the harness run state pair the harness already writes:
 * a directory containing `game-plan.json` + `progress.json` (e.g. `.harness-dzin/`),
 * or a single JSON file shaped `{ "plan": {...}, "progress": [...] }`.
 *
 * Options:
 *   --origin <url>     App origin (default: http://localhost:3001, PoF's dev port)
 *   --name <text>      Session name (default: derived from the build identity)
 *   --project <path>   Project the session is scoped to (used by the matrix write-back)
 *   --dry-run          Print what would be posted; write nothing
 *
 * This script deliberately holds NO mapping logic. It reads the files and POSTs
 * `{ action: 'ingest-external', run }` to `/api/game-director`; the route runs
 * `ingestExternalPlaytest` so the run→session contract has exactly one
 * implementation. A record that fails the session contract comes back as a 400
 * with the reason, and nothing is written.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

function fail(message) {
  console.error(`ingest-run: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { origin: 'http://localhost:3001', dryRun: false };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--origin') args.origin = argv[++i];
    else if (arg === '--name') args.name = argv[++i];
    else if (arg === '--project') args.project = argv[++i];
    else if (arg === '--dry-run') args.dryRun = true;
    else rest.push(arg);
  }
  args.target = rest[0];
  return args;
}

function readRunRecord(target) {
  if (!existsSync(target)) fail(`no such path: ${target}`);
  if (statSync(target).isDirectory()) {
    const planPath = join(target, 'game-plan.json');
    const progressPath = join(target, 'progress.json');
    for (const p of [planPath, progressPath]) {
      if (!existsSync(p)) fail(`${target} is not a harness state dir — missing ${p}`);
    }
    return {
      plan: JSON.parse(readFileSync(planPath, 'utf-8')),
      progress: JSON.parse(readFileSync(progressPath, 'utf-8')),
    };
  }
  const parsed = JSON.parse(readFileSync(target, 'utf-8'));
  if (!parsed || typeof parsed !== 'object' || !parsed.plan || !parsed.progress) {
    fail(`${target} is not a run record — expected { "plan": {...}, "progress": [...] }`);
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.target) {
    fail('usage: node scripts/game-director/ingest-run.mjs <state-dir-or-run.json> [--origin url] [--name text] [--project path] [--dry-run]');
  }

  const run = readRunRecord(args.target);
  const entries = Array.isArray(run.progress) ? run.progress.length : 0;
  console.log(`Read run record from ${args.target}: build "${run.plan?.game}" @ UE ${run.plan?.ueVersion}, ${entries} recorded iteration(s).`);

  if (args.dryRun) {
    console.log('--dry-run: nothing was posted. The route would run ingestExternalPlaytest over this record.');
    return;
  }

  const url = `${args.origin.replace(/\/$/, '')}/api/game-director`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'ingest-external',
      run,
      sessionName: args.name,
      projectId: args.project,
    }),
  }).catch((error) => fail(`POST ${url} failed: ${error.message} (is the app running on that origin?)`));

  const payload = await response.json().catch(() => null);
  if (!payload || payload.success !== true) {
    fail(`refused (${response.status}): ${payload?.error ?? 'no envelope in the response'}`);
  }

  const data = payload.data;
  console.log(`Ingested as session ${data.sessionId} — source: external.`);
  console.log(`  build identity : ${data.contract.buildId}`);
  console.log(`  world identity : ${data.contract.worldIdentity ?? 'NOT RECORDED by this run'}`);
  console.log(`  findings       : ${data.findingsWritten}`);
  console.log(`  timeline events: ${data.eventsWritten}`);
  console.log(`  unrouted       : ${data.unrouted.length} (routing-table misses, not filed under a default bucket)`);
  console.log(`  refused        : ${data.rejected.length} (no evidence pointer — a finding without a repro is a rumour)`);
  console.log(`  score          : ${data.overallScore} (pass ratio over the plan's own features; no other quantity folded in)`);
}

main().catch((error) => fail(error?.stack ?? String(error)));
