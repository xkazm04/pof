/**
 * `craft_verdict_history` — the A-axis gauge log (direction: craft-verdict-history).
 *
 * `craft_verdicts` keeps ONE row per (catalog, entity, step), so a re-gauge used to destroy
 * the evidence that a cell moved. This pins the mirror of the R-axis pattern: history appended
 * in the SAME transaction as the upsert, bounded at 20, plus the pure trend/movement helpers
 * `craftForCell` surfaces — and, above all, that none of it can touch an R-grade.
 *
 * Throwaway DB (POF_DB_PATH set before the import graph opens better-sqlite3).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeFs = require('fs') as typeof import('fs');
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  const dbPath = `${dir}/pof-test-craft-history-${process.pid}.db`;
  // The seed assertion needs a DB with no history table — start from nothing every run.
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (nodeFs.existsSync(p)) nodeFs.unlinkSync(p);
  }
  process.env.POF_DB_PATH = dbPath;
});
import { getDb } from '@/lib/db';
import {
  upsertCraftVerdict,
  listCraftVerdicts,
  listCraftVerdictHistory,
  craftHistoryIndex,
  craftVerdictKey,
  CRAFT_HISTORY_LIMIT,
  type CraftVerdict,
} from '@/lib/craft/craft-verdicts-db';
import {
  buildCraftTrend,
  craftMovementOf,
  craftMovementLabel,
  craftTrendSummary,
  craftForCell,
  CRAFT_HISTORY_LIMIT as CRAFT_HISTORY_LIMIT_PURE,
  type CraftTrendInput,
  type CraftVerdictView,
} from '@/lib/craft/craftCell';
import type { GaugedCraftLevel } from '@/lib/status/craft';

const LEGACY = {
  catalogId: 'legacy-cat',
  entityId: 'legacy-entity',
  step: 'Legacy Step',
};

/**
 * Simulate a DB that already held craft verdicts before the log existed — written RAW, so the
 * seed path (not the transactional upsert) is what puts them in history.
 */
beforeAll(() => {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS craft_verdicts (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      step TEXT NOT NULL,
      lens TEXT NOT NULL,
      lens_version INTEGER NOT NULL DEFAULT 1,
      a_level TEXT NOT NULL CHECK(a_level IN ('A1','A2','A3','A4')),
      findings TEXT NOT NULL DEFAULT '[]',
      model TEXT NOT NULL DEFAULT '',
      effort TEXT NOT NULL DEFAULT '',
      artifact_updated_at TEXT,
      judged_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id, step)
    )
  `);
  db.prepare(
    `INSERT INTO craft_verdicts (catalog_id, entity_id, step, lens, lens_version, a_level, findings, model, judged_at)
     VALUES (?, ?, ?, 'game-systems-code', 1, 'A2', '[]', 'legacy-model', '2026-01-01 00:00:00')`,
  ).run(LEGACY.catalogId, LEGACY.entityId, LEGACY.step);
});

function verdict(over: Partial<CraftVerdict> = {}): CraftVerdict {
  return {
    catalogId: 'items',
    entityId: 'iron-sword',
    step: 'Concept Brief',
    lens: 'game-systems-code',
    lensVersion: 1,
    aLevel: 'A1',
    findings: [{ criterion: 'systemic-depth', detail: 'no interlocking systems named', class: 'content' }],
    model: 'opus-craft-fleet-test',
    ...over,
  };
}

describe('craft_verdict_history — the gauge log', () => {
  it('seeds pre-existing single-row verdicts as their own first history entry', () => {
    // The first craft-verdicts-db call triggers ensureTable → ensureHistoryTable → seed.
    const kept = listCraftVerdictHistory(LEGACY.catalogId, LEGACY.entityId, LEGACY.step);
    expect(kept).toHaveLength(1);
    expect(kept[0].aLevel).toBe('A2');
    expect(kept[0].model).toBe('legacy-model');
    expect(kept[0].judgedAt).toBe('2026-01-01 00:00:00');
  });

  it('the seed is not re-run on a later ensure (no duplicate first points)', () => {
    listCraftVerdicts();
    craftHistoryIndex();
    expect(listCraftVerdictHistory(LEGACY.catalogId, LEGACY.entityId, LEGACY.step)).toHaveLength(1);
  });

  it('appends every gauge while keeping exactly one CURRENT row per cell', () => {
    upsertCraftVerdict(verdict({ aLevel: 'A1' }));
    upsertCraftVerdict(verdict({ aLevel: 'A2' }));
    const written = upsertCraftVerdict(verdict({ aLevel: 'A3' }));

    const current = listCraftVerdicts('items');
    expect(current).toHaveLength(1);
    expect(current[0].aLevel).toBe('A3');

    const kept = listCraftVerdictHistory('items', 'iron-sword', 'Concept Brief');
    expect(kept.map((k) => k.aLevel)).toEqual(['A1', 'A2', 'A3']);
    // Same transaction, same stamp: the current row and its newest history entry agree.
    expect(written.judgedAt).toBe(current[0].judgedAt);
    expect(kept[kept.length - 1].judgedAt).toBe(current[0].judgedAt);
  });

  it('bounds retention at CRAFT_HISTORY_LIMIT, keeping the NEWEST gauges', () => {
    const cell = { catalogId: 'items', entityId: 'bound-test', step: 'Concept Brief' };
    const levels: GaugedCraftLevel[] = ['A1', 'A2', 'A3', 'A4'];
    for (let i = 0; i < CRAFT_HISTORY_LIMIT + 5; i++) {
      upsertCraftVerdict(verdict({ ...cell, aLevel: levels[i % 4], model: `run-${i}` }));
    }
    const kept = listCraftVerdictHistory(cell.catalogId, cell.entityId, cell.step);
    expect(kept).toHaveLength(CRAFT_HISTORY_LIMIT);
    expect(kept[0].model).toBe('run-5');
    expect(kept[kept.length - 1].model).toBe(`run-${CRAFT_HISTORY_LIMIT + 4}`);
    // The CURRENT gauge is never pruned — it lives in the other table.
    expect(listCraftVerdicts('items').find((v) => v.entityId === 'bound-test')).toBeTruthy();
  });

  it('the bound has ONE definition (db re-exports the pure one)', () => {
    expect(CRAFT_HISTORY_LIMIT).toBe(CRAFT_HISTORY_LIMIT_PURE);
    expect(CRAFT_HISTORY_LIMIT).toBe(20);
  });

  it('craftHistoryIndex groups every cell in one pass', () => {
    const idx = craftHistoryIndex('items');
    expect(idx.get(craftVerdictKey('items', 'iron-sword', 'Concept Brief'))!.map((v) => v.aLevel)).toEqual([
      'A1',
      'A2',
      'A3',
    ]);
    expect(idx.get(craftVerdictKey('items', 'bound-test', 'Concept Brief'))).toHaveLength(CRAFT_HISTORY_LIMIT);
    // Catalog filter is honoured — the legacy catalog is not in the items index.
    expect(idx.has(craftVerdictKey(LEGACY.catalogId, LEGACY.entityId, LEGACY.step))).toBe(false);
  });

  it('history rows carry the staleness anchor they were gauged against', () => {
    upsertCraftVerdict(verdict({ entityId: 'anchored', aLevel: 'A2', artifactUpdatedAt: '2026-08-01 10:00:00' }));
    upsertCraftVerdict(verdict({ entityId: 'anchored', aLevel: 'A3', artifactUpdatedAt: '2026-08-02 10:00:00' }));
    const kept = listCraftVerdictHistory('items', 'anchored', 'Concept Brief');
    expect(kept.map((k) => k.artifactUpdatedAt)).toEqual(['2026-08-01 10:00:00', '2026-08-02 10:00:00']);
  });
});

// ── Pure trend model ────────────────────────────────────────────────────────────────

function point(aLevel: GaugedCraftLevel, over: Partial<CraftTrendInput> = {}): CraftTrendInput {
  return { aLevel, lensVersion: 1, model: 'm', ...over };
}

describe('buildCraftTrend / craftMovementOf', () => {
  it('reports rungs climbed across re-gauges', () => {
    const t = buildCraftTrend([point('A1'), point('A2'), point('A3')]);
    expect(t.delta).toBe(2);
    expect(t.direction).toBe('improved');
    expect(t.best).toBe('A3');
    expect(t.worst).toBe('A1');

    const m = craftMovementOf(t)!;
    expect(m).toMatchObject({ from: 'A1', to: 'A3', delta: 2, direction: 'improved', gauges: 3 });
  });

  it('reports a regression as a regression, not an improvement', () => {
    const t = buildCraftTrend([point('A4'), point('A2')]);
    expect(t.direction).toBe('regressed');
    expect(craftMovementOf(t)!.delta).toBe(-2);
  });

  it('a single gauge yields NO movement — one measurement is not a comparison', () => {
    const t = buildCraftTrend([point('A3')]);
    expect(t.delta).toBeNull();
    expect(t.direction).toBe('none');
    expect(craftMovementOf(t)).toBeUndefined();
    expect(craftMovementLabel(undefined)).toContain('no prior gauge');
  });

  it('an empty log says so instead of implying an A-level', () => {
    const t = buildCraftTrend([]);
    expect(t.points).toEqual([]);
    expect(t.best).toBeNull();
    expect(craftTrendSummary(t)).toContain('No craft gauge recorded');
  });

  it('orders by judgedAt when every point carries one', () => {
    const t = buildCraftTrend([
      point('A3', { judgedAt: '2026-08-03 00:00:00' }),
      point('A1', { judgedAt: '2026-08-01 00:00:00' }),
      point('A2', { judgedAt: '2026-08-02 00:00:00' }),
    ]);
    expect(t.points.map((p) => p.aLevel)).toEqual(['A1', 'A2', 'A3']);
    expect(craftMovementOf(t)!.at).toBe('2026-08-03 00:00:00');
  });

  it('sameContentAsPrevious is true only when BOTH gauges are anchored to the same artifact', () => {
    const anchored = buildCraftTrend([
      point('A1', { artifactUpdatedAt: 'T1' }),
      point('A2', { artifactUpdatedAt: 'T1' }),
      point('A3', { artifactUpdatedAt: 'T2' }),
    ]);
    expect(anchored.points.map((p) => p.sameContentAsPrevious)).toEqual([null, true, false]);

    // A missing anchor is UNKNOWN, never "same" — an unbound gauge must not imply the
    // content stood still.
    const unbound = buildCraftTrend([point('A1'), point('A2')]);
    expect(unbound.points[1].sameContentAsPrevious).toBe(false);
  });

  it('labels the movement in one honest sentence', () => {
    const improved = craftMovementOf(
      buildCraftTrend([point('A1', { judgedAt: '2026-08-01 09:00:00' }), point('A3', { judgedAt: '2026-08-18 14:03:00' })]),
    );
    expect(craftMovementLabel(improved)).toBe('Moved A1 → A3 on 2026-08-18 (2 gauges).');

    const held = craftMovementOf(
      buildCraftTrend([point('A2', { judgedAt: '2026-08-01 09:00:00' }), point('A2', { judgedAt: '2026-08-18 14:03:00' })]),
    );
    expect(craftMovementLabel(held)).toBe('Held at A2 across 2 gauges on 2026-08-18.');

    const dropped = craftMovementOf(
      buildCraftTrend([point('A3', { judgedAt: '2026-08-01 09:00:00' }), point('A1', { judgedAt: '2026-08-18 14:03:00' })]),
    );
    expect(craftMovementLabel(dropped)).toContain('Dropped A3 → A1');
  });
});

describe('craftForCell surfaces the movement it was handed', () => {
  /** A real (catalogId, step) pair from the fleet audit, so the cell resolves a fact. */
  const FACT = (() => {
    const facts = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../../lib/status/step-facts.json'), 'utf8'),
    ) as { steps: { catalogId: string; step: string }[] };
    return facts.steps[0];
  })();

  function view(over: Partial<CraftVerdictView>): CraftVerdictView {
    return {
      catalogId: FACT.catalogId,
      entityId: 'e1',
      step: FACT.step,
      aLevel: 'A3',
      lensVersion: 1,
      ...over,
    };
  }

  it('carries the movement of the verdict the cell REPORTS (the worst one)', () => {
    const worstMovement = { from: 'A2' as const, to: 'A1' as const, delta: -1, direction: 'regressed' as const, gauges: 2 };
    const cell = craftForCell(
      FACT.catalogId,
      FACT.step,
      [
        view({ entityId: 'good', aLevel: 'A4', movement: { from: 'A1', to: 'A4', delta: 3, direction: 'improved', gauges: 4 } }),
        view({ entityId: 'bad', aLevel: 'A1', movement: worstMovement }),
      ],
      new Map(),
    );
    expect(cell).toBeTruthy();
    expect(cell!.movement).toEqual(worstMovement);
  });

  it('omits movement entirely when the reported verdict has never moved', () => {
    const cell = craftForCell(FACT.catalogId, FACT.step, [view({ aLevel: 'A2' })], new Map());
    expect(cell!.movement).toBeUndefined();
  });

  it('no verdicts at all still yields a cell and no movement', () => {
    const cell = craftForCell(FACT.catalogId, FACT.step, [], new Map());
    expect(cell!.craft.level).toBe('A0');
    expect(cell!.movement).toBeUndefined();
  });
});

// ── The read path (one request, movement attached) ──────────────────────────────────

describe('GET /api/craft-verdicts attaches movement without a per-cell round-trip', () => {
  it('carries each verdict\'s movement in the SAME response', async () => {
    upsertCraftVerdict(verdict({ entityId: 'gauged-once', aLevel: 'A2' }));
    const { GET } = await import('@/app/api/craft-verdicts/route');
    const { NextRequest } = await import('next/server');
    const res = await GET(new NextRequest('http://localhost/api/craft-verdicts?catalogId=items'));
    const json = (await res.json()) as {
      success: boolean;
      data: (CraftVerdict & { movement?: { from: string; to: string; gauges: number } })[];
    };
    expect(json.success).toBe(true);

    const moved = json.data.find((v) => v.entityId === 'iron-sword')!;
    expect(moved.movement).toMatchObject({ from: 'A1', to: 'A3', delta: 2, direction: 'improved', gauges: 3 });

    // A cell gauged exactly once carries no movement key at all (never a fabricated "unchanged").
    const once = json.data.find((v) => v.entityId === 'gauged-once');
    expect(once).toBeTruthy();
    expect(once!.movement).toBeUndefined();
  });

  it('?history=1 returns one cell\'s full trend, and refuses an under-specified request', async () => {
    const { GET } = await import('@/app/api/craft-verdicts/route');
    const { NextRequest } = await import('next/server');
    const ok = await GET(
      new NextRequest(
        'http://localhost/api/craft-verdicts?history=1&catalogId=items&entityId=iron-sword&step=Concept%20Brief',
      ),
    );
    const json = (await ok.json()) as {
      success: boolean;
      data: { history: CraftVerdict[]; movement: { to: string } | null; summary: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.history.map((h) => h.aLevel)).toEqual(['A1', 'A2', 'A3']);
    expect(json.data.movement!.to).toBe('A3');
    expect(json.data.summary).toContain('3 gauges');

    const bad = await GET(new NextRequest('http://localhost/api/craft-verdicts?history=1&catalogId=items'));
    expect(((await bad.json()) as { success: boolean }).success).toBe(false);
  });
});

// ── The structural guarantee ────────────────────────────────────────────────────────

describe('the gauge log cannot move an R-grade', () => {
  const ROOT = path.resolve(__dirname, '../../../..');
  const GRADING = ['src/lib/catalog/acceptance', 'src/lib/status/statusModel.ts', 'src/lib/status/readiness.ts'];

  function* sourceFiles(rel: string): Generator<string> {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return;
    if (fs.statSync(abs).isFile()) return yield abs;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const child = path.join(rel, entry.name);
      if (entry.isDirectory()) yield* sourceFiles(child);
      else if (/\.(ts|tsx)$/.test(entry.name)) yield path.join(ROOT, child);
    }
  }

  it('no grading module reads craft_verdict_history or the trend helpers', () => {
    const offenders: string[] = [];
    for (const dir of GRADING) {
      for (const file of sourceFiles(dir)) {
        const src = fs.readFileSync(file, 'utf8');
        if (/craft_verdict_history|buildCraftTrend|craftMovementOf|craftHistoryIndex|listCraftVerdictHistory/.test(src)) {
          offenders.push(path.relative(ROOT, file));
        }
      }
    }
    expect(offenders, `grading modules reading the craft log: ${offenders.join(', ')}`).toEqual([]);
    // Guard is not vacuous.
    for (const dir of GRADING) expect(fs.existsSync(path.join(ROOT, dir))).toBe(true);
  });

  it('the craft write path never touches judge_verdicts', () => {
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS judge_verdicts (
      catalog_id TEXT NOT NULL, entity_id TEXT NOT NULL, step TEXT NOT NULL, judge TEXT NOT NULL,
      verdict TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, findings TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '', judged_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id, step, judge))`);
    const before = (db.prepare('SELECT COUNT(*) AS n FROM judge_verdicts').get() as { n: number }).n;
    upsertCraftVerdict(verdict({ entityId: 'r-axis-probe', aLevel: 'A4', findings: [] }));
    const after = (db.prepare('SELECT COUNT(*) AS n FROM judge_verdicts').get() as { n: number }).n;
    expect(after).toBe(before);
  });

  it('craft-verdicts-db imports nothing from the grading path', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/lib/craft/craft-verdicts-db.ts'), 'utf8');
    const specifiers = [...src.matchAll(/^\s*(?:import|export)\s[^'"]*from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((s) => /judge-verdicts-db|catalog\/acceptance|statusModel|readiness/.test(s))).toEqual([]);
  });
});
