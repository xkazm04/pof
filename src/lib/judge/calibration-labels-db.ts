import { getDb } from '@/lib/db';
import type { Band } from './calibration';
import type { CalibrationLabel } from './calibrationLabels';

/**
 * `judge_calibration_labels` — the calibration bench's human labels (SERVER-ONLY).
 *
 * DELIBERATELY its own additive table, like `craft_verdicts`: nothing in acceptance or
 * `statusModel` reads it, so a label is measurement of the judge and can never move a grade.
 * One row per (catalog, entity, step) — re-labelling replaces the row, stamped with the content
 * hash and rubric version in force at that moment (see `calibrationLabels.ts`).
 */

let tableEnsured = false;
function ensureTable() {
  if (tableEnsured) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS judge_calibration_labels (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      step TEXT NOT NULL,
      label TEXT NOT NULL CHECK(label IN ('fail','placeholder','shippable')),
      content_hash TEXT NOT NULL,
      rubric_version INTEGER NOT NULL,
      note TEXT,
      labelled_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      PRIMARY KEY (catalog_id, entity_id, step)
    )
  `);
  tableEnsured = true;
}

function rowToLabel(row: Record<string, unknown>): CalibrationLabel {
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    step: row.step as string,
    label: row.label as Band,
    contentHash: row.content_hash as string,
    rubricVersion: Number(row.rubric_version),
    labelledAt: row.labelled_at as string,
    ...(typeof row.note === 'string' && row.note ? { note: row.note } : {}),
  };
}

/** Every stored label (optionally one catalog's), oldest first. */
export function listCalibrationLabels(catalogId?: string): CalibrationLabel[] {
  ensureTable();
  const rows = catalogId
    ? getDb().prepare('SELECT * FROM judge_calibration_labels WHERE catalog_id = ? ORDER BY labelled_at').all(catalogId)
    : getDb().prepare('SELECT * FROM judge_calibration_labels ORDER BY labelled_at').all();
  return (rows as Record<string, unknown>[]).map(rowToLabel);
}

/** The label stored for one (catalog, entity, step), or null. */
export function getCalibrationLabel(catalogId: string, entityId: string, step: string): CalibrationLabel | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM judge_calibration_labels WHERE catalog_id = ? AND entity_id = ? AND step = ?')
    .get(catalogId, entityId, step) as Record<string, unknown> | undefined;
  return row ? rowToLabel(row) : null;
}

/** Store (or replace) one label. The caller has already bound it to the content on record. */
export function upsertCalibrationLabel(l: Omit<CalibrationLabel, 'labelledAt'>): CalibrationLabel {
  ensureTable();
  getDb().prepare(`
    INSERT INTO judge_calibration_labels (catalog_id, entity_id, step, label, content_hash, rubric_version, note, labelled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(catalog_id, entity_id, step) DO UPDATE SET
      label = excluded.label, content_hash = excluded.content_hash, rubric_version = excluded.rubric_version,
      note = excluded.note, labelled_at = excluded.labelled_at
  `).run(l.catalogId, l.entityId, l.step, l.label, l.contentHash, l.rubricVersion, l.note ?? null);
  return getCalibrationLabel(l.catalogId, l.entityId, l.step)!;
}
