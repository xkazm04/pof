/**
 * `gameRootFor` (spark gtai-phase-2, WP2): `POF_GAME_ROOT_<ID>` wins (and is authoritative when set),
 * otherwise a godot `engine.root` resolved against the PoF repo root; neither on disk → null.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gameRootFor, gameRootEnvVar, noGameRootReason } from '@/lib/games/gameRoot';

let base: string;
beforeAll(() => { base = mkdtempSync(join(tmpdir(), 'pof-game-root-')); });
afterAll(() => { rmSync(base, { recursive: true, force: true }); });

describe('gameRootFor', () => {
  it('names the env var from the id', () => {
    expect(gameRootEnvVar('gtai')).toBe('POF_GAME_ROOT_GTAI');
  });

  it('the env override wins over engine.root', () => {
    const repo = join(base, 'pof');
    mkdirSync(join(base, 'gtai'), { recursive: true });
    const override = mkdtempSync(join(base, 'override-'));
    expect(gameRootFor('gtai', { env: { POF_GAME_ROOT_GTAI: override }, repoRoot: repo })).toBe(resolve(override));
  });

  it('an env override that is not on disk is null — it never falls back to engine.root', () => {
    const repo = join(base, 'pof');
    mkdirSync(join(base, 'gtai'), { recursive: true });
    const missing = join(base, 'missing');
    expect(gameRootFor('gtai', { env: { POF_GAME_ROOT_GTAI: missing }, repoRoot: repo })).toBeNull();
    expect(noGameRootReason('gtai', { POF_GAME_ROOT_GTAI: missing })).toBe(`no game root for gtai (Godot 4.7.2): POF_GAME_ROOT_GTAI=${missing} is not on disk`);
  });

  it('without the env var, gtai’s engine.root ../gtai resolves against the PoF repo root', () => {
    const repo = join(base, 'pof');
    mkdirSync(join(base, 'gtai'), { recursive: true });
    expect(gameRootFor('gtai', { env: {}, repoRoot: repo })).toBe(resolve(base, 'gtai'));
  });

  it('neither on disk → null, with a reason naming the env var and the declared root', () => {
    const repo = join(base, 'elsewhere', 'pof');
    expect(gameRootFor('gtai', { env: {}, repoRoot: repo })).toBeNull();
    expect(noGameRootReason('gtai', {})).toBe('no game root for gtai (Godot 4.7.2): POF_GAME_ROOT_GTAI is unset and engine.root ../gtai is not on disk');
  });

  it('a UE game (pof) has no godot root unless the env names one', () => {
    expect(gameRootFor('pof', { env: {}, repoRoot: base })).toBeNull();
  });
});
