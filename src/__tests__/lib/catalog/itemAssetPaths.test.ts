import { describe, it, expect } from 'vitest';
import {
  itemAssetPaths, itemSlug, itemDeclaredAssets, itemPackagingClaim, itemEffectName, iconTierFor,
} from '@/lib/catalog/itemAssetPaths';

/**
 * The ONE Items asset-path table (scan-sweep challenge 2026-09-30d). Both Items specs — the
 * registered pipeline (`pipelines/items.ts`) and the bespoke lab specs (`itemsSteps.ts`) — read
 * every UE path from it, so a mesh or a material can no longer be declared at two paths, and the
 * registered half gets the collision-safe slug the bespoke half already had.
 */

const UE_OBJECT_PATH = /^\/Game\/[A-Za-z0-9_/]+$/;

function allPaths(p: ReturnType<typeof itemAssetPaths>): string[] {
  return [p.da, p.dataTable, ...Object.values(p.icons), ...p.meshLods, p.materialInstance,
    ...Object.values(p.textures), p.anim, p.vfx, p.sfx];
}

describe('itemAssetPaths — one table for every Items UE path', () => {
  it('two distinct entities whose readable slugs collide never share a data asset', () => {
    const a = itemAssetPaths({ id: 'a', name: 'Iron Sword' }, [{ id: 'b', name: 'Iron-Sword' }]);
    const b = itemAssetPaths({ id: 'b', name: 'Iron-Sword' }, [{ id: 'a', name: 'Iron Sword' }]);
    expect(a.da).not.toBe(b.da);
    expect(a.mesh).not.toBe(b.mesh);
    for (const p of [...allPaths(a), ...allPaths(b)]) expect(p).toMatch(UE_OBJECT_PATH);
  });

  it('keeps the readable slug when nothing collides (the items seed has no collisions)', () => {
    expect(itemSlug({ id: 'item-1', name: 'Iron Longsword' })).toBe('IronLongsword');
    const p = itemAssetPaths({ id: 'item-1', name: 'Iron Longsword' });
    expect(p.da).toBe('/Game/Data/Items/DA_IronLongsword');
    expect(p.mesh).toBe('/Game/Items/Meshes/SM_IronLongsword_LOD0');
    expect(p.materialInstance).toBe('/Game/Items/Materials/MI_IronLongsword_Blade');
    expect(p.icons.Rare).toBe('/Game/UI/Icons/T_IronLongsword_Icon_Rare');
    expect(p.dataTableRow).toBe('IronLongsword');
    for (const path of allPaths(p)) expect(path).toMatch(UE_OBJECT_PATH);
  });

  it('a name with no alphanumerics still yields a valid, id-derived slug', () => {
    const p = itemAssetPaths({ id: 'weird', name: '???' }, []);
    for (const path of allPaths(p)) expect(path).toMatch(UE_OBJECT_PATH);
  });

  it('maps every item rarity onto one of the four icon tiers the Icon step declares', () => {
    expect(iconTierFor('Common')).toBe('Common');
    expect(iconTierFor('Uncommon')).toBe('Magic');
    expect(iconTierFor('Magic')).toBe('Magic');
    expect(iconTierFor('Rare')).toBe('Rare');
    expect(iconTierFor('Epic')).toBe('Unique');
    expect(iconTierFor('Legendary')).toBe('Unique');
    expect(iconTierFor('Unique')).toBe('Unique');
    expect(iconTierFor(undefined)).toBe('Common');
  });

  it('names one GameplayEffect per DECLARED power (implicit → GE_Implicit_*, explicit → GE_Affix_*)', () => {
    expect(itemEffectName('implicit-sword-accuracy')).toBe('GE_Implicit_SwordAccuracy');
    expect(itemEffectName('fire resistance')).toBe('GE_Affix_FireResistance');
    const unique = { id: 'u1', name: 'The Grandfather', data: { rarity: 'Legendary', powers: [{ power: 'all-res', min: 5 }, { power: 'to_hit', min: 20 }] } };
    const declared = itemDeclaredAssets(unique, []);
    expect(declared['Affixes']).toEqual(['/Game/Data/Items/GE_Affix_AllRes', '/Game/Data/Items/GE_Affix_ToHit']);
    // Its packaging claims exactly those effects — never the Rare example roll's GE_Affix_* set.
    const claim = itemPackagingClaim(unique, []).assets;
    expect(claim.filter((p) => p.includes('/GE_'))).toEqual(declared['Affixes']);
    expect(claim).toContain('/Game/UI/Icons/T_TheGrandfather_Icon_Unique');
  });

  it('the packaging claim is a subset of what the producing steps declare', () => {
    const e = { id: 'item-1', name: 'Iron Longsword', data: { rarity: 'Common' } };
    const declared = new Set(Object.values(itemDeclaredAssets(e)).flat());
    const claim = itemPackagingClaim(e);
    expect(claim.assets.length).toBeGreaterThanOrEqual(3);
    expect(claim.assets.filter((p) => !declared.has(p))).toEqual([]);
    for (const p of claim.assets) expect(claim.declaredBy[p]).toBeTruthy();
    expect(claim.dataTableRow).toEqual({ table: '/Game/Data/Items/DT_Items', row: 'IronLongsword' });
  });
});
