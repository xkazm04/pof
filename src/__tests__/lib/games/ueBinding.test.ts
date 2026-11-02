/**
 * The engine binding (WP1 criterion 3, binding half): `ueRootForGame('pof')` is the existing chain;
 * an undecided engine, or a ue5 game with no root, is UNBOUND (null) — never PoF's root; a ue5 game
 * with a root returns it only when it exists on disk.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GameDef } from '@/lib/games/types';

// A test-only view of the registry: `gtai` keeps its real def, and two fake ue5 bindings stand in for
// a future game with a chosen engine (GameId is a closed union, so they ride on `gtai`'s id below).
const fake = vi.hoisted(() => ({ gtaiEngine: null as GameDef['engine'] | null }));
vi.mock('@/lib/games/registry', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/games/registry')>();
  return {
    ...real,
    getGame: (id: string) => {
      const g = real.getGame(id);
      return id === 'gtai' && fake.gtaiEngine ? { ...g, engine: fake.gtaiEngine } : g;
    },
  };
});

import { ueRootForGame, unboundReason } from '@/lib/games/ueBinding';
import { resolveUeRoot } from '@/lib/catalog/acceptance/ueStaticCheckers';

let dir: string;
const prevEnv = process.env.POF_UE_ROOT;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pof-uebinding-'));
  process.env.POF_UE_ROOT = dir;
});
afterAll(() => {
  if (prevEnv === undefined) delete process.env.POF_UE_ROOT; else process.env.POF_UE_ROOT = prevEnv;
  rmSync(dir, { recursive: true, force: true });
});

describe('ueRootForGame', () => {
  it('pof → the existing resolveUeRoot() chain', () => {
    fake.gtaiEngine = null;
    expect(ueRootForGame('pof')).toBe(resolveUeRoot());
    expect(ueRootForGame('pof')).toBe(dir);
  });

  it('gtai (engine godot, no adapter) → null, never PoF’s root', () => {
    fake.gtaiEngine = null;
    expect(ueRootForGame('gtai')).toBeNull();
  });

  it('a ue5 game with root null → null', () => {
    fake.gtaiEngine = { kind: 'ue5', root: null };
    expect(ueRootForGame('gtai')).toBeNull();
  });

  it('a ue5 game with an existing root → that root', () => {
    fake.gtaiEngine = { kind: 'ue5', root: dir };
    expect(ueRootForGame('gtai')).toBe(dir);
  });

  it('a ue5 game whose root is missing on disk → null (unbound), not PoF’s root', () => {
    fake.gtaiEngine = { kind: 'ue5', root: join(dir, 'does-not-exist') };
    expect(ueRootForGame('gtai')).toBeNull();
    fake.gtaiEngine = null;
  });

  it('a godot game → null: PoF has no Godot adapter, never PoF’s UE root', () => {
    fake.gtaiEngine = { kind: 'godot', version: '4.7.2', root: dir };
    expect(ueRootForGame('gtai')).toBeNull();
    fake.gtaiEngine = null;
  });

  it('names the reason per game: gtai is locked on Godot, so the reason names the missing adapter', () => {
    expect(unboundReason('gtai')).toBe("game gtai runs on Godot 4.7.2: PoF's engine bridge is UE-only (no Godot adapter yet)");
  });
});
