/**
 * Pitch-intake proposals (spark gtai-uprising-project, WP3) — the review queue between a model's
 * reading of `games/<id>/pitch.md` and the game's versioned truth. Server-only; shares `getDb()`.
 *
 * A stored proposal's id is `<runId>:<proposal id>`: the model numbers its proposals per reply
 * (`p1`, `p2`, …), so two runs would otherwise collide on the PK and a re-run would overwrite a
 * decision. `payload_json` keeps the proposal exactly as parsed.
 *
 * Accept/reject is recorded here; the WRITES an accept causes (canon.json + project_rules,
 * entities.json + catalog_entities) live in the intake route, and `syncGameDesign` is the one
 * file→DB re-seed.
 */
import type Database from 'better-sqlite3';
import { getDb } from '@/lib/db';
import { listRules, syncGameRules, upsertRule } from '@/lib/project-rules-db';
import { syncGameEntities, upsertEntity } from '@/lib/catalog-db';
import { codeSeededEntities } from '@/lib/catalog/seed';
import { GAMES } from '@/lib/games/registry';
import type { GameId } from '@/lib/games/types';
import { intakeContextFor, parseIntakeCallback } from '@/lib/games/intake/parse';
import { upsertGameEntityFile, upsertGameRuleFile } from '@/lib/games/intake/files';
import type { IntakeDecision, IntakeProposal, IntakeStatus, StoredIntakeProposal } from '@/lib/games/intake/types';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { profileOfRule } from '@/lib/catalog/canon/profiles';
import type { Result } from '@/types/result';

let ensuredDb: Database.Database | null = null;
function ensureTable(): Database.Database {
  const db = getDb();
  if (ensuredDb === db) return db;
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_intake_proposals (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      source_section TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      decided_at TEXT
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_game_intake_game ON game_intake_proposals(game_id, status)');
  ensuredDb = db;
  return db;
}

export const storedProposalId = (runId: string, proposalId: string) => `${runId}:${proposalId}`;

const COLUMNS = 'id, game_id, run_id, kind, payload_json, source_section, status, created_at, decided_at';

/** Column row → StoredIntakeProposal. Pure (exported for unit test). */
export function rowToProposal(row: Record<string, unknown>): StoredIntakeProposal {
  const payload = JSON.parse(row.payload_json as string) as IntakeProposal;
  const decidedAt = row.decided_at as string | null;
  return {
    ...payload,
    id: row.id as string,
    kind: row.kind as IntakeProposal['kind'],
    sourceSection: row.source_section as string,
    gameId: row.game_id as GameId,
    runId: row.run_id as string,
    status: row.status as IntakeStatus,
    ...(decidedAt ? { decidedAt } : {}),
  };
}

/** Store one run's proposals as pending. A proposal already stored for this run keeps its decision. */
export function insertProposals(gameId: GameId, runId: string, proposals: readonly IntakeProposal[]): number {
  const db = ensureTable();
  const stmt = db.prepare(`INSERT OR IGNORE INTO game_intake_proposals (id, game_id, run_id, kind, payload_json, source_section)
    VALUES (?, ?, ?, ?, ?, ?)`);
  let inserted = 0;
  db.transaction(() => {
    for (const p of proposals) {
      inserted += stmt.run(storedProposalId(runId, p.id), gameId, runId, p.kind, JSON.stringify(p), p.sourceSection).changes;
    }
  })();
  return inserted;
}

/** A game's proposals: pending first, then decided; newest run first within each. */
export function listProposals(gameId: GameId): StoredIntakeProposal[] {
  const rows = ensureTable().prepare(`SELECT ${COLUMNS} FROM game_intake_proposals WHERE game_id = ?
    ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC, run_id DESC, id`).all(gameId) as Record<string, unknown>[];
  return rows.map(rowToProposal);
}

export function getProposal(gameId: GameId, id: string): StoredIntakeProposal | null {
  const row = ensureTable().prepare(`SELECT ${COLUMNS} FROM game_intake_proposals WHERE game_id = ? AND id = ?`).get(gameId, id) as
    Record<string, unknown> | undefined;
  return row ? rowToProposal(row) : null;
}

export function setProposalStatus(gameId: GameId, id: string, status: Exclude<IntakeStatus, 'pending'>): StoredIntakeProposal | null {
  ensureTable().prepare(`UPDATE game_intake_proposals SET status = ?, decided_at = datetime('now') WHERE game_id = ? AND id = ?`)
    .run(status, gameId, id);
  return getProposal(gameId, id);
}

/**
 * Re-insert the game's versioned canon + entities the DB is missing, by id. Never overwrites a
 * row, so an operator's DB edit stands until the file changes. The same inserts run automatically
 * on the first rules/entities read of a process (`project-rules-db`, `catalog-db`), which is what
 * restores a deleted DB without a manual step; this is the explicit door.
 */
export function syncGameDesign(gameId: GameId): { rules: number; entities: number } {
  return { rules: syncGameRules(gameId), entities: syncGameEntities(gameId) };
}

/** A refusal carries the HTTP status the route answers with. */
export interface IntakeRefusal { status: number; message: string }
const refuse = (status: number, message: string): Result<never, IntakeRefusal> => ({ ok: false, error: { status, message } });

/** Only a game that keeps design truth on disk can take an intake (PoF's canon lives in code + DB). */
export function intakeRefusalFor(gameId: GameId): IntakeRefusal | null {
  return GAMES[gameId].designDir ? null : { status: 409, message: `game "${gameId}" has no designDir — the pitch intake writes games/<id>/*.json` };
}

/** Validate a callback body against the game's CURRENT manifest and store its proposals as pending. */
export function ingestIntakeCallback(gameId: GameId, body: unknown, registered: readonly string[]):
  Result<{ runId: string; received: number; inserted: number }, IntakeRefusal> {
  const blocked = intakeRefusalFor(gameId);
  if (blocked) return { ok: false, error: blocked };
  const parsed = parseIntakeCallback(body, intakeContextFor(gameId, registered));
  if (!parsed.ok) return refuse(400, parsed.error);
  const { runId, proposals } = parsed.data;
  return { ok: true, data: { runId, received: proposals.length, inserted: insertProposals(gameId, runId, proposals) } };
}

/**
 * Accept or reject one pending proposal.
 *
 * - reject: the decision is recorded; nothing else is written.
 * - accept: re-validated against the game's manifest AS IT IS NOW (it may have moved since the run),
 *   written to the versioned file FIRST and the DB second, then marked accepted. A file that cannot
 *   be read refuses the accept rather than being rewritten with one row; a DB write that fails after
 *   the file write is repaired by `syncGameDesign` on the next process.
 */
export function decideProposal(gameId: GameId, id: string, decision: IntakeDecision, registered: readonly string[]):
  Result<StoredIntakeProposal, IntakeRefusal> {
  const blocked = intakeRefusalFor(gameId);
  if (blocked) return { ok: false, error: blocked };
  const stored = getProposal(gameId, id);
  if (!stored) return refuse(404, `No intake proposal "${id}" for game "${gameId}"`);
  if (stored.status !== 'pending') return refuse(409, `Proposal "${id}" is already ${stored.status}`);
  if (decision === 'reject') return { ok: true, data: setProposalStatus(gameId, id, 'rejected')! };

  const ctx = intakeContextFor(gameId, registered);
  const again = { id: 'accept', kind: stored.kind, rule: stored.rule, entity: stored.entity, sourceSection: stored.sourceSection };
  const recheck = parseIntakeCallback({ runId: stored.runId, proposals: [again] }, ctx);
  if (!recheck.ok) return refuse(409, `Proposal no longer valid: ${recheck.error.replace(/^proposals\[0\]: /, '')}`);
  const proposal = recheck.data.proposals[0];

  if (proposal.kind === 'rule' && proposal.rule) {
    const rule = proposal.rule;
    const clash = listRules().find((r) => r.id === rule.id && profileOfRule(r) !== ctx.authoringProfile);
    if (clash) return refuse(409, `Rule id "${rule.id}" already belongs to profile "${profileOfRule(clash)}" — accepting would overwrite another world's law`);
    const file = upsertGameRuleFile(gameId, rule);
    if (!file.ok) return refuse(500, `canon.json not written: ${file.error}`);
    upsertRule(rule);
  } else if (proposal.kind === 'entity' && proposal.entity) {
    const e = proposal.entity;
    const seed = codeSeededEntities(e.catalogId).find((x) => x.id === e.entityId);
    if (seed) return refuse(409, `Entity id "${e.entityId}" is a code seed in "${e.catalogId}" ("${seed.name}") — the code seed always wins`);
    const entity: StoredCatalogEntity = {
      id: e.entityId, catalogId: e.catalogId, name: e.name, categoryPath: [], tags: e.tags, lifecycle: 'planned', data: e.data,
      provenance: { kind: 'authored', canonProfile: ctx.authoringProfile, authoredVia: 'intake', authoredAt: new Date().toISOString() },
    };
    const file = upsertGameEntityFile(gameId, entity);
    if (!file.ok) return refuse(500, `entities.json not written: ${file.error}`);
    upsertEntity({ catalogId: e.catalogId, entityId: e.entityId, source: 'user', entity });
  }
  return { ok: true, data: setProposalStatus(gameId, id, 'accepted')! };
}
