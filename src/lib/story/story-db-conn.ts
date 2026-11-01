/**
 * Server-only accessor for the storygraph tables, bound to the shared `getDb()` connection (the
 * `audio-db-conn.ts` convention) so `POF_DB_PATH` — and with it the test suite's throwaway DB —
 * is always honoured. This file never constructs its own connection: `db-containment.test.ts`
 * enforces that `src/lib/db.ts` is the only place one is opened.
 *
 * Schema creation is idempotent: `CREATE TABLE IF NOT EXISTS`, then the `PRAGMA table_info` +
 * `ALTER TABLE ADD COLUMN` idiom for any column added later (there is no migration framework).
 *
 * Rows are PROJECT-SCOPED: `(project, graph_id)` is the identity, because two projects may well
 * both call their season `s1`. `revision` is ordering and `hash` (the `contentHash` over the
 * canonical form) is identity: an import may move a graph forward, never backward, and may not
 * re-use a stored revision number for different content.
 */

import type Database from 'better-sqlite3';
import { getDb } from '@/lib/db';
import { err, ok, type Result } from '@/types/result';
import type { StoryGraph } from '@/lib/story/types';
import type { UnknownKind } from '@/lib/story/importer';
import { canonicalStoryGraph } from '@/lib/story/canonical';

let ready = false;

/** Columns added after the first shape. Each is `name -> DDL type`. */
const LATER_COLUMNS: Readonly<Record<string, string>> = {
  unknown_kinds: "TEXT NOT NULL DEFAULT '[]'",
};

function ensureStoryTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS story_graphs (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      graph_id TEXT NOT NULL,
      name TEXT NOT NULL,
      revision INTEGER NOT NULL,
      hash TEXT NOT NULL,
      format TEXT NOT NULL,
      node_count INTEGER NOT NULL,
      edge_count INTEGER NOT NULL,
      json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (project, graph_id)
    );
    CREATE INDEX IF NOT EXISTS idx_story_graphs_graph_id ON story_graphs(graph_id);
  `);
  const have = new Set((db.prepare('PRAGMA table_info(story_graphs)').all() as { name: string }[]).map((c) => c.name));
  for (const [col, ddl] of Object.entries(LATER_COLUMNS)) {
    if (!have.has(col)) db.exec(`ALTER TABLE story_graphs ADD COLUMN ${col} ${ddl}`);
  }
}

export function getStoryDb(): Database.Database {
  const db = getDb();
  if (!ready) {
    ensureStoryTables(db);
    ready = true;
  }
  return db;
}

/* --------------------------------------------------------------- repository */

export interface StoryGraphSummary {
  id: string;
  project: string;
  graphId: string;
  name: string;
  revision: number;
  hash: string;
  format: string;
  nodeCount: number;
  edgeCount: number;
  unknownKinds: UnknownKind[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredStoryGraph extends StoryGraphSummary {
  graph: StoryGraph;
}

interface Row {
  id: string;
  project: string;
  graph_id: string;
  name: string;
  revision: number;
  hash: string;
  format: string;
  node_count: number;
  edge_count: number;
  unknown_kinds: string;
  json: string;
  created_at: number;
  updated_at: number;
}

const SUMMARY_COLS =
  'id, project, graph_id, name, revision, hash, format, node_count, edge_count, unknown_kinds, created_at, updated_at';

export function storyRowId(project: string, graphId: string): string {
  return `${project}::${graphId}`;
}

function toSummary(r: Omit<Row, 'json'>): StoryGraphSummary {
  return {
    id: r.id,
    project: r.project,
    graphId: r.graph_id,
    name: r.name,
    revision: r.revision,
    hash: r.hash,
    format: r.format,
    nodeCount: r.node_count,
    edgeCount: r.edge_count,
    unknownKinds: JSON.parse(r.unknown_kinds) as UnknownKind[],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listStoryGraphs(project?: string): StoryGraphSummary[] {
  const db = getStoryDb();
  const rows = project
    ? db.prepare(`SELECT ${SUMMARY_COLS} FROM story_graphs WHERE project = ? ORDER BY updated_at DESC, id`).all(project)
    : db.prepare(`SELECT ${SUMMARY_COLS} FROM story_graphs ORDER BY updated_at DESC, id`).all();
  return (rows as Omit<Row, 'json'>[]).map(toSummary);
}

/** Every stored graph with this `graphId` (one per project), optionally narrowed to a project. */
export function findStoryGraphs(graphId: string, project?: string): StoredStoryGraph[] {
  const db = getStoryDb();
  const rows = (
    project
      ? db.prepare('SELECT * FROM story_graphs WHERE graph_id = ? AND project = ?').all(graphId, project)
      : db.prepare('SELECT * FROM story_graphs WHERE graph_id = ? ORDER BY project').all(graphId)
  ) as Row[];
  return rows.map((r) => ({ ...toSummary(r), graph: JSON.parse(r.json) as StoryGraph }));
}

export type SaveStatus = 'created' | 'replaced' | 'unchanged';

/** Why a save was refused. `conflict` maps to HTTP 409. */
export interface SaveRefusal {
  kind: 'conflict';
  message: string;
}

export function saveStoryGraph(
  graph: StoryGraph,
  hash: string,
  unknownKinds: readonly UnknownKind[],
): Result<{ status: SaveStatus; summary: StoryGraphSummary }, SaveRefusal> {
  const db = getStoryDb();
  const id = storyRowId(graph.project, graph.graphId);
  const now = Date.now();
  const tx = db.transaction(() => {
    const prev = db.prepare('SELECT revision, hash, created_at FROM story_graphs WHERE id = ?').get(id) as
      | Pick<Row, 'revision' | 'hash' | 'created_at'>
      | undefined;
    if (prev && prev.revision > graph.revision) {
      return err<SaveRefusal>({
        kind: 'conflict',
        message: `revision ${graph.revision} is older than the stored revision ${prev.revision}; revision is monotonic`,
      });
    }
    if (prev && prev.revision === graph.revision) {
      if (prev.hash === hash) return ok('unchanged' as const);
      return err<SaveRefusal>({
        kind: 'conflict',
        message: `revision ${graph.revision} is already stored with different content (${prev.hash}); bump the revision`,
      });
    }
    db.prepare(
      `INSERT OR REPLACE INTO story_graphs
         (id, project, graph_id, name, revision, hash, format, node_count, edge_count, unknown_kinds, json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      graph.project,
      graph.graphId,
      `${graph.project}/${graph.graphId}`,
      graph.revision,
      hash,
      graph.format,
      graph.nodes.length,
      graph.edges.length,
      JSON.stringify(unknownKinds),
      canonicalStoryGraph(graph),
      prev?.created_at ?? now,
      now,
    );
    return ok(prev ? ('replaced' as const) : ('created' as const));
  });
  const outcome = tx();
  if (!outcome.ok) return outcome;
  const row = db.prepare(`SELECT ${SUMMARY_COLS} FROM story_graphs WHERE id = ?`).get(id) as Omit<Row, 'json'>;
  return ok({ status: outcome.data, summary: toSummary(row) });
}

export function deleteStoryGraph(project: string, graphId: string): boolean {
  return getStoryDb().prepare('DELETE FROM story_graphs WHERE id = ?').run(storyRowId(project, graphId)).changes > 0;
}
