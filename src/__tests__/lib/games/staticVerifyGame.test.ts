/**
 * UE-static acceptance per GAME (WP1 criterion 3): a gtai entity's L2 static check reads gtai's
 * engine binding — unbound today — and returns `deferred` "no engine project bound for game gtai"
 * without running a checker against PoF's UE tree. A pof entity's check is byte-identical to the
 * pre-games behaviour.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Isolate from the operator's real ~/.pof/pof.db.
vi.hoisted(() => {
  const d = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${d}/pof-test-static-verify-game-${process.pid}.db`;
});

import {
  aggregateStatic, verifyStaticAll, staticVerdictFor, staticChecksFor, entityGameFor, unboundStaticVerdict,
  type StaticVerifyDeps,
} from '@/lib/catalog/acceptance/staticVerify';
import { resolveUeRoot, type UeChecker } from '@/lib/catalog/acceptance/ueStaticCheckers';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { GameId } from '@/lib/games/types';
import { upsertEntity, deleteEntity } from '@/lib/catalog-db';
import { codeSeededEntities } from '@/lib/catalog/seed';

const REASON = 'no engine project bound for game gtai';
const pass = (l: string): AcceptanceResult => ({ label: l, tier: 'L2', status: 'pass', detail: 'present' });

describe('verifyStaticAll per entity game', () => {
  const rows = [
    { catalogId: 'bestiary', entityId: 'pof-grunt', step: 'Stat Block', status: 'pass' },
    { catalogId: 'bestiary', entityId: 'gtai-cop', step: 'Stat Block', status: 'pass' },
  ];
  function deps(over: Partial<StaticVerifyDeps> = {}): StaticVerifyDeps {
    return {
      resolveUeRoot: () => 'C:/ue',
      listArtifacts: () => rows,
      getStaticChecks: () => [(root) => (root === 'C:/ue' ? pass('AARPGEnemyCharacter') : { label: 'x', tier: 'L2', status: 'fail', detail: `read ${root}` })],
      upsertStatus: vi.fn(),
      ...over,
    };
  }

  it('defers a gtai row with the unbound reason, never running a checker and never reading PoF’s root', () => {
    const seen: (string | null)[] = [];
    const check: UeChecker = (root) => { seen.push(root); return pass('A'); };
    const s = verifyStaticAll({}, deps({
      getStaticChecks: () => [check],
      entityGame: (_c, e): GameId => (e.startsWith('gtai-') ? 'gtai' : 'pof'),
    }), { apply: false });
    const gtai = s.results.find((r) => r.entityId === 'gtai-cop');
    expect(gtai?.to).toBe('deferred');
    expect(gtai?.reason).toBe(REASON);
    expect(seen).toEqual(['C:/ue']); // only the pof row ran its checker, against PoF's root
    expect(s.failed).toBe(0);
  });

  it('a pof row grades byte-identically with or without the game seam', () => {
    const before = verifyStaticAll({}, deps({ listArtifacts: () => [rows[0]] }), { apply: false });
    const after = verifyStaticAll({}, deps({ listArtifacts: () => [rows[0]], entityGame: () => 'pof' }), { apply: false });
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    expect(after.results[0].to).toBe('pass');
  });

  it('a non-pof game with a bound root grades against THAT root', () => {
    const s = verifyStaticAll({}, deps({
      listArtifacts: () => [rows[1]],
      entityGame: () => 'gtai',
      ueRootForGame: () => 'D:/gtai-ue',
    }), { apply: false });
    expect(s.results[0].to).toBe('fail');
    expect(s.results[0].reason ?? s.results[0].detail).toMatch(/D:\/gtai-ue/);
  });

  it('the unbound verdict is deferred at L2, never fail', () => {
    expect(unboundStaticVerdict('gtai', 'Stat Block')).toMatchObject({ status: 'deferred', tier: 'L2', reason: REASON });
  });
});

describe('staticVerdictFor against the real registry + store', () => {
  let ueDir: string;
  const prevEnv = process.env.POF_UE_ROOT;
  beforeAll(() => {
    ueDir = mkdtempSync(join(tmpdir(), 'pof-static-game-ue-'));
    process.env.POF_UE_ROOT = ueDir; // an empty UE tree: pof checks read it and defer "not in Source"
    upsertEntity({
      catalogId: 'bestiary', entityId: 'gtai-test-cop', source: 'user',
      entity: {
        id: 'gtai-test-cop', catalogId: 'bestiary', name: 'Beat Cop', categoryPath: [], tags: [], lifecycle: 'planned',
        provenance: { kind: 'authored', canonProfile: 'gtai', authoredVia: 'user', authoredAt: '2026-11-01T00:00:00.000Z' },
      },
    });
  });
  afterAll(() => {
    deleteEntity('bestiary', 'gtai-test-cop');
    if (prevEnv === undefined) delete process.env.POF_UE_ROOT; else process.env.POF_UE_ROOT = prevEnv;
    rmSync(ueDir, { recursive: true, force: true });
  });

  it('resolves the entity’s game from its stored provenance', () => {
    expect(entityGameFor('bestiary', 'gtai-test-cop')).toBe('gtai');
    expect(entityGameFor('bestiary', codeSeededEntities('bestiary')[0].id)).toBe('pof');
  });

  it('a gtai entity’s UE-static check is deferred: "no engine project bound for game gtai"', () => {
    const v = staticVerdictFor('bestiary', 'gtai-test-cop', 'Stat Block');
    expect(v?.status).toBe('deferred');
    expect(v?.reason).toBe(REASON);
  });

  it('a pof entity’s check is unchanged: the same verdict as its checks run against resolveUeRoot()', () => {
    const seed = codeSeededEntities('bestiary')[0].id;
    const checks = staticChecksFor('bestiary', seed, 'Stat Block');
    expect(checks?.length).toBeGreaterThan(0);
    const legacy = aggregateStatic(checks!.map((c) => c(resolveUeRoot())), 'Stat Block');
    expect(staticVerdictFor('bestiary', seed, 'Stat Block')).toEqual(legacy);
    expect(legacy?.status).toBe('deferred');
    expect(legacy?.reason).not.toBe(REASON);
  });
});
