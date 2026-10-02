/**
 * LODs commissioned in triangles.
 *
 * The LOD tab used to take a typed object name and a list of blind ratios, and
 * the run printed polygon counts labelled "faces" under a green check. The plan
 * states each level's TRIANGLE target from a measured source against the asset
 * class budget, and the grade reads what Blender printed per level: honoured
 * within the 10% decimator tolerance, over (with the ~2x quad trap named), or
 * unmeasured when a level has no receipt — never a silent pass.
 */
import { describe, it, expect } from 'vitest';
import { planLodChain, gradeLodReceipt, parseLodRatios } from '@/lib/visual-gen/lod-plan';

const lodLine = (level: number, tris: number, targetTris = 19206) =>
  `POF_RESULT=${JSON.stringify({ kind: 'lod', level, name: `SM_Sword_LOD${level}`, targetTris, tris, polys: Math.round(tris / 2) })}`;

describe('planLodChain', () => {
  it('turns ratios into triangle targets and grades LOD0 against the Weapon ceiling', () => {
    const plan = planLodChain({ sourceTris: 38412, assetClass: 'weapon', ratiosText: '0.5, 0.25, abc, 1.2' });
    expect(plan).toMatchObject({
      levels: [{ level: 1, targetTris: 19206 }, { level: 2, targetTris: 9603 }],
      rejected: ['abc', '1.2'],
      lod0: { tris: 38412, verdict: 'over-ceiling', ceiling: 22500 },
    });
    expect(plan.lod0.reason).toMatch(/Weapon/);
  });

  it('a prop inside its target is within-target; a missing count invents no plan', () => {
    expect(planLodChain({ sourceTris: 8000, assetClass: 'prop', ratiosText: '0.5' }).lod0.verdict).toBe('within-target');
    const blind = planLodChain({ sourceTris: undefined, assetClass: 'prop', ratiosText: '0.5, 0.25' });
    expect(blind.levels).toHaveLength(2);
    expect(blind.levels.every((l) => l.targetTris === undefined)).toBe(true);
    expect(blind.lod0.verdict).toBe('unmeasured');
    expect(blind.lod0.reason).toMatch(/not measured/i);
  });

  it('parseLodRatios keeps the (0,1) ratios and names the rejects', () => {
    expect(parseLodRatios('0.75, 1.0, , x, 0.5')).toEqual({ ratios: [0.75, 0.5], rejected: ['1.0', 'x'] });
  });
});

describe('gradeLodReceipt', () => {
  const plan = [{ level: 1, targetTris: 19206 }];

  it('honours a level inside the 10% tolerance, names the ~2x quad trap, leaves a plain overrun uncaused', () => {
    expect(gradeLodReceipt(`Generating\n${lodLine(1, 19800)}\n`, plan).levels[0]).toMatchObject({ state: 'honoured', tris: 19800 });
    const trap = gradeLodReceipt(lodLine(1, 38100), plan).levels[0];
    expect(trap).toMatchObject({ state: 'over', cause: 'quad-trap' });
    expect(trap.reason).toMatch(/quad/i);
    const over = gradeLodReceipt(lodLine(1, 30000), plan).levels[0];
    expect(over.state).toBe('over');
    expect(over.cause).toBeUndefined();
  });

  it('a level with no receipt is unmeasured and the summary is never all honoured', () => {
    const grade = gradeLodReceipt(`${lodLine(1, 19206)}\nTraceback: boom`, [
      { level: 1, targetTris: 19206 },
      { level: 2, targetTris: 9603 },
    ]);
    expect(grade.levels[0].state).toBe('honoured');
    expect(grade.levels[1]).toMatchObject({ level: 2, state: 'unmeasured' });
    expect(grade.levels[1].reason).toMatch(/no receipt for LOD2/);
    expect(grade.allHonoured).toBe(false);
    expect(grade.summary).not.toMatch(/all .*honoured/i);
  });
});
