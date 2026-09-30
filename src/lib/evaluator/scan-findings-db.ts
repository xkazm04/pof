import type Database from 'better-sqlite3';
import { logger } from '@/lib/logger';
import { EVAL_PASS_VOCABULARY } from '@/lib/evaluator/module-eval-prompts';

/**
 * eval_findings' `pass` CHECK, kept equal to the one pass vocabulary.
 *
 * db.ts has created the table with a 3-pass CHECK (structure/quality/performance)
 * since before ground-truth and combat-trace existed. The import route inserts
 * with INSERT OR IGNORE, which swallows a CHECK violation — so a ground-truth or
 * combat-trace finding vanished while its scan record still counted it. SQLite
 * cannot ALTER a CHECK, so the table is rebuilt (SQLite's documented procedure,
 * the game-director-db `migrateFindingsTable` precedent):
 *
 * - The new DDL is the STORED DDL with only the pass CHECK rewritten, so every
 *   other column, default and constraint (incl. migration-added resolved_at)
 *   is carried over verbatim.
 * - Every row is copied and counted against the original inside one transaction;
 *   a mismatch throws and rolls the whole thing back. Nothing is deleted or coerced.
 * - DROP TABLE also drops the table's indexes and triggers (db.ts only re-creates
 *   its indexes at the next process init), so each is re-created from its stored SQL.
 * - Foreign keys are suspended around it and restored afterwards.
 * - Idempotent: once the CHECK names every pass the call reads one row and returns.
 *   A CHECK that already allows MORE than the vocabulary is left alone (never narrowed).
 */

const TABLE = 'eval_findings';
const SCRATCH = 'eval_findings__rebuild';
const PASS_CHECK = /CHECK\s*\(\s*pass\s+IN\s*\(([^)]*)\)\s*\)/i;
const TABLE_NAME = /^(\s*CREATE\s+TABLE\s+)(?:"eval_findings"|`eval_findings`|\[eval_findings\]|eval_findings)(?=\s*\()/i;

/** The pass values a stored `CHECK(pass IN (...))` allows; `null` when it has none. */
export function passCheckValues(sql: string): string[] | null {
  const m = PASS_CHECK.exec(sql);
  if (!m) return null;
  return [...m[1].matchAll(/'([^']*)'/g)].map((v) => v[1]);
}

/**
 * Widen eval_findings' pass CHECK to EVAL_PASS_VOCABULARY when it is narrower.
 * Returns true when the table was rebuilt, false when it was already current
 * (or has no such table / no pass CHECK). Throws — leaving the table untouched —
 * if the rebuild cannot be done without losing a row.
 */
export function ensureEvalFindingsPassVocabulary(db: Database.Database): boolean {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(TABLE) as
    { sql: string | null } | undefined;
  const sql = row?.sql;
  if (!sql) return false;
  const allowed = passCheckValues(sql);
  if (!allowed || EVAL_PASS_VOCABULARY.every((p) => allowed.includes(p))) return false;

  const check = `CHECK(pass IN (${EVAL_PASS_VOCABULARY.map((p) => `'${p}'`).join(', ')}))`;
  const rebuiltSql = sql.replace(PASS_CHECK, check);
  if (!TABLE_NAME.test(rebuiltSql)) {
    throw new Error(`${TABLE} DDL is not in a shape this rebuild can rename — pass CHECK left unwidened`);
  }
  const scratchSql = rebuiltSql.replace(TABLE_NAME, `$1${SCRATCH}`);

  logger.info(`[scan-findings-db] rebuilding ${TABLE}: pass CHECK ${allowed.join('|')} -> ${EVAL_PASS_VOCABULARY.join('|')}`);

  const fkWasOn = db.pragma('foreign_keys', { simple: true }) === 1;
  if (fkWasOn) db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      const satellites = db.prepare(
        "SELECT sql FROM sqlite_master WHERE tbl_name = ? AND type IN ('index', 'trigger') AND sql IS NOT NULL",
      ).all(TABLE) as { sql: string }[];
      const cols = (db.prepare(`PRAGMA table_info(${TABLE})`).all() as { name: string }[])
        .map((c) => `"${c.name.replace(/"/g, '""')}"`).join(', ');
      const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c;

      const before = count(TABLE);
      // A previous interrupted attempt may have left the scratch table behind.
      db.exec(`DROP TABLE IF EXISTS ${SCRATCH}`);
      db.exec(scratchSql);
      db.exec(`INSERT INTO ${SCRATCH} (${cols}) SELECT ${cols} FROM ${TABLE}`);
      const after = count(SCRATCH);
      if (before !== after) {
        throw new Error(`${TABLE} rebuild would lose rows (${before} -> ${after}) — aborted`);
      }

      db.exec(`DROP TABLE ${TABLE}`);
      db.exec(`ALTER TABLE ${SCRATCH} RENAME TO ${TABLE}`);
      for (const s of satellites) db.exec(s.sql);
    })();
  } finally {
    if (fkWasOn) db.pragma('foreign_keys = ON');
  }
  return true;
}

const ensured = new WeakSet<Database.Database>();

/** ensureEvalFindingsPassVocabulary at most once per connection (the POST hot path). */
export function ensureEvalFindingsPassVocabularyOnce(db: Database.Database): void {
  if (ensured.has(db)) return;
  ensureEvalFindingsPassVocabulary(db);
  ensured.add(db);
}
