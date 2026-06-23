import { describe, it, expect } from 'vitest';
import {
  classifyKind,
  isLikelyEmptyShell,
  reconcile,
  EMPTY_SHELL_BYTES,
} from '@/lib/animation/reality-ledger.mjs';

describe('classifyKind', () => {
  it('classifies by UE asset-name prefix', () => {
    expect(classifyKind('/Game/Weapons/AM_SwordSlash')).toBe('montage');
    expect(classifyKind('/Game/Weapons/AS_SwordSlash')).toBe('sequence');
    expect(classifyKind('/Game/Characters/Player/Meshes/SK_Mannequin')).toBe('skeleton');
    expect(classifyKind('/Game/Characters/Mannequins/Meshes/SKM_Manny')).toBe('skeletalMesh');
    expect(classifyKind('/Game/Characters/Animations/ABP_Manny')).toBe('animBlueprint');
    expect(classifyKind('/Game/Abilities/DT_AbilityCatalog')).toBe('dataTable');
    expect(classifyKind('/Game/Blueprints/BP_Enemy_Grunt')).toBe('blueprint');
  });

  it('classifies by path segment over prefix', () => {
    expect(classifyKind('/Game/Maps/Arena')).toBe('map');
    expect(classifyKind('/Game/Materials/M_Sword')).toBe('material');
    expect(classifyKind('/Game/Input/Actions')).toBe('input');
    // a montage filed under /Maps/ is still treated as a map reference
    expect(classifyKind('/Game/Maps/AM_NotReallyAMontage')).toBe('map');
  });

  it('falls back to other', () => {
    expect(classifyKind('/Game/Misc/SomeThing')).toBe('other');
  });
});

describe('isLikelyEmptyShell', () => {
  it('flags only small montages', () => {
    expect(isLikelyEmptyShell('montage', 4000)).toBe(true);
    expect(isLikelyEmptyShell('montage', EMPTY_SHELL_BYTES + 1)).toBe(false);
    expect(isLikelyEmptyShell('montage', 0)).toBe(false); // not on disk
    expect(isLikelyEmptyShell('sequence', 100)).toBe(false); // only montages judged
    expect(isLikelyEmptyShell('skeleton', 100)).toBe(false);
  });
});

describe('reconcile', () => {
  const ref = (path: string, ...by: string[]) => ({ path, referencedBy: by.length ? by : ['X.cpp'] });

  it('a populated, referenced montage is valid → green', () => {
    const l = reconcile({
      referenced: [ref('/Game/Weapons/AM_Good')],
      existing: [{ path: '/Game/Weapons/AM_Good', sizeBytes: 14000 }],
    });
    expect(l.summary.status).toBe('green');
    expect(l.referenced[0].valid).toBe(true);
    expect(l.missing).toHaveLength(0);
    expect(l.emptyShells).toHaveLength(0);
  });

  it('a missing montage → in missing + RED', () => {
    const l = reconcile({ referenced: [ref('/Game/Weapons/AM_Missing')], existing: [] });
    expect(l.missing.map((m) => m.path)).toContain('/Game/Weapons/AM_Missing');
    expect(l.summary.status).toBe('red');
  });

  it('a referenced empty-shell montage → in emptyShells + RED', () => {
    const l = reconcile({
      referenced: [ref('/Game/Weapons/AM_Shell')],
      existing: [{ path: '/Game/Weapons/AM_Shell', sizeBytes: 4000 }],
    });
    expect(l.emptyShells.map((e) => e.path)).toContain('/Game/Weapons/AM_Shell');
    expect(l.referenced[0].valid).toBe(false);
    expect(l.summary.status).toBe('red');
  });

  it('an existing-but-unreferenced montage → orphan, does not flip status', () => {
    const l = reconcile({ referenced: [], existing: [{ path: '/Game/Anim/AM_Orphan', sizeBytes: 14000 }] });
    expect(l.orphans.map((o) => o.path)).toContain('/Game/Anim/AM_Orphan');
    expect(l.summary.status).toBe('green');
  });

  it('a missing non-animation ref (map) is reported but does NOT flip status', () => {
    const l = reconcile({ referenced: [ref('/Game/Maps/Arena')], existing: [] });
    expect(l.missing.map((m) => m.path)).toContain('/Game/Maps/Arena');
    expect(l.summary.status).toBe('green');
  });

  it('manifest sections/notifies override the size heuristic (small but populated → valid)', () => {
    const l = reconcile({
      referenced: [ref('/Game/Weapons/AM_SmallButReal')],
      existing: [{ path: '/Game/Weapons/AM_SmallButReal', sizeBytes: 4000 }],
      manifestByPath: { '/Game/Weapons/AM_SmallButReal': { sections: ['Attack1'], notifies: [{}] } },
    });
    expect(l.emptyShells).toHaveLength(0);
    expect(l.referenced[0].valid).toBe(true);
    expect(l.summary.status).toBe('green');
  });

  it('runtime fallbacks alone flip status to RED', () => {
    const l = reconcile({
      referenced: [ref('/Game/Weapons/AM_Good')],
      existing: [{ path: '/Game/Weapons/AM_Good', sizeBytes: 14000 }],
      runtimeSignals: [{ signal: 'No playable swing montage', source: 'scn-walk.log' }],
    });
    expect(l.summary.status).toBe('red');
    expect(l.summary.runtimeFallbacks).toBe(1);
  });
});
