/**
 * Readiness inventory — the ONE worklist for the readiness campaign.
 *
 * Reports every registered pipeline step's rung on the production-readiness ladder
 * (R0–R5, `src/lib/status/readiness.ts`) by driving the REAL `buildSwimlane` +
 * `readinessOf` the /status map itself uses. It does not re-implement the grading:
 * if this script and the map ever disagree, that is a bug in one import, not two
 * opinions. Every fleet agent takes its targets from here.
 *
 * Reads SQLite directly (`~/.pof/pof.db`) so it needs no dev server.
 *
 *   npx tsx scripts/readiness/inventory.ts                    # summary + per-catalog table
 *   npx tsx scripts/readiness/inventory.ts --level R0         # only cells at R0
 *   npx tsx scripts/readiness/inventory.ts --engine Claude,Code
 *   npx tsx scripts/readiness/inventory.ts --state waiting    # reached|waiting|blocked
 *   npx tsx scripts/readiness/inventory.ts --json             # machine-readable (fleet dispatch)
 *   npx tsx scripts/readiness/inventory.ts --json --level R0 --engine Claude,Code
 */
import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { buildSwimlane, type StepMeta } from '@/lib/status/statusModel';
import { readinessOf, READINESS_NAME, LADDER, type ReadinessLevel } from '@/lib/status/readiness';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

const DB_PATH = process.env.POF_DB_PATH ?? join(homedir(), '.pof', 'pof.db');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

/** Read every artifact + verdict once. Column names mirror the two *-db.ts modules. */
function readTruth() {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const artifacts = (db.prepare('SELECT * FROM pipeline_artifacts').all() as Record<string, unknown>[]).map(
    (r): PipelineArtifact => ({
      catalogId: r.catalog_id as string,
      entityId: r.entity_id as string,
      step: r.step as string,
      data: JSON.parse((r.data as string) || '{}'),
      ueAssets: JSON.parse((r.ue_assets as string) || '[]'),
      status: r.status as PipelineArtifact['status'],
      ...(r.tier ? { tier: r.tier as PipelineArtifact['tier'] } : {}),
      ...(r.reason ? { reason: r.reason as string } : {}),
    }),
  );
  let verdicts: JudgeVerdict[] = [];
  try {
    verdicts = (db.prepare('SELECT * FROM judge_verdicts').all() as Record<string, unknown>[]).map(
      (r) =>
        ({
          catalogId: r.catalog_id as string,
          entityId: r.entity_id as string,
          step: r.step as string,
          judge: r.judge as JudgeVerdict['judge'],
          verdict: r.verdict as JudgeVerdict['verdict'],
          score: r.score as number,
          findings: (r.findings as string) ?? '',
          model: (r.model as string) ?? '',
          ...(r.effort ? { effort: r.effort as string } : {}),
          ...(r.rubric_version != null ? { rubricVersion: r.rubric_version as number } : {}),
          ...(r.judged_at ? { judgedAt: r.judged_at as string } : {}),
        }) as JudgeVerdict,
    );
  } catch {
    // judge_verdicts may not exist on a fresh DB — an unjudged map is a valid state.
  }
  db.close();
  return { artifacts, verdicts };
}

export interface InventoryRow {
  catalogId: string;
  step: string;
  engine: string;
  level: ReadinessLevel;
  state: 'reached' | 'waiting' | 'blocked';
  because: string;
  /** The acceptance tier, kept as evidence-class metadata (never a second rating). */
  tier?: string;
  judge?: string;
  checkerMeaningful?: boolean;
  counts: { pass: number; deferred: number; fail: number; pending: number };
  reason?: string;
}

export function buildInventory(): InventoryRow[] {
  const { artifacts, verdicts } = readTruth();
  const artByCatalog = new Map<string, PipelineArtifact[]>();
  for (const a of artifacts) {
    const l = artByCatalog.get(a.catalogId) ?? [];
    l.push(a);
    artByCatalog.set(a.catalogId, l);
  }
  const verByCatalog = new Map<string, JudgeVerdict[]>();
  for (const v of verdicts) {
    const l = verByCatalog.get(v.catalogId) ?? [];
    l.push(v);
    verByCatalog.set(v.catalogId, l);
  }

  const rows: InventoryRow[] = [];
  for (const p of allCatalogPipelines()) {
    const metas: StepMeta[] = p.steps.map((s) => ({ label: s.label, archetype: s.archetype, engine: s.engine }));
    const lane = buildSwimlane(
      p.catalogId,
      p.catalogId,
      metas,
      artByCatalog.get(p.catalogId) ?? [],
      verByCatalog.get(p.catalogId) ?? [],
    );
    for (const cell of lane.cells) {
      const r = readinessOf(cell);
      rows.push({
        catalogId: p.catalogId,
        step: cell.label,
        engine: cell.engine,
        level: r.level,
        state: r.state,
        because: r.because,
        ...(cell.tier ? { tier: cell.tier } : {}),
        ...(cell.judge ? { judge: cell.judge } : {}),
        ...(cell.checkerMeaningful !== undefined ? { checkerMeaningful: cell.checkerMeaningful } : {}),
        counts: cell.counts,
        ...(cell.reason ? { reason: cell.reason } : {}),
      });
    }
  }
  return rows;
}

function main() {
  let rows = buildInventory();
  const total = rows.length;

  const levelFilter = arg('level');
  const engineFilter = arg('engine');
  const stateFilter = arg('state');
  if (levelFilter) {
    const want = new Set(levelFilter.split(',').map((s) => s.trim()));
    rows = rows.filter((r) => want.has(r.level));
  }
  if (engineFilter) {
    const want = new Set(engineFilter.split(',').map((s) => s.trim().toLowerCase()));
    rows = rows.filter((r) => want.has(r.engine.toLowerCase()));
  }
  if (stateFilter) rows = rows.filter((r) => r.state === stateFilter);

  if (has('json')) {
    process.stdout.write(JSON.stringify({ total, matched: rows.length, rows }, null, 2));
    return;
  }

  const all = buildInventory();
  const byLevel = new Map<string, number>();
  const byState = new Map<string, number>();
  for (const r of all) {
    if (r.state === 'reached') byLevel.set(r.level, (byLevel.get(r.level) ?? 0) + 1);
    else byState.set(r.state, (byState.get(r.state) ?? 0) + 1);
  }

  const out: string[] = [];
  out.push(`READINESS LADDER — ${total} steps across ${allCatalogPipelines().length} pipelines`);
  out.push('');
  for (const level of [...LADDER].reverse()) {
    const n = byLevel.get(level) ?? 0;
    const pct = Math.round((n / Math.max(total, 1)) * 100);
    out.push(`  ${level} ${READINESS_NAME[level].padEnd(10)} ${String(n).padStart(4)}  ${'█'.repeat(Math.round(pct / 2))}${pct ? ` ${pct}%` : ''}`);
  }
  out.push(`  -- not rungs --`);
  out.push(`  ⋯  WAITING     ${String(byState.get('waiting') ?? 0).padStart(4)}  (gate declared, never run)`);
  out.push(`  ✕  BLOCKED     ${String(byState.get('blocked') ?? 0).padStart(4)}  (checker or judge condemned)`);
  out.push('');

  if (levelFilter || engineFilter || stateFilter) {
    out.push(`MATCHED ${rows.length} step(s)  [level=${levelFilter ?? '*'} engine=${engineFilter ?? '*'} state=${stateFilter ?? '*'}]`);
    out.push('');
    const byCatalog = new Map<string, InventoryRow[]>();
    for (const r of rows) {
      const l = byCatalog.get(r.catalogId) ?? [];
      l.push(r);
      byCatalog.set(r.catalogId, l);
    }
    for (const [catalogId, list] of [...byCatalog.entries()].sort((a, b) => b[1].length - a[1].length)) {
      out.push(`  ${catalogId}  (${list.length})`);
      for (const r of list) out.push(`      ${r.level}${r.state === 'waiting' ? '⋯' : r.state === 'blocked' ? '✕' : ' '} ${r.step.padEnd(28)} ${r.engine.padEnd(12)} ${r.because}`);
    }
  }
  process.stdout.write(out.join('\n') + '\n');
}

main();
