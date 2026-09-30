/**
 * The ONE owner of a project's `project_progress` row — its id, its merge, and
 * its completion ledger. `/api/project-progress` (the client autosave),
 * `/api/checklist/complete` (the CLI) and `/api/recent-projects` (the switcher)
 * are thin callers; none of them hashes a path or merges a blob itself.
 *
 * - **Id.** `progressRowId(path) = sha256(normalizeProjectId(path)).slice(0,16)`.
 *   For every canonical spelling that equals the legacy per-route hash, so no
 *   existing row is re-keyed; `C:/x/PoF/` and `c:\x\pof` now share one row.
 * - **Legacy fold.** A row stored under the legacy hash of a NON-canonical
 *   spelling (e.g. a trailing slash) is still returned for that spelling: a read
 *   projects it into the result, a write copies it into the canonical row and
 *   records its id in `folded_json`, so it is folded exactly once. Lossless: a
 *   `true` mark is never overwritten by `false`, the earliest stamp wins, and the
 *   legacy row itself is never deleted or rewritten.
 * - **One merge.** Per-key checklist (keys the caller does not send are kept),
 *   orphan-key migration on EVERY write, the earliest-wins ledger pruned to done
 *   items (un-done drops the date), keep-or-replace for health/verification/history.
 */
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { normalizeProjectId } from '@/lib/project-id';
import { migrateProgressBlob, describeMigrations, type BlobMigration } from '@/lib/checklist-progress-keys';
import {
  mergeLedgers,
  pruneLedger,
  stampCompletion,
  type ChecklistProgress,
  type CompletionLedger,
} from '@/lib/roadmap/completion-ledger';
import { logger } from '@/lib/logger';

type Blob = Record<string, unknown>;

export interface ProjectProgress {
  checklistProgress: ChecklistProgress;
  checklistCompletedAt: CompletionLedger;
  moduleHealth: Blob;
  checklistVerification: Blob;
  moduleHistory: Blob;
}

export type ProgressWrite = Partial<ProjectProgress>;

interface ProgressRow {
  checklist_json: string;
  health_json: string;
  verification_json: string;
  history_json: string;
  completed_json: string;
  folded_json: string;
}

const hash16 = (s: string) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

/** The row id of a project's progress — the one spelling every surface keys on. */
export function progressRowId(projectPath: string): string {
  return hash16(normalizeProjectId(projectPath));
}

/** The id the three routes used to derive privately (no trim, no trailing-slash strip). */
export function legacyProgressRowId(projectPath: string): string {
  return hash16(projectPath.toLowerCase().replace(/\\/g, '/'));
}

function parseObject<T extends object>(json: string | undefined, fallback: T): T {
  try {
    const v: unknown = JSON.parse(json ?? '');
    return v && typeof v === 'object' ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

const isNonEmptyObject = (v: unknown): v is Blob =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0;

/** Union of two stored checklists of the same project: a `true` from either side wins. */
function foldChecklists(a: ChecklistProgress, b: ChecklistProgress): ChecklistProgress {
  const out: ChecklistProgress = {};
  for (const src of [a, b]) {
    for (const [mod, items] of Object.entries(src)) {
      if (!items || typeof items !== 'object') continue;
      const into = (out[mod] ??= {});
      for (const [item, done] of Object.entries(items)) into[item] = into[item] === true || done === true;
    }
  }
  return out;
}

/** Move a stamp recorded under an orphan key to the key its checklist mark moved to. */
function migrateLedger(ledger: CompletionLedger, migrations: BlobMigration[]): CompletionLedger {
  if (migrations.length === 0) return ledger;
  let out = ledger;
  for (const { moduleId, from, to } of migrations) {
    const at = out[moduleId]?.[from];
    if (at === undefined) continue;
    const rest = { ...out[moduleId] };
    delete rest[from];
    out = mergeLedgers({ ...out, [moduleId]: rest }, { [moduleId]: { [to]: at } });
  }
  return out;
}

interface Loaded {
  id: string;
  exists: boolean;
  folded: string[];
  progress: ProjectProgress;
}

/** Read the canonical row plus any not-yet-folded legacy row for this spelling. */
function load(projectPath: string): Loaded {
  const db = getDb();
  const id = progressRowId(projectPath);
  const legacyId = legacyProgressRowId(projectPath);
  const select = db.prepare('SELECT * FROM project_progress WHERE project_id = ?');
  const own = select.get(id) as ProgressRow | undefined;
  const folded = parseObject<string[]>(own?.folded_json, []);
  const legacy =
    legacyId !== id && !folded.includes(legacyId) ? (select.get(legacyId) as ProgressRow | undefined) : undefined;

  const rows = [own, legacy].filter((r): r is ProgressRow => !!r);
  const firstNonEmpty = (col: 'health_json' | 'verification_json' | 'history_json'): Blob =>
    rows.map((r) => parseObject<Blob>(r[col], {})).find(isNonEmptyObject) ?? {};

  return {
    id,
    exists: rows.length > 0,
    folded: legacy ? [...folded, legacyId] : folded,
    progress: {
      checklistProgress: rows.reduce<ChecklistProgress>(
        (acc, r) => foldChecklists(acc, parseObject<ChecklistProgress>(r.checklist_json, {})),
        {},
      ),
      checklistCompletedAt: rows.reduce<CompletionLedger>(
        (acc, r) => mergeLedgers(acc, parseObject<CompletionLedger>(r.completed_json, {})),
        {},
      ),
      moduleHealth: firstNonEmpty('health_json'),
      checklistVerification: firstNonEmpty('verification_json'),
      moduleHistory: firstNonEmpty('history_json'),
    },
  };
}

/** Orphan keys projected onto real checklist ids, with the ledger following its marks. */
function migrated(checklist: ChecklistProgress, ledger: CompletionLedger) {
  const { progress, migrations } = migrateProgressBlob(checklist);
  return { progress, ledger: migrateLedger(ledger, migrations), keys: describeMigrations(migrations) };
}

function write(id: string, p: ProjectProgress, folded: string[]): void {
  getDb()
    .prepare(
      `INSERT INTO project_progress (project_id, checklist_json, health_json, verification_json, history_json, completed_json, folded_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(project_id) DO UPDATE SET
         checklist_json = excluded.checklist_json, health_json = excluded.health_json,
         verification_json = excluded.verification_json, history_json = excluded.history_json,
         completed_json = excluded.completed_json, folded_json = excluded.folded_json,
         updated_at = datetime('now')`,
    )
    .run(
      id,
      JSON.stringify(p.checklistProgress),
      JSON.stringify(p.moduleHealth),
      JSON.stringify(p.checklistVerification),
      JSON.stringify(p.moduleHistory),
      JSON.stringify(pruneLedger(p.checklistCompletedAt, p.checklistProgress)),
      JSON.stringify(folded),
    );
}

/**
 * A project's progress as every surface should see it: orphan keys projected onto
 * their real ids (read-only — persisted by the next write), the ledger pruned to
 * done items. `exists` is false when no row (canonical or legacy) holds anything.
 * `quiet` skips the orphan-projection warning (a list read of many projects).
 */
export function readProgress(
  projectPath: string,
  opts: { quiet?: boolean } = {},
): ProjectProgress & { exists: boolean } {
  const { exists, progress } = load(projectPath);
  const m = migrated(progress.checklistProgress, progress.checklistCompletedAt);
  if (m.keys.length > 0 && !opts.quiet) logger.warn(`project-progress: projected orphan progress keys — ${m.keys.join('; ')}`);
  return {
    ...progress,
    checklistProgress: m.progress,
    checklistCompletedAt: pruneLedger(m.ledger, m.progress),
    exists,
  };
}

/**
 * The one merge. Absent/empty health, verification or history never clears the
 * stored blob (an emptied client store is not a "delete" intent). Returns the
 * orphan keys migrated on this write.
 */
export function saveProgress(projectPath: string, incoming: ProgressWrite): string[] {
  return getDb().transaction((): string[] => {
    const l = load(projectPath);
    const stored = migrated(l.progress.checklistProgress, l.progress.checklistCompletedAt);
    const sent = migrated(incoming.checklistProgress ?? {}, incoming.checklistCompletedAt ?? {});
    const checklist: ChecklistProgress = { ...stored.progress };
    for (const [mod, items] of Object.entries(sent.progress)) checklist[mod] = { ...(checklist[mod] ?? {}), ...(items ?? {}) };
    const keep = (sentBlob: unknown, storedBlob: Blob): Blob => (isNonEmptyObject(sentBlob) ? sentBlob : storedBlob);
    write(l.id, {
      checklistProgress: checklist,
      checklistCompletedAt: mergeLedgers(stored.ledger, sent.ledger),
      moduleHealth: keep(incoming.moduleHealth, l.progress.moduleHealth),
      checklistVerification: keep(incoming.checklistVerification, l.progress.checklistVerification),
      moduleHistory: keep(incoming.moduleHistory, l.progress.moduleHistory),
    }, l.folded);
    return stored.keys;
  })();
}

/**
 * Mark one (already validated) checklist item done. A first completion is stamped
 * `at`; an item that was already done keeps its stamp — or stays UNDATED, since
 * re-marking it says nothing about when it was first finished. Returns the orphan
 * keys migrated on this write.
 */
export function markComplete(projectPath: string, moduleId: string, itemId: string, at: number): string[] {
  return getDb().transaction((): string[] => {
    const l = load(projectPath);
    const m = migrated(l.progress.checklistProgress, l.progress.checklistCompletedAt);
    const wasDone = m.progress[moduleId]?.[itemId] === true;
    const checklist = { ...m.progress, [moduleId]: { ...(m.progress[moduleId] ?? {}), [itemId]: true } };
    const ledger = !wasDone && Number.isFinite(at) ? stampCompletion(m.ledger, moduleId, itemId, true, at) : m.ledger;
    write(l.id, { ...l.progress, checklistProgress: checklist, checklistCompletedAt: ledger }, l.folded);
    return m.keys;
  })();
}
