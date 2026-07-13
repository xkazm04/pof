import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import {
  createVariant,
  restoreVariant,
  getActiveVariant,
} from '@/lib/prompt-evolution/engine';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;
const ITEM = 'ac-1';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS prompt_variants');
  testDb.exec('DROP TABLE IF EXISTS prompt_ab_tests');
});

describe('engine — getActiveVariant (dispatch resolution source)', () => {
  it('returns null when the item has no variants (dispatch falls back to static)', () => {
    expect(getActiveVariant(MOD, ITEM)).toBeNull();
  });

  it('returns the first-authored variant, which is auto-active', () => {
    const v = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const active = getActiveVariant(MOD, ITEM);
    expect(active).not.toBeNull();
    expect(active!.id).toBe(v.id);
    expect(active!.active).toBe(true);
  });

  it('adoption round-trip: restoring a version changes what the next dispatch resolves', () => {
    const first = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const second = createVariant(MOD, ITEM, 'You MUST implement melee hit detection with a TSet dedup.');

    // First-authored stays active until a later version is adopted.
    expect(getActiveVariant(MOD, ITEM)!.id).toBe(first.id);

    const adopted = restoreVariant(second.id);
    expect(adopted!.active).toBe(true);

    const active = getActiveVariant(MOD, ITEM);
    expect(active!.id).toBe(second.id);
    expect(active!.prompt).toContain('TSet dedup');
  });

  it('active flag is scoped per checklist item', () => {
    createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const other = createVariant(MOD, 'ac-2', 'Implement a dodge roll with i-frames.');
    expect(getActiveVariant(MOD, ITEM)!.checklistItemId).toBe(ITEM);
    expect(getActiveVariant(MOD, 'ac-2')!.id).toBe(other.id);
  });
});
