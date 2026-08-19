/**
 * The project canon — the rules cited into step-recipe produce prompts and the
 * judge's context.
 *
 * SCOPE: this table is **GLOBAL to the SQLite file, not per project**. Every
 * project opened on this machine reads and writes the same rows, so PoF's canon
 * is cited into another project's prompts. Adding a `project_id` column is a real
 * schema decision that has not been taken; until it is, read "project rules" as
 * "this installation's rules".
 *
 * SEEDING happens exactly ONCE per database and is RECORDED in `settings` under
 * `SEED_MARKER` — never inferred from `COUNT(*) === 0`. Inferring it meant that
 * deleting the LAST remaining rule reported success and the very next
 * `listRules()` silently resurrected all 66 seed rules, while a partial deletion
 * stuck. A user who curates the canon down to nothing keeps nothing; the way back
 * is the explicit, named `restoreCanonSeed()`.
 */
import { getDb, getSetting, setSetting } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';

/** Records that this DB has had its one seeding. Presence is the whole contract. */
const SEED_MARKER = 'project-rules.canon-seeded';

let tableEnsured = false;

function ensureTable() {
  if (tableEnsured) return;

  // Whether the table pre-dates this call decides how a marker-less DB is read:
  // a table we just created is genuinely fresh and gets the canon; a table that
  // already existed is ADOPTED as it stands (it predates the marker, and its rows
  // — including none at all — are the user's own curation, not a missing seed).
  const existed = !!getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='project_rules'")
    .get();

  getDb().exec(`
    CREATE TABLE IF NOT EXISTS project_rules (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      scope TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      refs TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  if (!getSetting(SEED_MARKER)) {
    if (!existed) {
      for (const rule of CANON_SEED) upsertRuleRaw(rule);
      logger.info(`[project-rules] seeded ${CANON_SEED.length} canon rule(s) into a new database.`);
    } else {
      const kept = (
        getDb().prepare('SELECT COUNT(*) as cnt FROM project_rules').get() as { cnt: number }
      ).cnt;
      logger.info(
        `[project-rules] adopting an existing table of ${kept} rule(s) as the canon; ` +
          `no seeding (use restoreCanonSeed() to put the defaults back).`,
      );
    }
    setSetting(SEED_MARKER, new Date().toISOString());
  }

  tableEnsured = true;
}

/** Column row → ProjectRule. Pure (exported for unit test). */
export function rowToRule(row: Record<string, unknown>): ProjectRule {
  const rule: ProjectRule = {
    id: row.id as string,
    category: row.category as ProjectRule['category'],
    scope: row.scope as string,
    title: row.title as string,
    body: row.body as string,
    refs: JSON.parse((row.refs as string) || '[]'),
  };
  const updatedAt = row.updated_at as string | null;
  if (updatedAt) rule.updatedAt = updatedAt;
  return rule;
}

function upsertRuleRaw(rule: ProjectRule): void {
  getDb()
    .prepare(
      `INSERT INTO project_rules (id, category, scope, title, body, refs, updated_at)
       VALUES (@id, @category, @scope, @title, @body, @refs, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         category=@category, scope=@scope, title=@title, body=@body,
         refs=@refs, updated_at=datetime('now')`,
    )
    .run({
      id: rule.id,
      category: rule.category,
      scope: rule.scope,
      title: rule.title,
      body: rule.body,
      refs: JSON.stringify(rule.refs ?? []),
    });
}

export function listRules(): ProjectRule[] {
  ensureTable();
  const rows = getDb()
    .prepare('SELECT * FROM project_rules ORDER BY category, id')
    .all() as Record<string, unknown>[];
  return rows.map(rowToRule);
}

export function upsertRule(rule: ProjectRule): ProjectRule {
  ensureTable();
  upsertRuleRaw(rule);
  return rowToRule(
    getDb().prepare('SELECT * FROM project_rules WHERE id = ?').get(rule.id) as Record<string, unknown>,
  );
}

export function deleteRule(id: string): void {
  ensureTable();
  getDb().prepare('DELETE FROM project_rules WHERE id = ?').run(id);
}

/**
 * Put the shipped canon back — the ONE path that re-writes `CANON_SEED`, and only
 * because someone asked for it. Rules the user authored under their own ids are
 * left untouched; a seed rule they edited is reset to the shipped text (that is
 * what "restore the defaults" means).
 *
 * @returns `restored` = seed rules written, `total` = rules in the table after.
 */
export function restoreCanonSeed(): { restored: number; total: number } {
  ensureTable();
  const write = getDb().transaction(() => {
    for (const rule of CANON_SEED) upsertRuleRaw(rule);
  });
  write();
  const total = (
    getDb().prepare('SELECT COUNT(*) as cnt FROM project_rules').get() as { cnt: number }
  ).cnt;
  logger.info(`[project-rules] canon defaults restored on request: ${CANON_SEED.length} rule(s), ${total} total.`);
  return { restored: CANON_SEED.length, total };
}
