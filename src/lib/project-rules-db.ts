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
import { CANON_PROFILES, DEFAULT_CANON_PROFILE, allShippedRules } from '@/lib/catalog/canon/profiles';

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
      profile TEXT NOT NULL DEFAULT '${DEFAULT_CANON_PROFILE}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Additive migration for a table that predates profiles — BEFORE any seeding, which writes the
  // column (a fresh DB seeded first and crashed on the missing column). Existing rows are PoF's
  // own canon, which is exactly what the default says.
  const cols = getDb().prepare('PRAGMA table_info(project_rules)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'profile')) {
    getDb().exec(`ALTER TABLE project_rules ADD COLUMN profile TEXT NOT NULL DEFAULT '${DEFAULT_CANON_PROFILE}'`);
  }


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

  // Each non-default profile is seeded ONCE, under its own recorded marker — the same discipline as
  // the PoF seed. A profile that did not exist before cannot have been curated, so an existing table
  // still gets it. An EMPTY seed never sets its marker, or its rules could never arrive later.
  for (const profile of Object.values(CANON_PROFILES)) {
    if (profile.id === DEFAULT_CANON_PROFILE || profile.seed.length === 0) continue;
    syncProfileSeed(profile.id, profile.seed);
  }

  tableEnsured = true;
}

/**
 * Seed a canon profile, then keep it ADDITIVELY in sync with what ships.
 *
 * A profile's canon grows as the /diablo loop derives laws, so "seed once" is not enough: a rule
 * shipped after the first seeding must reach an existing DB. But a rule the operator DELETED must
 * never come back (the same promise the PoF seed keeps). So the DB records every rule id it has
 * ever been OFFERED (`<marker>.ids`): a shipped id not in that set is inserted and recorded; an id in
 * it is left alone whether it is present, edited or deleted. Edits to an already-offered rule's
 * shipped TEXT are not synced here (that needs to tell an operator's edit from a stale seed).
 */
function syncProfileSeed(profileId: string, seed: readonly ProjectRule[]): void {
  const marker = `${SEED_MARKER}.${profileId}`;
  const idsKey = `${marker}.ids`;
  let offered: Set<string>;
  if (!getSetting(marker)) {
    offered = new Set();
    setSetting(marker, new Date().toISOString());
  } else {
    const recorded = getSetting(idsKey);
    // A marker from before ids were recorded (W01): every rule it seeded is still present.
    offered = new Set(recorded ? (JSON.parse(recorded) as string[]) : (getDb()
      .prepare('SELECT id FROM project_rules WHERE profile = ?').all(profileId) as { id: string }[]).map((r) => r.id));
  }
  const fresh = seed.filter((r) => !offered.has(r.id));
  for (const rule of fresh) { upsertRuleRaw(rule); offered.add(rule.id); }
  setSetting(idsKey, JSON.stringify([...offered].sort()));
  if (fresh.length) logger.info(`[project-rules] canon profile "${profileId}": offered ${fresh.length} newly shipped rule(s).`);
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
  // Only a NON-default profile is carried, so a PoF rule reads back exactly as it always did.
  const profile = row.profile as string | null | undefined;
  if (profile && profile !== DEFAULT_CANON_PROFILE) rule.profile = profile;
  const updatedAt = row.updated_at as string | null;
  if (updatedAt) rule.updatedAt = updatedAt;
  return rule;
}

function upsertRuleRaw(rule: ProjectRule): void {
  getDb()
    .prepare(
      `INSERT INTO project_rules (id, category, scope, title, body, refs, profile, updated_at)
       VALUES (@id, @category, @scope, @title, @body, @refs, @profile, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         category=@category, scope=@scope, title=@title, body=@body,
         refs=@refs, profile=@profile, updated_at=datetime('now')`,
    )
    .run({
      id: rule.id,
      category: rule.category,
      scope: rule.scope,
      title: rule.title,
      body: rule.body,
      refs: JSON.stringify(rule.refs ?? []),
      profile: rule.profile ?? DEFAULT_CANON_PROFILE,
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
  // Every profile's shipped rules, not only PoF's: "restore the defaults" means all of them.
  const shipped = allShippedRules(CANON_SEED);
  const write = getDb().transaction(() => {
    for (const rule of shipped) upsertRuleRaw(rule);
  });
  write();
  const total = (
    getDb().prepare('SELECT COUNT(*) as cnt FROM project_rules').get() as { cnt: number }
  ).cnt;
  logger.info(`[project-rules] canon defaults restored on request: ${shipped.length} rule(s), ${total} total.`);
  return { restored: shipped.length, total };
}
