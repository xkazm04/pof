import { getDb } from './db';
import type {
  TelemetrySnapshot,
  TelemetrySignals,
  PatternDetection,
  GenreEvolutionSuggestion,
  SubGenreId,
  TelemetryStats,
  GenreChecklistItem,
} from '@/types/telemetry';

// ─── Schema bootstrap ────────────────────────────────────────────────────────

let initialized = false;

function ensureTables() {
  if (initialized) return;
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS telemetry_snapshots (
      id TEXT PRIMARY KEY,
      scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
      project_path TEXT NOT NULL,
      signals TEXT NOT NULL DEFAULT '{}',
      detected_patterns TEXT NOT NULL DEFAULT '[]'
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_time
    ON telemetry_snapshots(scanned_at DESC)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS genre_suggestions (
      id TEXT PRIMARY KEY,
      sub_genre TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      confidence INTEGER NOT NULL DEFAULT 0,
      patterns TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','accepted','dismissed')),
      proposed_changes TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_genre_suggestions_status
    ON genre_suggestions(status, created_at DESC)
  `);

  initialized = true;
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

export function saveSnapshot(snapshot: TelemetrySnapshot): void {
  ensureTables();
  const db = getDb();
  db.prepare(`
    INSERT INTO telemetry_snapshots (id, scanned_at, project_path, signals, detected_patterns)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    snapshot.id,
    snapshot.scannedAt,
    snapshot.projectPath,
    JSON.stringify(snapshot.signals),
    JSON.stringify(snapshot.detectedPatterns),
  );
}

export function getLatestSnapshot(): TelemetrySnapshot | null {
  ensureTables();
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM telemetry_snapshots ORDER BY scanned_at DESC LIMIT 1'
  ).get() as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToSnapshot(row);
}

export function getSnapshotHistory(limit = 20): TelemetrySnapshot[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM telemetry_snapshots ORDER BY scanned_at DESC LIMIT ?'
  ).all(limit) as Record<string, unknown>[];
  return rows.map(rowToSnapshot);
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

export function saveSuggestion(suggestion: GenreEvolutionSuggestion): void {
  ensureTables();
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO genre_suggestions
      (id, sub_genre, label, description, confidence, patterns, status, proposed_changes, created_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    suggestion.id,
    suggestion.subGenre,
    suggestion.label,
    suggestion.description,
    suggestion.confidence,
    JSON.stringify(suggestion.patterns),
    suggestion.status,
    JSON.stringify(suggestion.proposedChanges),
    suggestion.createdAt,
    suggestion.resolvedAt,
  );
}

export function getPendingSuggestions(): GenreEvolutionSuggestion[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM genre_suggestions WHERE status = 'pending' ORDER BY confidence DESC"
  ).all() as Record<string, unknown>[];
  return rows.map(rowToSuggestion);
}

export function getAcceptedSubGenres(): SubGenreId[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
    "SELECT DISTINCT sub_genre FROM genre_suggestions WHERE status = 'accepted'"
  ).all() as { sub_genre: string }[];
  return rows.map(r => r.sub_genre as SubGenreId);
}

export function resolveSuggestion(id: string, action: 'accept' | 'dismiss'): void {
  ensureTables();
  const db = getDb();
  db.prepare(`
    UPDATE genre_suggestions SET status = ?, resolved_at = datetime('now') WHERE id = ?
  `).run(action === 'accept' ? 'accepted' : 'dismissed', id);
}

export function getAllSuggestions(): GenreEvolutionSuggestion[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM genre_suggestions ORDER BY created_at DESC'
  ).all() as Record<string, unknown>[];
  return rows.map(rowToSuggestion);
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export function getTelemetryStats(): TelemetryStats {
  ensureTables();
  const db = getDb();

  const countRow = db.prepare('SELECT COUNT(*) as c FROM telemetry_snapshots').get() as { c: number };
  const latest = getLatestSnapshot();
  const pending = getPendingSuggestions();
  const accepted = getAcceptedSubGenres();

  return {
    totalScans: countRow.c,
    lastScanAt: latest?.scannedAt ?? null,
    detectedPatterns: latest?.detectedPatterns ?? [],
    activeSuggestions: pending,
    acceptedSubGenres: accepted,
  };
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function rowToSnapshot(row: Record<string, unknown>): TelemetrySnapshot {
  return {
    id: row.id as string,
    scannedAt: row.scanned_at as string,
    projectPath: row.project_path as string,
    signals: JSON.parse((row.signals as string) || '{}'),
    detectedPatterns: JSON.parse((row.detected_patterns as string) || '[]'),
  };
}

function rowToSuggestion(row: Record<string, unknown>): GenreEvolutionSuggestion {
  return {
    id: row.id as string,
    subGenre: row.sub_genre as SubGenreId,
    label: row.label as string,
    description: (row.description as string) || '',
    confidence: (row.confidence as number) || 0,
    patterns: JSON.parse((row.patterns as string) || '[]'),
    status: row.status as GenreEvolutionSuggestion['status'],
    proposedChanges: JSON.parse((row.proposed_changes as string) || '{}'),
    createdAt: row.created_at as string,
    resolvedAt: (row.resolved_at as string) || null,
  };
}
