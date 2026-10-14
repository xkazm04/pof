import { getDb } from '@/lib/db';
import { dedupeGaps, type CoverageGap, type CoverageGapRow } from './coverage-gaps';
import type { LensId } from './lens-map';

/**
 * Storage for the craft coverage channel (see coverage-gaps.ts).
 *
 * A SEPARATE table, like `craft_verdict_history`: the gauge row, its level and its findings are
 * untouched, so a gap can never move a level or a projection. The current picture per cell is
 * what is kept — a re-gauge REPLACES that cell's remarks (a gap the auditor no longer sees is
 * not evidence), in the same transaction. Nothing in acceptance or statusModel reads this.
 */
let ensured = false;
function ensure() {
  if (ensured) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS craft_coverage_gaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      step TEXT NOT NULL,
      lens TEXT NOT NULL,
      lens_version INTEGER NOT NULL DEFAULT 1,
      detail TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT '',
      noted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ccg_cell ON craft_coverage_gaps (catalog_id, entity_id, step);
    CREATE INDEX IF NOT EXISTS idx_ccg_lens ON craft_coverage_gaps (lens);
  `);
  ensured = true;
}

/** Replace one cell's remarks with this gauge's (an empty list clears them). Returns what was kept. */
export function replaceCoverageGaps(
  cell: { catalogId: string; entityId: string; step: string; lens: LensId; lensVersion: number; model: string },
  gaps: readonly CoverageGap[],
): CoverageGap[] {
  ensure();
  const kept = dedupeGaps(gaps);
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM craft_coverage_gaps WHERE catalog_id = ? AND entity_id = ? AND step = ?').run(
      cell.catalogId, cell.entityId, cell.step,
    );
    const ins = db.prepare(
      'INSERT INTO craft_coverage_gaps (catalog_id, entity_id, step, lens, lens_version, detail, model) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const g of kept) ins.run(cell.catalogId, cell.entityId, cell.step, cell.lens, cell.lensVersion, g.detail, cell.model);
  })();
  return kept;
}

export function listCoverageGaps(catalogId?: string): CoverageGapRow[] {
  ensure();
  const rows = (
    catalogId
      ? getDb().prepare('SELECT * FROM craft_coverage_gaps WHERE catalog_id = ? ORDER BY id ASC').all(catalogId)
      : getDb().prepare('SELECT * FROM craft_coverage_gaps ORDER BY id ASC').all()
  ) as Record<string, unknown>[];
  return rows.map((r) => ({
    catalogId: r.catalog_id as string,
    entityId: r.entity_id as string,
    step: r.step as string,
    lens: r.lens as LensId,
    lensVersion: Number(r.lens_version ?? 1),
    detail: r.detail as string,
    model: (r.model as string) ?? '',
    ...(r.noted_at ? { notedAt: r.noted_at as string } : {}),
  }));
}
