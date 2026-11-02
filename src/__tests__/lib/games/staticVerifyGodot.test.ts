/**
 * The godot L2 branch (spark gtai-phase-2, WP2): a gtai step's L2 static verdict is the game-written
 * `lint` + `unit-tests` evidence under its game root — pass when both pass, fail when either fails,
 * otherwise deferred naming the kind ("no evidence yet") — and never a UE checker run.
 * Fixture evidence lives in a temp dir; the game HEAD is injected.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.hoisted(() => {
  const d = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${d}/pof-test-static-verify-godot-${process.pid}.db`;
});

import { staticVerdictForGame, verifyStaticAll, defaultGodotL2, type GodotL2Deps, type StaticVerifyDeps } from '@/lib/catalog/acceptance/staticVerify';
import type { UeChecker } from '@/lib/catalog/acceptance/ueStaticCheckers';
import { readGodotEvidence, godotEvidencePath } from '@/lib/games/godot/readEvidence';
import { GODOT_EVIDENCE_SCHEMA, type GodotEvidenceKind } from '@/lib/games/godot/evidenceTypes';

const HEAD = 'c'.repeat(40);
let root: string;
const ueRan: (string | null)[] = [];
const checks: UeChecker[] = [(r) => { ueRan.push(r); return { label: 'x', tier: 'L2', status: 'pass', detail: 'ue' }; }];

function write(kind: GodotEvidenceKind, status: 'pass' | 'fail', commit = HEAD) {
  mkdirSync(join(root, 'build', 'evidence'), { recursive: true });
  writeFileSync(godotEvidencePath(root, kind), JSON.stringify({
    schema: GODOT_EVIDENCE_SCHEMA, kind, gameId: 'gtai', commit, builtAt: '2026-11-02T10:00:00Z',
    godotVersion: '4.7.2', status, summary: `${kind} ${status}`,
  }));
}
const godot = (): GodotL2Deps => ({ rootFor: () => root, read: (r, k, g) => readGodotEvidence(r, k, { headOf: () => HEAD, gameId: g }) });
const verdict = () => staticVerdictForGame(checks, 'Stat Block', 'gtai', null, () => null, godot());

beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'pof-godot-l2-')); ueRan.length = 0; });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('godot L2 branch', () => {
  it('lint + unit-tests pass at HEAD → pass, without running a UE checker', () => {
    write('lint', 'pass'); write('unit-tests', 'pass');
    expect(verdict()).toMatchObject({ status: 'pass', tier: 'L2', label: 'Stat Block' });
    expect(ueRan).toEqual([]);
  });

  it('either kind failing → fail, naming the kind', () => {
    write('lint', 'pass'); write('unit-tests', 'fail');
    const v = verdict();
    expect(v?.status).toBe('fail');
    expect(v?.reason).toMatch(/^unit-tests: /);
  });

  it('a fail outranks a missing kind', () => {
    write('lint', 'fail');
    expect(verdict()?.status).toBe('fail');
  });

  it('no evidence → deferred "no evidence yet", naming both kinds (not deferred-unbound)', () => {
    const v = verdict();
    expect(v?.status).toBe('deferred');
    expect(v?.detail).toBe('0/2 Godot evidence kinds pass');
    expect(v?.reason).toMatch(/lint: no evidence yet.*; unit-tests: no evidence yet/);
  });

  it('one kind stale → deferred naming that kind only', () => {
    write('lint', 'pass'); write('unit-tests', 'pass', 'd'.repeat(40));
    const v = verdict();
    expect(v?.status).toBe('deferred');
    expect(v?.reason).toBe(`unit-tests: stale: evidence from ddddddd, HEAD ccccccc`);
  });

  it('a null game root → deferred-unbound with "no game root"', () => {
    const v = staticVerdictForGame(checks, 'Stat Block', 'gtai', null, () => null, { ...godot(), rootFor: () => null });
    expect(v).toMatchObject({ status: 'deferred', detail: 'engine project unbound', reason: expect.stringMatching(/^no game root for gtai/) });
  });

  it('a step with no static checks stays skipped (null)', () => {
    write('lint', 'pass'); write('unit-tests', 'pass');
    expect(staticVerdictForGame([], 'Stat Block', 'gtai', null, () => null, godot())).toBeNull();
  });

  it('the default deps read the env override root (POF_GAME_ROOT_GTAI)', () => {
    const prev = process.env.POF_GAME_ROOT_GTAI;
    process.env.POF_GAME_ROOT_GTAI = root;
    try {
      expect(defaultGodotL2.rootFor('gtai')).toBe(root);
    } finally {
      if (prev === undefined) delete process.env.POF_GAME_ROOT_GTAI; else process.env.POF_GAME_ROOT_GTAI = prev;
    }
  });

  it('verifyStaticAll grades a gtai row from evidence and reads each kind once per sweep', () => {
    write('lint', 'pass'); write('unit-tests', 'pass');
    const read = vi.fn(godot().read);
    const deps: StaticVerifyDeps = {
      resolveUeRoot: () => 'C:/ue',
      listArtifacts: () => [
        { catalogId: 'bestiary', entityId: 'gtai-cop', step: 'Stat Block', status: 'deferred' },
        { catalogId: 'bestiary', entityId: 'gtai-thug', step: 'Stat Block', status: 'deferred' },
      ],
      getStaticChecks: () => checks,
      upsertStatus: vi.fn(),
      entityGame: () => 'gtai',
      godot: { rootFor: () => root, read },
    };
    const s = verifyStaticAll({}, deps, { apply: false });
    expect(s.results.map((r) => r.to)).toEqual(['pass', 'pass']);
    expect(read).toHaveBeenCalledTimes(2); // lint + unit-tests, shared by both rows
    expect(ueRan).toEqual([]);
  });
});
