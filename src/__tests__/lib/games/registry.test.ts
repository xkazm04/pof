/**
 * The game registry (spark gtai-uprising-project, WP1 criterion 1): a game is DERIVED from an
 * entity's canon profile. Code seeds carry none → PoF; diablo1 is a canon INSIDE PoF's game; gtai is
 * its own game. An unknown game or an unmapped profile throws rather than landing on PoF's board.
 */
import { describe, it, expect } from 'vitest';
import { GAMES, getGame, gameOfEntity, gameOfProfile, authoringProfileOf, DEFAULT_GAME } from '@/lib/games/registry';
import { GAME_IDS } from '@/lib/games/types';
import { CANON_PROFILES } from '@/lib/catalog/canon/profiles';

describe('gameOfEntity', () => {
  it('maps a code seed (no provenance) to pof', () => {
    expect(gameOfEntity({})).toBe('pof');
    expect(gameOfEntity(null)).toBe('pof');
    expect(gameOfEntity(undefined)).toBe('pof');
  });
  it('maps a provenance with no canonProfile to pof', () => {
    expect(gameOfEntity({ provenance: {} })).toBe('pof');
  });
  it('maps diablo1 to pof (a canon inside the PoF game, not a second game)', () => {
    expect(gameOfEntity({ provenance: { canonProfile: 'diablo1' } })).toBe('pof');
  });
  it('maps gtai to gtai', () => {
    expect(gameOfEntity({ provenance: { canonProfile: 'gtai' } })).toBe('gtai');
  });
  it('throws on an unknown profile instead of resolving it to pof', () => {
    expect(() => gameOfEntity({ provenance: { canonProfile: 'nope' } })).toThrow(/belongs to no registered game/);
    expect(() => gameOfProfile('nope')).toThrow(/nope/);
  });
});

describe('getGame', () => {
  it('throws on an unknown id, naming the registered ones', () => {
    expect(() => getGame('nope')).toThrow(/Unknown game "nope".*pof, gtai/);
  });
  it('resolves every registered id', () => {
    for (const id of GAME_IDS) expect(getGame(id).id).toBe(id);
    expect(DEFAULT_GAME).toBe('pof');
  });
});

describe('registry coherence', () => {
  it('every game profile is a registered canon profile, and every canon profile has exactly one game', () => {
    const owners = new Map<string, string[]>();
    for (const id of GAME_IDS) {
      for (const p of GAMES[id].canonProfiles) {
        expect(CANON_PROFILES[p], `${id} lists unregistered profile ${p}`).toBeDefined();
        owners.set(p, [...(owners.get(p) ?? []), id]);
      }
    }
    for (const p of Object.keys(CANON_PROFILES)) expect(owners.get(p), `profile ${p}`).toHaveLength(1);
  });
  it('authors new entities under the first profile', () => {
    expect(authoringProfileOf('pof')).toBe('pof');
    expect(authoringProfileOf('gtai')).toBe('gtai');
  });
  it('gtai is locked on Godot 4.7.2, its root is the sibling game repo, and it keeps its design truth in games/gtai', () => {
    expect(GAMES.gtai.engine).toEqual({ kind: 'godot', version: '4.7.2', root: '../gtai' });
    expect(GAMES.gtai.designDir).toBe('games/gtai');
  });
});
