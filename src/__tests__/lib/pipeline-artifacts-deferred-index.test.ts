/**
 * The runner's work queue (`listDeferredArtifacts`) runs on EVERY worker tick and every drain
 * request. This pins two things: (1) the index that makes it a seek exists and actually covers
 * the predicate the code runs, and (2) adding it changed NOTHING about what the query returns.
 *
 * Uses a throwaway DB (POF_DB_PATH set before the import graph loads) so it never touches the
 * user's real ~/.pof/pof.db.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-deferred-index-${process.pid}.db`;
});

import { upsertArtifact, listDeferredArtifacts, deferredQuery } from '@/lib/pipeline-artifacts-db';
import { getDb } from '@/lib/db';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

const INDEX = 'idx_artifacts_deferred_queue';

const art = (over: Partial<PipelineArtifact> & Pick<PipelineArtifact, 'catalogId' | 'entityId' | 'step'>): PipelineArtifact => ({
  data: {}, ueAssets: [], status: 'deferred', ...over,
});

beforeEach(() => {
  listDeferredArtifacts(); // forces the lazy DDL before the cleanup DELETE
  getDb().prepare('DELETE FROM pipeline_artifacts').run();
});

describe('deferred-queue index', () => {
  it('is created idempotently alongside the DDL, on the columns the queue filters + orders by', () => {
    const row = getDb()
      .prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name=?")
      .get(INDEX) as { sql: string } | undefined;
    expect(row?.sql).toBeTruthy();
    expect(row!.sql.replace(/\s+/g, ' ')).toContain('(status, catalog_id, entity_id, step)');
  });

  it('re-running the DDL is a no-op (IF NOT EXISTS — safe on a populated DB)', () => {
    const count = () =>
      (getDb().prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='index' AND name=?").get(INDEX) as { c: number }).c;
    expect(count()).toBe(1);
    getDb().exec(`CREATE INDEX IF NOT EXISTS ${INDEX} ON pipeline_artifacts (status, catalog_id, entity_id, step)`);
    expect(count()).toBe(1);
  });

  it('SERVES the query the code actually runs — a seek, not a whole-table scan', () => {
    // EXPLAINs `deferredQuery` itself, so the plan can never drift from the runtime SQL.
    const plan = (filter?: Parameters<typeof deferredQuery>[0]) => {
      const { sql, args } = deferredQuery(filter);
      return (getDb().prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args) as { detail: string }[])
        .map((r) => r.detail)
        .join(' | ');
    };
    // The two shapes that used to full-scan: the global worker tick and the tier-only sweep.
    expect(plan()).toContain(`SEARCH pipeline_artifacts USING INDEX ${INDEX}`);
    expect(plan()).not.toContain('SCAN pipeline_artifacts');
    expect(plan({ tier: 'L3' })).toContain(`USING INDEX ${INDEX}`);
    // The ORDER BY is free — the index already yields (catalog_id, entity_id, step) order.
    expect(plan()).not.toContain('TEMP B-TREE FOR ORDER BY');
    // Scoped drains still seek (the index leads with status, then the scope columns).
    expect(plan({ catalogId: 'items' })).toContain(`USING INDEX ${INDEX}`);
    expect(plan({ catalogId: 'items', entityId: 'item-1' })).toContain(`USING INDEX ${INDEX}`);
  });
});

describe('listDeferredArtifacts — unchanged behaviour', () => {
  beforeEach(() => {
    upsertArtifact(art({ catalogId: 'items', entityId: 'item-2', step: 'Test Gate', tier: 'L3' }));
    upsertArtifact(art({ catalogId: 'items', entityId: 'item-1', step: 'Visual Gate', tier: 'L4' }));
    upsertArtifact(art({ catalogId: 'items', entityId: 'item-1', step: 'Test Gate', tier: 'L3' }));
    upsertArtifact(art({ catalogId: 'combat-map', entityId: 'arena', step: 'Test Gate', tier: 'L3' }));
    // Not deferred → never in the queue, whatever the tier says.
    upsertArtifact(art({ catalogId: 'items', entityId: 'item-1', step: 'Attributes', tier: 'L3', status: 'pass' }));
    upsertArtifact(art({ catalogId: 'items', entityId: 'item-1', step: 'Economy', tier: 'L0', status: 'fail' }));
  });

  const key = (a: PipelineArtifact) => `${a.catalogId}/${a.entityId}/${a.step}`;

  it('returns every deferred row, ordered by catalog, entity, step', () => {
    expect(listDeferredArtifacts().map(key)).toEqual([
      'combat-map/arena/Test Gate',
      'items/item-1/Test Gate',
      'items/item-1/Visual Gate',
      'items/item-2/Test Gate',
    ]);
  });

  it('narrows by tier / catalog / entity exactly as before', () => {
    expect(listDeferredArtifacts({ tier: 'L4' }).map(key)).toEqual(['items/item-1/Visual Gate']);
    expect(listDeferredArtifacts({ tier: 'L3' }).map(key)).toEqual([
      'combat-map/arena/Test Gate',
      'items/item-1/Test Gate',
      'items/item-2/Test Gate',
    ]);
    expect(listDeferredArtifacts({ catalogId: 'items' }).map(key)).toEqual([
      'items/item-1/Test Gate',
      'items/item-1/Visual Gate',
      'items/item-2/Test Gate',
    ]);
    expect(listDeferredArtifacts({ catalogId: 'items', entityId: 'item-1' }).map(key)).toEqual([
      'items/item-1/Test Gate',
      'items/item-1/Visual Gate',
    ]);
    expect(listDeferredArtifacts({ tier: 'L3', catalogId: 'items', entityId: 'item-1' }).map(key)).toEqual([
      'items/item-1/Test Gate',
    ]);
  });

  it('excludes non-deferred statuses', () => {
    expect(listDeferredArtifacts().every((a) => a.status === 'deferred')).toBe(true);
  });
});
