/**
 * A/B probe — does removing the two harness defects change judged scores?
 *
 * Arm A = today's harness (raw `data`, sibling projection with `includeNested` off).
 * Arm B = fixed (`stripNonContent(data)` + sibling projection with `includeNested` on).
 * Same content, same model/effort, drawn SEQUENTIALLY (parallel draws trip the API rate wall).
 * Records NOTHING to `judge_verdicts` — this is measurement only; the DB is opened readonly.
 *
 *   npx tsx scripts/judge/ab-probe.ts --n 12 --draws 1     # smoke test
 *   npx tsx scripts/judge/ab-probe.ts --n 20 --draws 3     # properly powered (median-of-3/arm)
 *
 * RESUMABLE: every completed cell is appended to `ab-results.json` immediately (not just at the
 * end), keyed on catalog+entity+step. On restart, any cell already present in that file is
 * skipped rather than re-drawn — a session-limit reset costs one cell, not the whole run. If a
 * limit hits mid-run, wait for reset and re-run the identical command.
 */
import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { buildRubricPrompt, parseJudgeResult } from '../../src/lib/judge/rubrics';
import { buildSiblingContext } from '../../src/lib/judge/siblingContext';
import { stripNonContent } from '../../src/lib/judge/payload';

const N = Number(process.argv[process.argv.indexOf('--n') + 1] ?? 12);
const DRAWS = Number(process.argv[process.argv.indexOf('--draws') + 1] ?? 1);
const RESULTS_PATH = 'ab-results.json';

interface Cell {
  catalogId: string;
  entityId: string;
  step: string;
  data: Record<string, unknown>;
}

/** One sampled cell's result. `cell` is the resumability key — it MUST be unique per row, so it
 *  carries entityId (not just catalog+step, which collides across the many entities that share a
 *  step name). */
interface ResultRow {
  cell: string;
  contaminated: boolean;
  armA: number | null;
  armB: number | null;
  delta: number | null;
}

interface ArtifactRow {
  catalog_id: string;
  entity_id: string;
  step: string;
  data: string;
}

function cellKey(c: Cell): string {
  return `${c.catalogId}::${c.entityId}::${c.step}`;
}

function load(): { cells: Cell[]; siblings: Map<string, Cell[]> } {
  // Readonly: the probe is measurement only and must never write to (or lock) the app's DB.
  const db = new Database(join(homedir(), '.pof', 'pof.db'), { readonly: true });
  const rows = db.prepare('SELECT catalog_id,entity_id,step,data FROM pipeline_artifacts').all() as ArtifactRow[];
  db.close();
  const all: Cell[] = rows.map((r) => ({
    catalogId: r.catalog_id,
    entityId: r.entity_id,
    step: r.step,
    data: (() => {
      try {
        return JSON.parse(r.data);
      } catch {
        return {};
      }
    })(),
  }));
  const siblings = new Map<string, Cell[]>();
  for (const c of all) {
    const k = `${c.catalogId}|${c.entityId}`;
    siblings.set(k, [...(siblings.get(k) ?? []), c]);
  }
  // Stratify: contaminated cells (carry `produceDirection` — arm A's suspected content leak)
  // first, then the remaining cells (clean controls, including whatever their sibling
  // projection looks like — some will project empty under today's harness).
  const contaminated = all.filter((c) => 'produceDirection' in c.data);
  const rest = all.filter((c) => !('produceDirection' in c.data));
  const pick = [...contaminated.slice(0, Math.ceil(N / 2)), ...rest.slice(0, Math.floor(N / 2))];
  return { cells: pick.slice(0, N), siblings };
}

/** Load a prior partial run, if any. A missing or corrupt file degrades to "start over" —
 *  never a crash — since resumability must never be the thing that breaks the probe. */
function loadPriorRows(): ResultRow[] {
  if (!existsSync(RESULTS_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as { rows?: ResultRow[] };
    return Array.isArray(parsed.rows) ? parsed.rows : [];
  } catch {
    return [];
  }
}

/** Recompute the mean and rewrite `ab-results.json`. Called after EVERY cell (not just once at
 *  the end) so a session-limit reset never costs more than the cell in flight. */
function persist(rows: ResultRow[]): number {
  const deltas = rows.map((r) => r.delta).filter((d): d is number => d != null);
  const mean = deltas.reduce((x, y) => x + y, 0) / (deltas.length || 1);
  writeFileSync(RESULTS_PATH, JSON.stringify({ mean, rows }, null, 2));
  return mean;
}

/** One judge draw for one arm. `fixed` selects arm B (strip + nested); arm A gets the raw
 *  payload and today's (non-nested) sibling projection, from the SAME shared functions — so the
 *  only variable between arms is the fix itself, nothing else about the prompt. */
async function judge(cell: Cell, sibs: Cell[], fixed: boolean): Promise<number | null> {
  const data = fixed ? stripNonContent(cell.data) : cell.data;
  const steps = sibs.filter((s) => s.step !== cell.step).map((s) => ({ step: s.step, data: s.data }));
  const siblingContext = buildSiblingContext(steps, cell.step, { includeNested: fixed }) || undefined;
  const prompt = buildRubricPrompt('text-config', {
    subject: `${cell.catalogId} / ${cell.entityId} / ${cell.step}`,
    payload: '```json\n' + JSON.stringify(data, null, 2) + '\n```',
    siblingContext,
  });
  const { runClaudeJudge } = await import('./abRunner');
  const raw = await runClaudeJudge(prompt);
  return parseJudgeResult(raw)?.score ?? null;
}

async function main() {
  const { cells, siblings } = load();
  const out: ResultRow[] = loadPriorRows();
  const done = new Set(out.map((r) => r.cell));

  for (const c of cells) {
    const key = cellKey(c);
    if (done.has(key)) {
      process.stdout.write(`${key.padEnd(60)} SKIP (already recorded)\n`);
      continue;
    }
    const sibs = siblings.get(`${c.catalogId}|${c.entityId}`) ?? [];
    const a: number[] = [];
    const b: number[] = [];
    // Sequential, arm by arm, draw by draw — no Promise.all. Parallel draws trip the API rate
    // wall, and median-of-N needs every draw to land before it can pick the middle one anyway.
    for (let i = 0; i < DRAWS; i++) {
      const s = await judge(c, sibs, false);
      if (s != null) a.push(s);
    }
    for (let i = 0; i < DRAWS; i++) {
      const s = await judge(c, sibs, true);
      if (s != null) b.push(s);
    }
    const med = (xs: number[]) => (xs.length ? [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)] : null);
    const armA = med(a);
    const armB = med(b);
    const row: ResultRow = {
      cell: key,
      contaminated: 'produceDirection' in c.data,
      armA,
      armB,
      delta: armA != null && armB != null ? armB - armA : null,
    };
    out.push(row);
    process.stdout.write(`${row.cell.padEnd(60)} A=${row.armA} B=${row.armB} Δ=${row.delta}\n`);
    persist(out); // resumable: written after EVERY cell, not just at the end
  }

  const mean = persist(out);
  const deltas = out.map((r) => r.delta).filter((d): d is number => d != null);
  process.stdout.write(`\nmean delta (B - A): ${mean.toFixed(1)} over ${deltas.length} cells\n`);
}
main();
