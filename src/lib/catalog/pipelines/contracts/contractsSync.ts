/**
 * SERVER-ONLY. The `contracts` ledger (read) and the folder → catalog mirror (write).
 *
 * Trigger: BOTH. `GET /api/games/gtai/quests` derives the ledger from disk on every read (read-only — a
 * display never writes), so it is always current; `POST /api/games/gtai/quests/sync` (operator-guarded)
 * is what the `/gta --quest` CLI calls after it writes or changes a package: it upserts the mirror entity
 * `gtai-<id>` and submits each step's slice through the ONE write door (`submitStepArtifact` →
 * `commitArtifact`), where the registered checker re-grades it. Quest folders are never written here.
 */
import { CONTRACT_CHECKERS } from '@/lib/catalog/acceptance/contractsCheckers';
import { submitStepArtifact } from '@/lib/catalog/headless';
import { listEntities, upsertEntity } from '@/lib/catalog-db';
import { resolveGamesRoot } from '@/lib/games/intake/files';
import { authoringProfileOf } from '@/lib/games/registry';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { QuestVerdict } from '@/lib/games/gtai-quest/types';
import { listQuestIds, readQuestSnapshot } from '@/lib/catalog/pipelines/contracts/contractsRead';
import {
  CONTRACT_STEPS, CONTRACTS_CATALOG, contractEntityId, snapshotOf, stepData,
  type ContractSnapshot, type ContractStepKey,
} from '@/lib/catalog/pipelines/contracts/contractsSnapshot';

export interface ContractStepRow {
  key: ContractStepKey;
  label: string;
  /** Exactly the artifact `data` the sync submits for this step. */
  data: Record<string, unknown>;
  acceptance: AcceptanceResult;
}

export interface ContractLedgerRow {
  questId: string;
  entityId: string;
  title: string;
  act: string;
  status: string;
  /** The guard verdict (null when the package does not parse). */
  verdict: QuestVerdict | null;
  blocked: boolean;
  steps: ContractStepRow[];
  snapshot: ContractSnapshot;
}

/** Grade one snapshot with exactly the checkers the registered steps use. Pure over the snapshot. */
export function ledgerRow(snapshot: ContractSnapshot): ContractLedgerRow {
  const steps = CONTRACT_STEPS.map(({ key, label }) => {
    const data = stepData(snapshot, key);
    return { key, label, data, acceptance: CONTRACT_CHECKERS[key](data) };
  });
  const verdict = snapshot.guards.verdict;
  return {
    questId: snapshot.questId,
    entityId: contractEntityId(snapshot.questId),
    title: snapshot.plan.title || snapshot.questId,
    act: snapshot.plan.act,
    status: snapshot.plan.status,
    verdict,
    blocked: verdict?.blocked ?? false,
    steps,
    snapshot,
  };
}

/** Every quest folder, derived from disk now. */
export function contractsLedger(root: string = resolveGamesRoot(), now: Date = new Date()): ContractLedgerRow[] {
  return listQuestIds(root).map((id) => ledgerRow(readQuestSnapshot(root, id, now)));
}

/** The mirror entity for a snapshot: id `gtai-<questId>`, GTAI's authoring profile, the snapshot in `data`. */
export function contractEntity(snapshot: ContractSnapshot): StoredCatalogEntity {
  const act = snapshot.plan.act || 'unknown-act';
  return {
    id: contractEntityId(snapshot.questId),
    catalogId: CONTRACTS_CATALOG,
    name: snapshot.plan.title || snapshot.questId,
    categoryPath: [act],
    tags: [act, snapshot.plan.status || 'unparsed'].filter(Boolean),
    lifecycle: 'planned',
    // `authoredVia` has no quest-sync door in the shared type; the council is GTAI's design intake.
    provenance: { kind: 'authored', canonProfile: authoringProfileOf('gtai'), authoredVia: 'intake', authoredAt: snapshot.derivedAt },
    data: { questId: snapshot.questId, questDir: snapshot.questDir, snapshot },
  };
}

export interface SyncedQuest {
  questId: string;
  entityId: string;
  steps: { label: string; status: string; tier: string; reason?: string }[];
}

export interface SyncSummary {
  synced: SyncedQuest[];
  /** Mirror entities whose quest folder no longer exists — reported, never deleted. */
  orphans: string[];
}

/** Mirror every quest folder (or one) into the catalog. Throws only on a DB failure. */
export function syncContracts(root: string = resolveGamesRoot(), only?: string, now: Date = new Date()): SyncSummary {
  const ids = listQuestIds(root);
  const targets = only ? ids.filter((id) => id === only) : ids;
  const synced = targets.map((questId) => {
    const snapshot = readQuestSnapshot(root, questId, now);
    const entity = contractEntity(snapshot);
    upsertEntity({ catalogId: CONTRACTS_CATALOG, entityId: entity.id, source: 'ingest', entity });
    const steps = CONTRACT_STEPS.map(({ key, label }) => {
      const out = submitStepArtifact(CONTRACTS_CATALOG, entity.id, label, stepData(snapshot, key), [], { attest: { engine: 'Code' } });
      const a = out.artifact;
      return { label, status: a.status, tier: a.tier ?? 'L0', ...(a.reason ? { reason: a.reason } : {}) };
    });
    return { questId, entityId: entity.id, steps };
  });
  const live = new Set(ids.map(contractEntityId));
  const orphans = listEntities(CONTRACTS_CATALOG)
    .filter((r) => snapshotOf(r.entity.data) && !live.has(r.entityId))
    .map((r) => r.entityId);
  return { synced, orphans };
}
