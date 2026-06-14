import { getDb } from './db';
import type { SubModuleId } from '@/types/modules';
import type { ErrorMemoryRecord, ErrorContextEntry } from '@/types/error-memory';

// ── Schema bootstrap ──────────────────────────────────────────────────────

// DDL is idempotent (IF NOT EXISTS) but parsing/planning it on every read is
// pure overhead. Bootstrap runs at most once per process; subsequent calls are
// a cheap boolean check. Every read/write still calls ensure…() so first-call
// correctness is preserved.
let errorMemoryBootstrapped = false;

export function ensureErrorMemoryTable() {
  if (errorMemoryBootstrapped) return;

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS error_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      category TEXT NOT NULL,
      error_code TEXT,
      pattern TEXT NOT NULL,
      message TEXT NOT NULL,
      file TEXT,
      fix_description TEXT NOT NULL DEFAULT '',
      occurrences INTEGER NOT NULL DEFAULT 1,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      was_resolved INTEGER NOT NULL DEFAULT 0,
      UNIQUE(module_id, fingerprint)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_error_memory_module
    ON error_memory(module_id, occurrences DESC)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_error_memory_fingerprint
    ON error_memory(fingerprint)
  `);

  errorMemoryBootstrapped = true;
}

// ── Row type ─────────────────────────────────────────────────────────────

interface ErrorMemoryRow {
  id: number;
  module_id: string;
  fingerprint: string;
  category: string;
  error_code: string | null;
  pattern: string;
  message: string;
  file: string | null;
  fix_description: string;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  was_resolved: number;
}

// ── Row mapping ──────────────────────────────────────────────────────────

function rowToRecord(row: ErrorMemoryRow): ErrorMemoryRecord {
  return {
    id: row.id,
    moduleId: row.module_id as SubModuleId,
    fingerprint: row.fingerprint,
    category: row.category as ErrorMemoryRecord['category'],
    errorCode: row.error_code,
    pattern: row.pattern,
    message: row.message,
    file: row.file,
    fixDescription: row.fix_description,
    occurrences: row.occurrences,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    wasResolved: row.was_resolved === 1,
  };
}

// ── Record an error (upsert — increment if fingerprint exists) ──────────

export function recordError(data: {
  moduleId: SubModuleId;
  fingerprint: string;
  category: string;
  errorCode: string | null;
  pattern: string;
  message: string;
  file: string | null;
  fixDescription: string;
}): ErrorMemoryRecord {
  ensureErrorMemoryTable();
  const db = getDb();

  // Single upsert collapses the former SELECT(exists) → UPDATE|INSERT → SELECT(getRecord)
  // 3-query path into one statement. On conflict we bump only occurrences/last_seen_at/
  // was_resolved — leaving category/error_code/pattern/message/file/fix_description as
  // originally inserted, exactly matching the prior UPDATE behaviour. RETURNING * gives us
  // the stored row without a follow-up read. Stored rows are byte-identical to the old path.
  const row = db.prepare(`
    INSERT INTO error_memory
      (module_id, fingerprint, category, error_code, pattern, message, file, fix_description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(module_id, fingerprint) DO UPDATE SET
      occurrences = occurrences + 1,
      last_seen_at = datetime('now'),
      was_resolved = 0
    RETURNING *
  `).get(
    data.moduleId,
    data.fingerprint,
    data.category,
    data.errorCode,
    data.pattern,
    data.message,
    data.file,
    data.fixDescription,
  ) as ErrorMemoryRow | undefined;

  if (!row) {
    throw new Error(`Failed to upsert error_memory record (module=${data.moduleId}, fingerprint=${data.fingerprint})`);
  }
  return rowToRecord(row);
}

// ── Batch record multiple errors ────────────────────────────────────────

export function recordErrors(
  moduleId: SubModuleId,
  errors: { fingerprint: string; category: string; errorCode: string | null; pattern: string; message: string; file: string | null; fixDescription: string }[],
): ErrorMemoryRecord[] {
  ensureErrorMemoryTable();
  // Wrap the whole batch in one transaction: N errors commit in a single fsync and the
  // batch is atomic (a mid-batch throw rolls back all rows instead of leaving a partial
  // write). Each recordError is a single upsert statement, so the batch is ~N statements
  // in one commit rather than ~3N statements across N auto-commit transactions.
  const insertBatch = getDb().transaction(
    (items: typeof errors) => items.map((e) => recordError({ moduleId, ...e })),
  );
  return insertBatch(errors);
}

// ── Read ────────────────────────────────────────────────────────────────

export function getModuleErrors(moduleId: SubModuleId, limit = 20): ErrorMemoryRecord[] {
  ensureErrorMemoryTable();
  const rows = getDb()
    .prepare('SELECT * FROM error_memory WHERE module_id = ? ORDER BY occurrences DESC, last_seen_at DESC LIMIT ?')
    .all(moduleId, limit) as ErrorMemoryRow[];
  return rows.map(rowToRecord);
}

export function getAllErrors(limit = 50): ErrorMemoryRecord[] {
  ensureErrorMemoryTable();
  const rows = getDb()
    .prepare('SELECT * FROM error_memory ORDER BY occurrences DESC, last_seen_at DESC LIMIT ?')
    .all(limit) as ErrorMemoryRow[];
  return rows.map(rowToRecord);
}

/**
 * Get the most relevant errors for a module + task context.
 *
 * Relevance scoring:
 * - Higher occurrences = more important (repeated mistakes)
 * - Recent errors weighted more
 * - Keyword matching against task description
 * - Unresolved errors prioritized over resolved ones
 *
 * Returns top N entries formatted for prompt injection.
 */
export function getRelevantErrors(
  moduleId: SubModuleId,
  taskKeywords: string[] = [],
  limit = 5,
): ErrorContextEntry[] {
  ensureErrorMemoryTable();
  const db = getDb();

  // Get all module errors + cross-module high-frequency errors
  const rows = db.prepare(`
    SELECT * FROM error_memory
    WHERE module_id = ? OR occurrences >= 3
    ORDER BY occurrences DESC, last_seen_at DESC
    LIMIT 30
  `).all(moduleId) as ErrorMemoryRow[];

  const records = rows.map(rowToRecord);
  if (records.length === 0) return [];

  // Score each record for relevance
  const scored = records.map((r) => {
    let score = 0;

    // Occurrence weight (logarithmic to avoid domination by one error)
    score += Math.log2(r.occurrences + 1) * 10;

    // Recency weight (within last 7 days = bonus)
    const daysSinceLastSeen = (Date.now() - new Date(r.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSeen < 1) score += 15;
    else if (daysSinceLastSeen < 7) score += 8;
    else if (daysSinceLastSeen < 30) score += 3;

    // Unresolved = higher priority
    if (!r.wasResolved) score += 5;

    // Module match bonus
    if (r.moduleId === moduleId) score += 10;

    // Keyword matching
    const lowerPattern = r.pattern.toLowerCase();
    const lowerMessage = r.message.toLowerCase();
    const lowerFix = r.fixDescription.toLowerCase();
    for (const kw of taskKeywords) {
      const kwLower = kw.toLowerCase();
      if (lowerPattern.includes(kwLower) || lowerMessage.includes(kwLower) || lowerFix.includes(kwLower)) {
        score += 20;
      }
    }

    return { record: r, score };
  });

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate by pattern (keep highest scored)
  const seen = new Set<string>();
  const deduped = scored.filter((s) => {
    if (seen.has(s.record.pattern)) return false;
    seen.add(s.record.pattern);
    return true;
  });

  return deduped.slice(0, limit).map((s) => ({
    category: s.record.category,
    pattern: s.record.pattern,
    fixDescription: s.record.fixDescription,
    occurrences: s.record.occurrences,
    errorCode: s.record.errorCode,
  }));
}

// ── Mark resolved ───────────────────────────────────────────────────────

export function markResolved(moduleId: string, fingerprint: string): void {
  ensureErrorMemoryTable();
  // Scope by module: fingerprints are module-independent and the table is keyed
  // UNIQUE(module_id, fingerprint), so resolving without the module_id filter would mark
  // the same fingerprint resolved in EVERY other module and drop its warning from their prompts.
  getDb().prepare(
    'UPDATE error_memory SET was_resolved = 1 WHERE module_id = ? AND fingerprint = ?'
  ).run(moduleId, fingerprint);
}

// ── Stats ───────────────────────────────────────────────────────────────

export interface ErrorMemoryStats {
  totalErrors: number;
  uniqueFingerprints: number;
  /** Per-category aggregate. `unresolved` is the count of categories' fingerprints not yet flagged resolved. */
  topCategories: { category: string; count: number; unresolved: number }[];
  topPatterns: { pattern: string; occurrences: number; moduleId: SubModuleId }[];
  unresolvedCount: number;
}

export function getErrorMemoryStats(): ErrorMemoryStats {
  ensureErrorMemoryTable();
  const db = getDb();

  const total = (db.prepare('SELECT SUM(occurrences) as total FROM error_memory').get() as { total: number | null })?.total ?? 0;
  const unique = (db.prepare('SELECT COUNT(*) as cnt FROM error_memory').get() as { cnt: number })?.cnt ?? 0;
  const unresolved = (db.prepare('SELECT COUNT(*) as cnt FROM error_memory WHERE was_resolved = 0').get() as { cnt: number })?.cnt ?? 0;

  // SUM(was_resolved = 0) counts rows still unresolved per category — used for the
  // per-row resolved/unresolved dot in the dashboard.
  const topCategories = db.prepare(`
    SELECT category, SUM(occurrences) as count, SUM(CASE WHEN was_resolved = 0 THEN 1 ELSE 0 END) as unresolved
    FROM error_memory
    GROUP BY category
    ORDER BY count DESC
    LIMIT 5
  `).all() as { category: string; count: number; unresolved: number }[];

  const topPatterns = db.prepare(`
    SELECT pattern, occurrences, module_id
    FROM error_memory
    ORDER BY occurrences DESC
    LIMIT 5
  `).all() as { pattern: string; occurrences: number; module_id: string }[];

  return {
    totalErrors: total,
    uniqueFingerprints: unique,
    topCategories,
    topPatterns: topPatterns.map((r) => ({ pattern: r.pattern, occurrences: r.occurrences, moduleId: r.module_id as SubModuleId })),
    unresolvedCount: unresolved,
  };
}
