import { getDb } from '@/lib/db';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';

function ensureTable() {
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

  const count = (
    getDb().prepare('SELECT COUNT(*) as cnt FROM project_rules').get() as { cnt: number }
  ).cnt;

  if (count === 0) {
    for (const rule of CANON_SEED) {
      upsertRuleRaw(rule);
    }
  }
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
