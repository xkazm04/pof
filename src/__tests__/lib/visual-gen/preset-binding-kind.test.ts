/**
 * A target skeleton reached by CONFORM is not a row in the remap table.
 *
 * Until 2026-09-20 `RIG_PRESETS` held both kinds with one `mixamoMapping` field and
 * nothing verified it. Measured on the table as it stood: `metahuman` declared 584 bones
 * and 5 IK chains, carried 0 mapping rows, and left 10 of 10 required chain endpoints
 * unmapped — which by the remap rule is five limbs that will not animate. Nothing read
 * the field: the only consumer was a UI section guarded by `mixamoMapping.length > 0`,
 * so the one preset with no mapping was the one that displayed no mapping problem, and
 * the fixtures in the sibling suites flatMap across every preset, so a preset with zero
 * rows contributes nothing and is invisible to them.
 *
 * The defect is not the empty table. A conform target's table is empty BY CONSTRUCTION —
 * the rigged template supplies the skeleton and skin weights, so there is no source
 * skeleton to map from. The defect is that one field expressed "not authored yet" and
 * "not applicable" identically, so no check could be written that was right for both.
 */
import { describe, it, expect } from 'vitest';
import { RIG_PRESETS, checkPresetBinding, getRigPreset } from '@/lib/visual-gen/rig-presets';

describe('rig preset target kind', () => {
  it('every preset declares which operation reaches it', () => {
    expect(RIG_PRESETS.length).toBeGreaterThan(0); // known positive: the table is non-empty
    for (const p of RIG_PRESETS) {
      expect(['remap', 'conform']).toContain(p.kind);
    }
  });

  it('a remap target owes mapping totality over its declared chains', () => {
    const remaps = RIG_PRESETS.filter((p) => p.kind === 'remap');
    expect(remaps.length).toBeGreaterThan(0); // known positive: there ARE remap rows to check

    for (const p of remaps) {
      const check = checkPresetBinding(p);
      expect(check.unmappedChainBones).not.toBeNull();
      expect(check.ok, `${p.id}: ${check.reason}`).toBe(true);
      expect(check.unmappedChainBones).toEqual([]);
    }
  });

  it('a conform target owes no mapping, and says so instead of reporting a hole', () => {
    const conform = getRigPreset('metahuman')!;
    expect(conform.kind).toBe('conform');

    const check = checkPresetBinding(conform);
    expect(check.ok).toBe(true);
    // The distinguishing assertion: totality is NOT NULL-checked into a pass, it is
    // declared inapplicable. A `[]` here would mean "checked, nothing missing", which is
    // a different and false claim.
    expect(check.unmappedChainBones).toBeNull();
    expect(check.reason).toMatch(/no source skeleton to map from/);

    // ...and the check still knows what the chains require, so the row is not opaque.
    expect(check.requiredChainBones).toHaveLength(10);
  });

  it('KNOWN NEGATIVE: the same row read as a remap target fails on all ten endpoints', () => {
    // This is the arm-A state — the table before the `kind` field existed. It proves the
    // check can fail, so the passes above are not vacuous, and it pins the exact number
    // the un-branched check would have reported.
    const asRemap = { ...getRigPreset('metahuman')!, kind: 'remap' as const };
    const check = checkPresetBinding(asRemap);

    expect(check.ok).toBe(false);
    expect(check.unmappedChainBones).toHaveLength(10);
    expect(check.reason).toMatch(/missing 10 of 10/);
  });

  it('a conform row carrying mapping rows is refused, not silently accepted', () => {
    const contradictory = {
      ...getRigPreset('metahuman')!,
      mixamoMapping: [{ sourceBone: 'mixamorig:Hips', targetBone: 'pelvis' }],
    };
    const check = checkPresetBinding(contradictory);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/map from nothing|left over/);
  });
});
