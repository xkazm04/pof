'use client';

/**
 * The Game home's reads — every number it shows, each from the source that owns it:
 *  - pipeline rows + coverage: the game's manifest (`gamePipelineRows`) over the game's entities
 *    (`statusEntitiesForGame` — the /status set: for PoF the seeds only, for another game seeds + its
 *    persisted rows). The lab tree counts `labEntitiesOf` (seeds + hydrated ingests/drafts of the game), so
 *    the two coincide for a non-PoF game and differ for PoF by the hydrated persisted rows);
 *  - readiness: the SAME /status model (`buildSwimlane` → `readinessOf`) over the game's artifact
 *    rows, reduced to the best reached rung, or "unmeasured" — never R0 for nothing measured;
 *  - canon: `rulesForProfile` over the canon store, union across the game's profiles;
 *  - pending intake: `GET /api/games/<id>/intake` (WP3). Absent / failing route = "unavailable";
 *  - engine: `GameDef.engine`, pure.
 * Coverage and readiness stay separate fields; nothing here blends them.
 */
import '@/lib/catalog/pipelines/registry.generated';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { rulesForProfile } from '@/lib/catalog/canon/profiles';
import { tryApiFetch } from '@/lib/api-utils';
import { useCatalogStore } from '@/stores/catalogStore';
import { useActiveGame } from '@/stores/activeGameStore';
import { useCanonStore } from '@/components/layout-lab/canonStore';
import { useStatusArtifacts } from '@/components/status/statusArtifactSource';
import { useStatusVerdicts } from '@/components/status/statusVerdictSource';
import { stepsFor } from '@/lib/status/statusReads';
import { buildSwimlane, isSyntheticEntity } from '@/lib/status/statusModel';
import { readinessOf } from '@/lib/status/readiness';
import {
  bestReadiness, engineStateOf, gamePipelineRows, statusEntitiesForGame,
  type EngineState, type GamePipelineRow, type ReadinessCode,
} from '@/lib/games/scope';
import type { GameDef } from '@/lib/games/types';

/** A pipeline's readiness as the home shows it. */
export type RowReadiness =
  | { kind: 'loading' }
  | { kind: 'unknown'; error: string }
  | { kind: 'measured'; level: ReadinessCode | 'unmeasured' };

export interface GameHomeRow extends GamePipelineRow {
  readiness: RowReadiness | null; // null = not applicable (planned / unregistered)
}

export type IntakeRead =
  | { kind: 'loading' }
  | { kind: 'ok'; pending: number }
  | { kind: 'unavailable'; reason: string };

export interface GameHomeData {
  game: GameDef;
  rows: GameHomeRow[];
  canonRuleCount: number;
  intake: IntakeRead;
  retryIntake: () => void;
  engine: EngineState;
  retryArtifacts: (catalogId: string) => void;
}

/** Pending count from the intake GET, tolerant of `{ pending }` or a `proposals[]` with statuses. */
export function pendingOf(data: unknown): number | null {
  const d = data as { pending?: unknown; proposals?: unknown } | null;
  if (typeof d?.pending === 'number') return d.pending;
  if (Array.isArray(d?.pending)) return d.pending.length;
  if (Array.isArray(d?.proposals)) return d.proposals.filter((p) => (p as { status?: string })?.status === 'pending').length;
  return null;
}

function useIntakeRead(gameId: string): { intake: IntakeRead; retry: () => void } {
  const [state, setState] = useState<{ key: string; read: IntakeRead }>({ key: '', read: { kind: 'loading' } });
  const [attempt, setAttempt] = useState(0);
  const key = `${gameId}#${attempt}`;
  useEffect(() => {
    let cancelled = false;
    void tryApiFetch<unknown>(`/api/games/${encodeURIComponent(gameId)}/intake`).then((r) => {
      if (cancelled) return;
      const pending = r.ok ? pendingOf(r.data) : null;
      setState({
        key,
        read: pending !== null ? { kind: 'ok', pending }
          : { kind: 'unavailable', reason: r.ok ? 'unexpected response shape' : r.error },
      });
    });
    return () => { cancelled = true; };
  }, [gameId, key]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { intake: state.key === key ? state.read : { kind: 'loading' }, retry };
}

export function useGameHomeData(): GameHomeData {
  const { gameId, game } = useActiveGame();
  const seeds = useCatalogStore((s) => s.entitiesByCatalog);
  const drafts = useCatalogStore((s) => s.draftEntitiesByCatalog);
  const rules = useCanonStore((s) => s.rules);
  const registered = useMemo(() => allCatalogPipelines().map((p) => p.catalogId), []);

  const baseRows = useMemo(
    () => gamePipelineRows(gameId, registered, statusEntitiesForGame(gameId, seeds, drafts)),
    [gameId, registered, seeds, drafts],
  );
  const measuredIds = useMemo(
    () => baseRows.filter((r) => r.fit !== 'planned' && r.registered).map((r) => r.catalogId),
    [baseRows],
  );
  // Same shared, deduped /status read (rows already scoped to this game's entities).
  const { catalogs, retryCatalog } = useStatusArtifacts(measuredIds);
  const { verdicts } = useStatusVerdicts();

  const rows = useMemo<GameHomeRow[]>(() => {
    const reads = new Map((catalogs ?? []).map((c) => [c.catalogId, c]));
    const byCatalog = verdicts && verdicts.ok ? verdicts.byCatalog : null;
    return baseRows.map((r) => {
      if (r.fit === 'planned' || !r.registered) return { ...r, readiness: null };
      const read = reads.get(r.catalogId);
      if (!read || verdicts === null) return { ...r, readiness: { kind: 'loading' } };
      if (read.error !== null) return { ...r, readiness: { kind: 'unknown', error: read.error } };
      const lane = buildSwimlane(r.catalogId, r.catalogId, stepsFor(r.catalogId), read.rows, byCatalog?.get(r.catalogId) ?? []);
      const measured = read.rows.filter((a) => !isSyntheticEntity(a.entityId)).length;
      return { ...r, readiness: { kind: 'measured', level: bestReadiness(measured, lane.cells.map(readinessOf)) } };
    });
  }, [baseRows, catalogs, verdicts]);

  const canonRuleCount = useMemo(() => {
    const ids = new Set<string>();
    for (const p of game.canonProfiles) {
      try { for (const r of rulesForProfile(rules, p)) ids.add(r.id); } catch { /* unregistered profile: no rules to count */ }
    }
    return ids.size;
  }, [game, rules]);

  const { intake, retry } = useIntakeRead(gameId);
  return { game, rows, canonRuleCount, intake, retryIntake: retry, engine: engineStateOf(game), retryArtifacts: retryCatalog };
}
