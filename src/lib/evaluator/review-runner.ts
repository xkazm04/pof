/**
 * Capped, dry-run-by-default `review:module <id>` runner for the Feature Matrix.
 *
 * It is an HTTP client of the running app's own door, POST /api/feature-matrix/batch-review
 * with `moduleIds: [<id>]`: the app builds the featureReview prompt, runs the CLI and
 * writes the DB through its /api/feature-matrix/import callback — this file re-implements
 * none of that. All I/O is injected (`fetch`, clock, sleep, env, log) so the whole decision
 * order is testable without a network; the CLI entry is `scripts/review-module.mjs`.
 *
 * Pure of the `@/` alias and free of top-level side effects so Node can load it directly.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

/** Reviews one calendar day may start; each one spends a full CLI run. */
export const DAILY_REVIEW_CAP = 3;
/** How long to poll a started review before reporting a timeout (mirrors UI_TIMEOUTS.batchReviewTimeout). */
export const REVIEW_TIMEOUT_MS = 10 * 60 * 1000;
export const REVIEW_POLL_MS = 5_000;
export const DEFAULT_ORIGIN = 'http://localhost:3000';

const ROUTE = '/api/feature-matrix/batch-review';

export const USAGE = `usage: review:module <moduleId> --project-path <path> --ue-version <ver> [options]

  --project-path <path>   UE project the review is ABOUT (required)
  --ue-version <ver>      e.g. 5.7.3 (required)
  --project-name <name>   default: basename of the project path
  --origin <url>          running PoF app (default ${DEFAULT_ORIGIN})
  --write                 actually start the review (default: dry-run, prints the plan only)
  --ledger <path>         daily-cap ledger (default ~/.pof/review-runner-ledger.json, or env POF_REVIEW_LEDGER)
  --help                  this text`;

// ── args ──

export interface RunnerOptions {
  moduleId: string;
  projectPath: string;
  ueVersion: string;
  projectName: string;
  origin: string;
  write: boolean;
  ledgerPath: string;
}

export type ParsedArgs =
  | { ok: true; options: RunnerOptions }
  | { ok: false; help: boolean; error: string };

const VALUE_FLAGS = ['--project-path', '--ue-version', '--project-name', '--origin', '--ledger'] as const;

export function parseArgs(argv: readonly string[], env: Record<string, string | undefined> = {}): ParsedArgs {
  const values = new Map<string, string>();
  const positional: string[] = [];
  let write = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { ok: false, help: true, error: '' };
    if (a === '--write') {
      write = true;
    } else if ((VALUE_FLAGS as readonly string[]).includes(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return { ok: false, help: false, error: `${a} needs a value` };
      values.set(a, v);
      i++;
    } else if (a.startsWith('--')) {
      return { ok: false, help: false, error: `unknown option ${a}` };
    } else {
      positional.push(a);
    }
  }
  if (positional.length === 0) return { ok: false, help: false, error: 'missing module id' };
  if (positional.length > 1) return { ok: false, help: false, error: `one module id per run, got: ${positional.join(' ')}` };
  const projectPath = values.get('--project-path');
  if (!projectPath) return { ok: false, help: false, error: 'missing --project-path' };
  const ueVersion = values.get('--ue-version');
  if (!ueVersion) return { ok: false, help: false, error: 'missing --ue-version' };
  return {
    ok: true,
    options: {
      moduleId: positional[0],
      projectPath,
      ueVersion,
      // Split on both separators: a Windows path is not a basename on a POSIX host.
      projectName: values.get('--project-name') ?? (projectPath.split(/[\\/]+/).filter(Boolean).pop() ?? basename(projectPath)),
      origin: (values.get('--origin') ?? DEFAULT_ORIGIN).replace(/\/+$/, ''),
      write,
      ledgerPath: values.get('--ledger') ?? env.POF_REVIEW_LEDGER ?? join(homedir(), '.pof', 'review-runner-ledger.json'),
    },
  };
}

// ── daily-cap ledger ──

export interface LedgerRun {
  moduleId: string;
  batchId: string;
  at: string;
}

export interface Ledger {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  count: number;
  runs: LedgerRun[];
}

/** The local calendar day of `d` as YYYY-MM-DD. */
export function localDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's ledger: count 0 for a missing file or another day. A file that exists but is
 *  not a ledger THROWS — a cap that cannot read its count must not read it as zero. */
export function readLedger(path: string, today: string): Ledger {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { date: today, count: 0, runs: [] };
    throw e;
  }
  const parsed = JSON.parse(raw) as Partial<Ledger> | null;
  if (!parsed || typeof parsed.date !== 'string' || typeof parsed.count !== 'number' || !Array.isArray(parsed.runs)) {
    throw new Error(`ledger ${path} is not a review-runner ledger`);
  }
  if (parsed.date !== today) return { date: today, count: 0, runs: [] };
  return { date: parsed.date, count: parsed.count, runs: parsed.runs };
}

/** Count one started review: re-reads the file, count = previous + 1 (1 on a new day), writes it back. */
export function recordReview(path: string, today: string, entry: LedgerRun): Ledger {
  const prev = readLedger(path, today);
  const next: Ledger = { date: today, count: prev.count + 1, runs: [...prev.runs, entry] };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

// ── app probe ──

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

interface ModuleProgressLike {
  moduleId: string;
  status: string;
  error: string | null;
}
interface BatchLike {
  batchId: string;
  status: string;
  modules: ModuleProgressLike[];
}

export interface AppProbe {
  up: boolean;
  running: boolean;
  batch: BatchLike | null;
}

/** GET the batch route: `up` = it answered 2xx with the app's envelope. */
export async function probeApp(origin: string, fetchImpl: FetchLike): Promise<AppProbe> {
  try {
    const res = await fetchImpl(`${origin}${ROUTE}`);
    if (!res.ok) return { up: false, running: false, batch: null };
    const body = (await res.json()) as { success?: boolean; data?: { batch?: BatchLike | null } };
    if (!body || body.success !== true) return { up: false, running: false, batch: null };
    const batch = body.data?.batch ?? null;
    return { up: true, running: batch?.status === 'running', batch };
  } catch {
    return { up: false, running: false, batch: null };
  }
}

// ── runner ──

export interface RunnerDeps {
  fetch: FetchLike;
  now: () => Date;
  env: Record<string, string | undefined>;
  log: (line: string) => void;
  sleep: (ms: number) => Promise<void>;
  timeoutMs?: number;
  pollMs?: number;
}

export interface RunOutcome {
  ok: boolean;
  kind: 'dry-run' | 'reviewed' | 'refused' | 'failed' | 'timeout';
  message: string;
  batchId?: string;
}

export async function runReview(opts: RunnerOptions, deps: RunnerDeps): Promise<RunOutcome> {
  const finish = (outcome: RunOutcome): RunOutcome => {
    deps.log(`${outcome.ok ? 'ok' : outcome.kind}: ${outcome.message}`);
    return outcome;
  };
  const refuse = (message: string) => finish({ ok: false, kind: 'refused', message });

  if (deps.env.VITEST || deps.env.NODE_ENV === 'test') {
    return refuse('the runner never runs in the test suite');
  }

  const probe = await probeApp(opts.origin, deps.fetch);
  if (!probe.up) return refuse(`the PoF app is not up at ${opts.origin} (start it first; the runner only talks to its batch-review route)`);
  if (probe.running) return refuse(`a batch review is already running (${probe.batch?.batchId ?? 'unknown batch'})`);

  const today = localDay(deps.now());
  let ledger: Ledger;
  try {
    ledger = readLedger(opts.ledgerPath, today);
  } catch (e) {
    return refuse(`cannot read the review ledger: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (ledger.count >= DAILY_REVIEW_CAP) {
    return refuse(`daily cap reached: ${ledger.count} / ${DAILY_REVIEW_CAP} reviews started on ${today}`);
  }

  if (!opts.write) {
    deps.log([
      'dry-run (pass --write to start the review):',
      `  module:       ${opts.moduleId}`,
      `  project path: ${opts.projectPath}`,
      `  ue version:   ${opts.ueVersion}`,
      `  app:          ${opts.origin}`,
      `  today:        ${ledger.count} / ${DAILY_REVIEW_CAP}`,
    ].join('\n'));
    return { ok: true, kind: 'dry-run', message: `would review ${opts.moduleId} (${ledger.count} / ${DAILY_REVIEW_CAP} used today)` };
  }

  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await deps.fetch(`${opts.origin}${ROUTE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectPath: opts.projectPath,
        projectName: opts.projectName,
        ueVersion: opts.ueVersion,
        appOrigin: opts.origin,
        moduleIds: [opts.moduleId],
      }),
    });
  } catch (e) {
    return finish({ ok: false, kind: 'failed', message: `could not start the review: ${e instanceof Error ? e.message : String(e)}` });
  }

  const body = (await res.json().catch(() => null)) as { success?: boolean; error?: string; data?: { batchId?: string } } | null;
  if (!res.ok) {
    return finish({ ok: false, kind: 'failed', message: `the app refused the review (HTTP ${res.status}): ${body?.error ?? 'no reason given'} — not counted` });
  }

  // A 2xx means the app started a CLI run. Count it before polling so a crash mid-review
  // still spends the cap; a 2xx without a batchId is counted too (spend fails closed).
  const batchId = body?.data?.batchId ?? 'unknown';
  const ledgerNow = recordReview(opts.ledgerPath, today, { moduleId: opts.moduleId, batchId, at: deps.now().toISOString() });
  deps.log(`started ${batchId} for ${opts.moduleId} (${ledgerNow.count} / ${DAILY_REVIEW_CAP} used today)`);
  if (!body?.data?.batchId) {
    return finish({ ok: false, kind: 'failed', message: 'the app answered 2xx without a batchId; counted, but the review cannot be followed' });
  }

  const timeoutMs = deps.timeoutMs ?? REVIEW_TIMEOUT_MS;
  const pollMs = deps.pollMs ?? REVIEW_POLL_MS;
  const deadline = deps.now().getTime() + timeoutMs;
  for (;;) {
    const { up, batch } = await probeApp(opts.origin, deps.fetch);
    if (up && batch && batch.batchId !== batchId) {
      return finish({ ok: false, kind: 'failed', batchId, message: `batch ${batchId} was replaced by ${batch.batchId}; its outcome is unknown` });
    }
    const mod = up ? batch?.modules.find((m) => m.moduleId === opts.moduleId) : undefined;
    if (mod?.status === 'completed') {
      return finish({ ok: true, kind: 'reviewed', batchId, message: `${opts.moduleId} reviewed (batch ${batchId}); the app wrote the result through /api/feature-matrix/import` });
    }
    if (mod?.status === 'error' || mod?.status === 'skipped') {
      return finish({ ok: false, kind: 'failed', batchId, message: `${opts.moduleId} review ${mod.status === 'error' ? 'failed' : 'was skipped'}: ${mod.error ?? 'no reason given'}` });
    }
    if (batch && batch.status !== 'running') {
      return finish({ ok: false, kind: 'failed', batchId, message: `batch ${batchId} ended ${batch.status} before ${opts.moduleId} completed` });
    }
    if (deps.now().getTime() >= deadline) {
      return finish({ ok: false, kind: 'timeout', batchId, message: `no result after ${Math.round(timeoutMs / 60000)} min; the review may still be running in the app (batch ${batchId})` });
    }
    await deps.sleep(pollMs);
  }
}
