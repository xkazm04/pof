import { getDb } from './db';
import type { SubModuleId } from '@/types/modules';
import type { ErrorMemoryRecord, ErrorContextEntry } from '@/types/error-memory';

// ── Schema bootstrap ──────────────────────────────────────────────────────

export function ensureErrorMemoryTable() {
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

  // Try to increment existing record
  const existing = db.prepare(
    'SELECT id FROM error_memory WHERE module_id = ? AND fingerprint = ?'
  ).get(data.moduleId, data.fingerprint) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE error_memory
      SET occurrences = occurrences + 1,
          last_seen_at = datetime('now'),
          was_resolved = 0
      WHERE id = ?
    `).run(existing.id);
    const record = getRecord(existing.id);
    if (!record) {
      throw new Error(`Failed to retrieve error_memory record after UPDATE (id=${existing.id})`);
    }
    return record;
  }

  // Insert new
  const result = db.prepare(`
    INSERT INTO error_memory
      (module_id, fingerprint, category, error_code, pattern, message, file, fix_description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.moduleId,
    data.fingerprint,
    data.category,
    data.errorCode,
    data.pattern,
    data.message,
    data.file,
    data.fixDescription,
  );

  const inserted = getRecord(result.lastInsertRowid as number);
  if (!inserted) {
    throw new Error(`Failed to retrieve error_memory record after INSERT (rowid=${result.lastInsertRowid})`);
  }
  return inserted;
}

// ── Batch record multiple errors ────────────────────────────────────────

export function recordErrors(
  moduleId: SubModuleId,
  errors: { fingerprint: string; category: string; errorCode: string | null; pattern: string; message: string; file: string | null; fixDescription: string }[],
): ErrorMemoryRecord[] {
  return errors.map((e) => recordError({ moduleId, ...e }));
}

// ── Read ────────────────────────────────────────────────────────────────

function getRecord(id: number): ErrorMemoryRecord | null {
  ensureErrorMemoryTable();
  const row = getDb()
    .prepare('SELECT * FROM error_memory WHERE id = ?')
    .get(id) as ErrorMemoryRow | undefined;
  return row ? rowToRecord(row) : null;
}

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

export function markResolved(fingerprint: string): void {
  ensureErrorMemoryTable();
  getDb().prepare(
    'UPDATE error_memory SET was_resolved = 1 WHERE fingerprint = ?'
  ).run(fingerprint);
}

// ── Stats ───────────────────────────────────────────────────────────────

export interface ErrorMemoryStats {
  totalErrors: number;
  uniqueFingerprints: number;
  topCategories: { category: string; count: number }[];
  topPatterns: { pattern: string; occurrences: number; moduleId: SubModuleId }[];
  unresolvedCount: number;
}

export function getErrorMemoryStats(): ErrorMemoryStats {
  ensureErrorMemoryTable();
  const db = getDb();

  const total = (db.prepare('SELECT SUM(occurrences) as total FROM error_memory').get() as { total: number | null })?.total ?? 0;
  const unique = (db.prepare('SELECT COUNT(*) as cnt FROM error_memory').get() as { cnt: number })?.cnt ?? 0;
  const unresolved = (db.prepare('SELECT COUNT(*) as cnt FROM error_memory WHERE was_resolved = 0').get() as { cnt: number })?.cnt ?? 0;

  const topCategories = db.prepare(`
    SELECT category, SUM(occurrences) as count
    FROM error_memory
    GROUP BY category
    ORDER BY count DESC
    LIMIT 5
  `).all() as { category: string; count: number }[];

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
