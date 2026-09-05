import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveCookMaps } from '@/lib/packaging/preflight-runner';

/**
 * The cook ships `profile.cookSettings.mapsToInclude` (`-map=A+B`). Validating
 * only `GameDefaultMap` checks a level the cook may never touch — the resolver
 * must prefer the profile's set and record which set it looked at.
 */
let root: string;
const ENGINE_INI = [
  '[/Script/EngineSettings.GameMapsSettings]',
  'GameDefaultMap=/Game/Maps/VerticalSlice',
].join('\n');

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'pof-preflight-maps-'));
  await mkdir(path.join(root, 'Content', 'Maps'), { recursive: true });
  await writeFile(path.join(root, 'Content', 'Maps', 'VerticalSlice.umap'), '');
  await writeFile(path.join(root, 'Content', 'Maps', 'Arena.umap'), '');
});
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

describe('resolveCookMaps', () => {
  it('checks the profile cook set, not the launch map', async () => {
    const r = await resolveCookMaps(root, ENGINE_INI, ['/Game/Maps/Arena', '/Game/Maps/Missing']);
    expect(r.source).toBe('profile');
    expect(r.checked).toEqual(['/Game/Maps/Arena', '/Game/Maps/Missing']);
    expect(r.missing).toEqual(['/Game/Maps/Missing']);
  });

  it('falls back to GameDefaultMap only when the profile cooks all maps', async () => {
    const r = await resolveCookMaps(root, ENGINE_INI, []);
    expect(r.source).toBe('game-default-map');
    expect(r.checked).toEqual(['/Game/Maps/VerticalSlice']);
    expect(r.missing).toEqual([]);
  });

  it('reports `none` when nothing resolvable was supplied', async () => {
    const r = await resolveCookMaps(root, null, undefined);
    expect(r).toEqual({ source: 'none', checked: [], missing: [] });
  });
});
