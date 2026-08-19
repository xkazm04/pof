import { getDb } from './db';
import {
  normalizeProjectId,
  isInProjectScope,
  foldProjectScopeCounts,
  type ProjectScopeCounts,
} from '@/lib/project-id';
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
// The `telemetry_snapshots` / `genre_suggestions` tables + indexes are defined
// centrally in db.ts; this is just the documented "ensure DB is initialized"
// guard (same pattern as session-log-db.ts / session-analytics-db.ts).
// Call at the top of every exported function.

function ensureTables() {
  getDb();
}

// ─── Project scoping ─────────────────────────────────────────────────────────
//
// `telemetry_snapshots.project_path` was written on every scan and read by NOTHING:
// the schema LOOKED scoped while every read was global. That is not a dashboard-only
// defect here — `getLatestSnapshot()` feeds `POST /api/telemetry {action:'resolve-skills'}`,
// whose `detectedPatterns` decide which domain skill packs get injected into CLI
// PROMPTS. With two projects on this machine (`PoF` and `jinx`), scanning one silently
// changed which knowledge the other's prompts carried.
//
// IDENTITY: the same normalized `projectPath` the rest of the app uses
// (`@/lib/project-id`), passed EXPLICITLY — nothing here infers it, because a read that
// guessed its own scope is exactly the silent mis-attribution this removes.
//
// RULE: the ONE own-plus-legacy rule (`isInProjectScope`) — a named project sees its
// own snapshots PLUS any blank-path ones; an unscoped caller sees ONLY the blank-path
// ones. Rows belonging to another project stay VISIBLE AND COUNTED through
// `getTelemetryScopeReport`, never hidden and never guessed into an owner.
//
// The column stores the RAW spelling a scan was launched with, so scoping happens by
// normalizing the DISTINCT values in JS and matching on them — re-implementing
// `normalizeProjectId` in SQL would be a second rule, free to drift from the first.

/** `WHERE project_path IN (…)` restricted to the values in scope, or null when none are. */
function snapshotScope(projectId: string): { sql: string; params: string[] } | null {
  const distinct = getDb()
    .prepare('SELECT DISTINCT project_path FROM telemetry_snapshots')
    .all() as { project_path: string }[];
  const inScope = distinct
    .map((r) => r.project_path)
    .filter((p) => isInProjectScope(p, projectId));
  if (inScope.length === 0) return null;
  return {
    sql: `project_path IN (${inScope.map(() => '?').join(', ')})`,
    params: inScope,
  };
}

/**
 * What a scoped telemetry read could and could not see, in counts. Pure reporting —
 * it never moves a row, adopts one, or changes a scan. Surfaced through
 * `TelemetryStats.scope` so "0 scans" can never read as "nobody ever scanned" when the
 * truth is "3 scans belong to another project".
 */
export function getTelemetryScopeReport(projectPath?: string | null): ProjectScopeCounts {
  ensureTables();
  const rows = getDb()
    .prepare('SELECT project_path, COUNT(*) as cnt FROM telemetry_snapshots GROUP BY project_path')
    .all() as { project_path: string; cnt: number }[];
  return foldProjectScopeCounts(
    rows.map((r) => ({ projectValue: r.project_path, count: r.cnt })),
    normalizeProjectId(projectPath),
  );
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

/**
 * Newest snapshot IN SCOPE of `projectPath`. Omitting the project is an UNSCOPED read
 * (blank-path rows only) — never "the newest scan of any project", which is what this
 * function used to return straight into prompt content.
 */
export function getLatestSnapshot(projectPath?: string | null): TelemetrySnapshot | null {
  ensureTables();
  const scope = snapshotScope(normalizeProjectId(projectPath));
  if (!scope) return null;
  const row = getDb().prepare(
    `SELECT * FROM telemetry_snapshots WHERE ${scope.sql} ORDER BY scanned_at DESC LIMIT 1`
  ).get(...scope.params) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToSnapshot(row);
}

export function getSnapshotHistory(limit = 20, projectPath?: string | null): TelemetrySnapshot[] {
  ensureTables();
  const scope = snapshotScope(normalizeProjectId(projectPath));
  if (!scope) return [];
  const rows = getDb().prepare(
    `SELECT * FROM telemetry_snapshots WHERE ${scope.sql} ORDER BY scanned_at DESC LIMIT ?`
  ).all(...scope.params, limit) as Record<string, unknown>[];
  return rows.map(rowToSnapshot);
}

// ─── Suggestions ─────────────────────────────────────────────────────────────
//
// `genre_suggestions` carries NO project column at all (unlike `telemetry_snapshots`,
// where one existed and was simply unread). Adding one is a schema migration, which
// this change deliberately does not attempt. So the honest third option is neither a
// silent global read nor a fabricated scope: the reads below ARE global, and they say
// so — `GENRE_SUGGESTION_SCOPE` travels with every stats payload and the UI states it,
// because an accepted sub-genre changes module checklists for every project.

/** Plainly: accepted sub-genres are NOT project-scoped. Stated, never implied. */
export const GENRE_SUGGESTION_SCOPE = {
  scoped: false,
  note: 'Sub-genre suggestions are stored without a project — accepting one applies to every project in this install.',
} as const;

export type GenreSuggestionScope = typeof GENRE_SUGGESTION_SCOPE;

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

export function getAllSuggestions(limit?: number): GenreEvolutionSuggestion[] {
  ensureTables();
  const db = getDb();
  const rows = (limit != null
    ? db.prepare('SELECT * FROM genre_suggestions ORDER BY created_at DESC LIMIT ?').all(limit)
    : db.prepare('SELECT * FROM genre_suggestions ORDER BY created_at DESC').all()) as Record<string, unknown>[];
  return rows.map(rowToSuggestion);
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export function getTelemetryStats(projectPath?: string | null): TelemetryStats {
  ensureTables();

  const scope = getTelemetryScopeReport(projectPath);
  const latest = getLatestSnapshot(projectPath);
  const pending = getPendingSuggestions();
  const accepted = getAcceptedSubGenres();

  return {
    // Scans this scope can actually see — NOT `COUNT(*)`, which reported another
    // project's scans as if they were this one's.
    totalScans: scope.ownedRows + scope.legacyRows,
    lastScanAt: latest?.scannedAt ?? null,
    detectedPatterns: latest?.detectedPatterns ?? [],
    activeSuggestions: pending,
    acceptedSubGenres: accepted,
    scope,
    subGenreScope: GENRE_SUGGESTION_SCOPE,
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
