import { getAudioDb as db } from '@/lib/audio-db-conn';
import type { AudioImportResult } from '@/types/audio-import';

function rowToImport(row: Record<string, unknown>): AudioImportResult {
  return {
    id: Number(row.id),
    setName: String(row.setName),
    eventKey: (row.eventKey as string | null) ?? null,
    surface: (row.surface as string | null) ?? null,
    assetsImported: Number(row.assetsImported),
    cuePath: (row.cuePath as string | null) ?? null,
    wiredEvent: (row.wiredEvent as string | null) ?? null,
    createdAt: Number(row.createdAt),
  };
}

export interface RecordAudioImportInput {
  setName: string;
  eventKey?: string | null;
  surface?: string | null;
  assetsImported: number;
  cuePath?: string | null;
  wiredEvent?: string | null;
}

export function recordAudioImport(input: RecordAudioImportInput): AudioImportResult {
  const createdAt = Date.now();
  const info = db().prepare(`
    INSERT INTO audio_import_runs (setName, eventKey, surface, assetsImported, cuePath, wiredEvent, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(input.setName, input.eventKey ?? null, input.surface ?? null, input.assetsImported, input.cuePath ?? null, input.wiredEvent ?? null, createdAt);
  return {
    id: Number(info.lastInsertRowid),
    setName: input.setName,
    eventKey: input.eventKey ?? null,
    surface: input.surface ?? null,
    assetsImported: input.assetsImported,
    cuePath: input.cuePath ?? null,
    wiredEvent: input.wiredEvent ?? null,
    createdAt,
  };
}

export function getLatestAudioImport(): AudioImportResult | null {
  const row = db().prepare('SELECT * FROM audio_import_runs ORDER BY createdAt DESC LIMIT 1').get() as Record<string, unknown> | undefined;
  return row ? rowToImport(row) : null;
}

/** The most recent recorded run for ONE set, or null when it has never been imported. */
export function getLatestAudioImportForSet(setName: string): AudioImportResult | null {
  const row = db().prepare(
    'SELECT * FROM audio_import_runs WHERE setName = ? ORDER BY id DESC LIMIT 1',
  ).get(setName) as Record<string, unknown> | undefined;
  return row ? rowToImport(row) : null;
}

/**
 * The latest run per set name, keyed by set name — the shape the Library reads to
 * report each set's real last-import outcome. Max(id) rather than max(createdAt) so
 * two runs recorded in the same millisecond still resolve to the later insert.
 * A set absent from this map has NEVER been imported (never assume otherwise).
 */
export function listLatestAudioImportsBySet(): Record<string, AudioImportResult> {
  const rows = db().prepare(
    'SELECT * FROM audio_import_runs WHERE id IN (SELECT MAX(id) FROM audio_import_runs GROUP BY setName)',
  ).all() as Array<Record<string, unknown>>;
  const out: Record<string, AudioImportResult> = {};
  for (const r of rows) {
    const rec = rowToImport(r);
    out[rec.setName] = rec;
  }
  return out;
}
