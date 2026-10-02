import { describe, it, expect, vi } from 'vitest';

/**
 * The one re-grade door (`acceptance/regrade.ts`): the four disk-truth sweeps (verify-static,
 * verify-packaging, bind-icons, drain-python) persist, report and scope through ONE writer,
 * ONE row meaning and ONE filter parser, and an applied sweep re-derives the lifecycle cache of
 * each entity it touched — once. Pure deps and a fake io only: no row ever reaches SQLite here.
 */
vi.hoisted(() => {
  // A throwaway DB for this file (never ~/.pof/pof.db) — though no case here opens it.
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/pae-regrade-${process.pid}/pof.db`;
});

import fs from 'node:fs';
import path from 'node:path';
import * as regrade from '@/lib/catalog/acceptance/regrade';
import type { ArtifactIO } from '@/lib/catalog/acceptance/regrade';
import { verifyStaticAll, type StaticVerifyDeps } from '@/lib/catalog/acceptance/staticVerify';
import { verifyPackagingAll, type PackagingVerifyDeps } from '@/lib/catalog/acceptance/packagingVerify';
import { makeBindIconsDeps } from '@/lib/catalog/acceptance/bindIconsDeps';
import type { PackageManifest } from '@/lib/catalog/packaging/packageArtifacts';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';

const src = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

function fakeIO(rows: Record<string, { data: Record<string, unknown>; ueAssets: string[] }> = {}) {
  const io = {
    list: vi.fn(() => []),
    get: vi.fn((c: string, e: string, s: string) => rows[`${c}|${e}|${s}`] ?? null),
    upsert: vi.fn<ArtifactIO['upsert']>(),
    syncLifecycle: vi.fn<(catalogId: string, entityId: string) => void>(),
  };
  return io satisfies ArtifactIO;
}

describe('verifyPackagingAll dry run — one meaning of `changed`', () => {
  it('reports a would-be move as changed:true, exactly as the static sweep does', () => {
    const manifest: PackageManifest = {
      catalogId: 'c', entityId: 'e', packagedAt: 't', missing: [], ueDeclarations: [],
      files: [{ name: 'a.glb', sourceStep: '3D Model', origin: 'referenced', path: 'generated/a.glb', bytes: 10, sha1: 'x' }],
    };
    const deps: PackagingVerifyDeps = {
      listArtifacts: () => [{ catalogId: 'c', entityId: 'e', step: 'UE Packaging', status: 'deferred' }],
      isPackaging: () => true,
      getSiblings: () => [],
      build: () => manifest,
      upsertStatus: vi.fn(),
    };
    const s = verifyPackagingAll({}, deps, { apply: false });
    expect(s.results[0]).toMatchObject({ from: 'deferred', to: 'pass', changed: true });
    expect(s.changed).toBe(0); // the summary still counts WRITES — a dry run writes none
    expect(deps.upsertStatus).not.toHaveBeenCalled();
  });
});

describe('persistRegrade — the one writer', () => {
  const key = { catalogId: 'c', entityId: 'e', step: 'S' };
  it('keeps the stored data and ueAssets, falling back to detail for the reason', () => {
    const io = fakeIO({ 'c|e|S': { data: { a: 1 }, ueAssets: ['/Game/X'] } });
    regrade.persistRegrade(io, key, { status: 'deferred', tier: 'L2', detail: 'd' });
    expect(io.upsert).toHaveBeenCalledTimes(1);
    expect(io.upsert).toHaveBeenCalledWith({ ...key, data: { a: 1 }, ueAssets: ['/Game/X'], status: 'deferred', tier: 'L2', reason: 'd' });
  });
  it('persists explicit new data (bind-icons, drain-python) and still keeps the ueAssets', () => {
    const io = fakeIO({ 'c|e|S': { data: { a: 1 }, ueAssets: ['/Game/X'] } });
    regrade.persistRegrade(io, key, { status: 'pass', tier: 'L0', detail: 'd', reason: 'r' }, { b: 2 });
    expect(io.upsert).toHaveBeenCalledWith({ ...key, data: { b: 2 }, ueAssets: ['/Game/X'], status: 'pass', tier: 'L0', reason: 'r' });
  });
});

describe('one-writer ratchet', () => {
  it('no sweep carries its own upsertArtifact copy — every one persists through regrade.ts', () => {
    const files = [
      'src/lib/catalog/acceptance/staticVerify.ts',
      'src/lib/catalog/acceptance/packagingVerify.ts',
      'src/lib/catalog/acceptance/bindIconsDeps.ts',
      'src/app/api/pipeline-artifacts/drain-python/route.ts',
    ];
    const copies = files.reduce((n, f) => n + (src(f).match(/upsertArtifact\(/g) ?? []).length, 0);
    expect(copies).toBe(0);
  });
});

describe('verifyStaticAll — the lifecycle cache follows an applied sweep', () => {
  const deferred: AcceptanceResult = { label: 'x', tier: 'L2', status: 'deferred', detail: 'absent' };
  const run = (apply: boolean) => {
    const syncLifecycle = vi.fn();
    const deps: StaticVerifyDeps = {
      resolveUeRoot: () => 'C:/ue',
      listArtifacts: () => [
        { catalogId: 'c', entityId: 'e1', step: 'S1', status: 'pass' },
        { catalogId: 'c', entityId: 'e1', step: 'S2', status: 'pass' },
        { catalogId: 'c', entityId: 'e2', step: 'S1', status: 'pass' },
        { catalogId: 'c', entityId: 'e3', step: 'S1', status: 'deferred' },
      ],
      getStaticChecks: () => [() => deferred],
      upsertStatus: vi.fn(),
      syncLifecycle,
    };
    verifyStaticAll({}, deps, { apply });
    return syncLifecycle;
  };
  it('syncs each moved entity exactly once, never an unmoved one', () => {
    const spy = run(true);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('c', 'e1');
    expect(spy).toHaveBeenCalledWith('c', 'e2');
    expect(spy).not.toHaveBeenCalledWith('c', 'e3');
  });
  it('a dry run syncs nothing', () => {
    expect(run(false)).not.toHaveBeenCalled();
  });
});

describe('bind-icons save — through the door, lifecycle once per entity', () => {
  it('persists bound data via the io and syncs each touched entity once on flush', () => {
    const io = fakeIO({ 'c|e1|S': { data: {}, ueAssets: ['/Game/I'] } });
    const deps = makeBindIconsDeps([], io);
    const res: AcceptanceResult = { label: 'S', tier: 'L0', status: 'pass', detail: 'bound' };
    deps.save('c', 'e1', 'S', { iconBinding: 1 }, res);
    deps.save('c', 'e1', 'T', { iconBinding: 2 }, res);
    deps.save('c', 'e2', 'S', { iconBinding: 3 }, res);
    expect(io.upsert).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'e1', step: 'S', data: { iconBinding: 1 }, ueAssets: ['/Game/I'], reason: 'bound' }));
    expect(io.syncLifecycle).not.toHaveBeenCalled();
    deps.flushLifecycle();
    expect(io.syncLifecycle.mock.calls).toEqual([['c', 'e1'], ['c', 'e2']]);
  });
});

describe('parseSweepFilter — one parser for every sweep route', () => {
  it('keeps only non-empty ids', () => {
    expect(regrade.parseSweepFilter({ catalogId: 'items', entityId: '' })).toEqual({ catalogId: 'items' });
    expect(regrade.parseSweepFilter({})).toEqual({});
    expect(regrade.parseSweepFilter(new URLSearchParams('catalogId=c&entityId=e'))).toEqual({ catalogId: 'c', entityId: 'e' });
  });
  it('the four sweep routes import it instead of their own parseFilter copies', () => {
    for (const r of ['bind-icons', 'drain-python', 'verify-packaging', 'verify-static']) {
      const code = src(`src/app/api/pipeline-artifacts/${r}/route.ts`);
      expect(code, r).toMatch(/parseSweepFilter/);
      expect(code, r).not.toMatch(/function parseFilter/);
    }
  });
});
