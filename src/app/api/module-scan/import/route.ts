import { NextRequest } from 'next/server';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
import { reconcileScan } from '@/lib/evaluator/scan-reconcile';
import { EVAL_PASS_VOCABULARY, type EvalPass } from '@/lib/evaluator/module-eval-prompts';
import { ensureEvalFindingsPassVocabularyOnce } from '@/lib/evaluator/scan-findings-db';
import type { ScanDelta, ScanFinding, ScanRecord } from '@/types/scan';

/** The one pass vocabulary — the same list the eval_findings CHECK is kept equal to. */
const passSchema = z.enum(EVAL_PASS_VOCABULARY);

const findingSchema = z.object({
  pass: passSchema,
  category: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  file: z.string().nullable().default(null),
  line: z.number().nullable().default(null),
  description: z.string().min(1),
  suggestedFix: z.string().default(''),
  effort: z.enum(['trivial', 'small', 'medium', 'large']).default('medium'),
});

const importSchema = z.object({
  moduleId: z.string().min(1),
  /** Injected by the scan callback's staticFields. Absent (a legacy caller) → the
   *  passes the findings name, so an unreported pass never clears anything. */
  passes: z.array(passSchema).optional(),
  findings: z.array(findingSchema),
});

const resolveSchema = z.object({
  moduleId: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1).max(1000),
  resolved: z.boolean(),
});

/** A scan id no earlier scan (recorded, or legacy findings-only) already uses. */
function mintScanId(db: Database.Database, moduleId: string): string {
  const base = `scan-${moduleId}-${Date.now()}`;
  const taken = db.prepare(
    'SELECT 1 FROM module_scans WHERE scan_id = ? UNION ALL SELECT 1 FROM eval_findings WHERE scan_id = ? LIMIT 1',
  );
  let id = base;
  for (let n = 1; taken.get(id, id); n++) id = `${base}-${n}`;
  return id;
}

/**
 * POST — Claude submits a scan's findings via the callback. Validates, then
 * writes the findings AND one module_scans row in a single transaction — a
 * clean scan (zero findings) is recorded too, so it can be told apart from a
 * lost report.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = importSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(`Invalid scan data: ${parsed.error.issues.map((i) => i.message).join(', ')}`, 400);
  }

  const { moduleId, findings } = parsed.data;
  const passes = parsed.data.passes ?? [...new Set(findings.map((f) => f.pass))];
  const now = new Date().toISOString();

  const db = getDb();
  // A DB created before ground-truth/combat-trace existed still carries the 3-pass
  // CHECK, which INSERT OR IGNORE would silently swallow a finding against.
  ensureEvalFindingsPassVocabularyOnce(db);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO eval_findings
      (id, scan_id, module_id, pass, category, severity, file, line, description, suggested_fix, effort, created_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertScan = db.prepare(
    'INSERT INTO module_scans (scan_id, module_id, passes_json, finding_count, created_at) VALUES (?, ?, ?, ?, ?)',
  );

  const { scanId, enriched } = db.transaction(() => {
    const id = mintScanId(db, moduleId);
    const rows = findings.flatMap((f, i) => {
      const fid = `${id}-${i}`;
      const stored = insert.run(fid, id, moduleId, f.pass, f.category, f.severity, f.file, f.line, f.description, f.suggestedFix, f.effort, now);
      return stored.changes > 0 ? [{ ...f, id: fid, scanId: id, foundAt: now }] : [];
    });
    // finding_count is the rows actually stored, never the rows submitted.
    insertScan.run(id, moduleId, JSON.stringify(passes), rows.length, now);
    return { scanId: id, enriched: rows };
  })();

  return apiSuccess({
    moduleId,
    scanId,
    passes,
    imported: enriched.length,
    findings: enriched,
  });
}, 'Failed to import scan findings');

interface EvalFindingRow {
  id: string;
  scan_id: string;
  module_id: string;
  /** Guaranteed by the table CHECK, which ensureEvalFindingsPassVocabulary keeps equal to EVAL_PASS_VOCABULARY. */
  pass: EvalPass;
  category: string;
  severity: string;
  file: string | null;
  line: number | null;
  description: string;
  suggested_fix: string;
  effort: string;
  created_at: string;
  resolved_at: string | null;
}

interface ModuleScanRow {
  scan_id: string;
  module_id: string;
  passes_json: string;
  finding_count: number;
  created_at: string;
}

function toFinding(r: EvalFindingRow): ScanFinding {
  return {
    id: r.id,
    pass: r.pass,
    category: r.category,
    severity: r.severity as ScanFinding['severity'],
    file: r.file,
    line: r.line,
    description: r.description,
    suggestedFix: r.suggested_fix,
    effort: r.effort as ScanFinding['effort'],
    foundAt: r.created_at,
    scanId: r.scan_id,
    ...(r.resolved_at ? { resolvedAt: r.resolved_at } : {}),
  };
}

function toScanRecord(r: ModuleScanRow): ScanRecord {
  let passes: EvalPass[] = [];
  try {
    const parsed: unknown = JSON.parse(r.passes_json);
    if (Array.isArray(parsed)) passes = parsed as EvalPass[];
  } catch { /* a malformed row covers no pass — it clears nothing */ }
  return { scanId: r.scan_id, moduleId: r.module_id, passes, findingCount: r.finding_count, createdAt: r.created_at };
}

/**
 * The newest recorded scan reconciled against the findings still unresolved
 * before it. `null` when the module has no recorded scan.
 */
function computeDelta(db: Database.Database, moduleId: string): ScanDelta | null {
  const scanRow = db.prepare(
    'SELECT * FROM module_scans WHERE module_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
  ).get(moduleId) as ModuleScanRow | undefined;
  if (!scanRow) return null;
  const scan = toScanRecord(scanRow);

  const latest = (db.prepare('SELECT * FROM eval_findings WHERE scan_id = ?')
    .all(scan.scanId) as EvalFindingRow[]).map(toFinding);
  const prior = (db.prepare(
    `SELECT * FROM eval_findings
     WHERE module_id = ? AND scan_id != ? AND resolved_at IS NULL AND created_at <= ?
     ORDER BY created_at DESC LIMIT 1000`,
  ).all(moduleId, scan.scanId, scan.createdAt) as EvalFindingRow[]).map(toFinding);

  const r = reconcileScan(prior, { passes: scan.passes, findings: latest });
  const ids = (xs: ScanFinding[]) => xs.map((f) => f.id);
  return {
    scan,
    prior: ids(prior),
    new: ids(r.new),
    persisting: ids(r.persisting),
    cleared: ids(r.cleared),
    notRescanned: ids(r.notRescanned),
  };
}

/**
 * GET — Persisted scan findings for a module, each with its durable resolvedAt.
 * Query params: moduleId (required), limit (optional, default 200),
 * view=delta (optional) — also returns the latest scan's reconciled delta.
 */
export const GET = withRoute(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get('moduleId');
  if (!moduleId) {
    return apiError('moduleId query parameter is required', 400);
  }

  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 1000);

  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM eval_findings WHERE module_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(moduleId, limit) as EvalFindingRow[];

  const findings = rows.map(toFinding);
  if (searchParams.get('view') === 'delta') {
    return apiSuccess({ moduleId, findings, delta: computeDelta(db, moduleId) });
  }
  return apiSuccess({ moduleId, findings });
}, 'Failed to fetch scan findings');

/**
 * PATCH — Resolve (or, with resolved:false, un-resolve) findings durably.
 * Body: { moduleId, ids, resolved }. Ids that do not belong to the module are
 * reported back in `missing` rather than silently dropped.
 */
export const PATCH = withRoute(async (req: NextRequest) => {
  const parsed = resolveSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError(`Invalid resolve request: ${parsed.error.issues.map((i) => i.message).join(', ')}`, 400);
  }
  const { moduleId, ids, resolved } = parsed.data;
  const stamp = resolved ? new Date().toISOString() : null;

  const db = getDb();
  const update = db.prepare('UPDATE eval_findings SET resolved_at = ? WHERE module_id = ? AND id = ?');
  const missing = db.transaction(() => ids.filter((id) => update.run(stamp, moduleId, id).changes === 0))();

  return apiSuccess({ moduleId, updated: ids.length - missing.length, missing, resolvedAt: stamp });
}, 'Failed to update scan findings');
