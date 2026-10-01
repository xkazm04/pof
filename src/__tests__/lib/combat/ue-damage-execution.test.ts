import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_UE_EXEC_INPUTS as DEFAULT_CALC,
  EXEC_SNIPPETS,
  UE_EXECUTION_STEPS,
  compareWithCanon,
  evaluateUeExecution,
} from '@/lib/combat/ue-damage-execution';
import { legacyArmorMitigation } from '@/lib/ability/damage-formula';

/**
 * One UE damage-execution model (scan-sweep --challenge combat-damage-pipeline/A).
 *
 * The shipped UARPGDamageExecution formula has one home (src/lib/combat/ue-damage-execution.ts):
 * a declared step table the Combat > Damage Pipeline panel renders, the retired armour curve
 * read through legacyArmorMitigation (never re-spelled), and the canon kernel computed for the
 * same inputs beside it so the retired curve is never the verdict.
 */

const close = (actual: number, expected: number, tol: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

describe('evaluateUeExecution — the shipped C++ formula', () => {
  it('case 1: default inputs -> raw 70, no crit, retired armour 30/130, final 53.846', () => {
    const r = evaluateUeExecution(DEFAULT_CALC);
    expect(DEFAULT_CALC).toEqual({
      baseDamage: 20, attackPower: 50, scaling: 1, critChance: 0.25, critDamage: 1.5, armor: 30, critRoll: 0.5,
    });
    expect(r.rawDamage).toBe(70);
    expect(r.isCrit).toBe(false);
    expect(r.critMultiplier).toBe(1);
    expect(r.armorReduction).toBe(legacyArmorMitigation(30));
    close(r.armorReduction, 0.23077, 0.00001);
    close(r.finalDamage, 53.846, 0.001);
  });

  it('case 2: critRoll 0.1 < 0.25 -> crit at 1 + CriticalDamage = 2.5, final 134.615', () => {
    const r = evaluateUeExecution({ ...DEFAULT_CALC, critRoll: 0.1 });
    expect(r.isCrit).toBe(true);
    expect(r.critMultiplier).toBe(2.5);
    close(r.finalDamage, 134.615, 0.001);
  });

  it("case 3: the open AttackPower-adds-zero spec's expected hit is 28.846", () => {
    const r = evaluateUeExecution({
      baseDamage: 20, attackPower: 10, scaling: 1, armor: 4, critChance: 0, critDamage: 1.5, critRoll: 1,
    });
    close(r.finalDamage, 28.846, 0.001);
    expect(r.finalDamage.toFixed(2)).toBe('28.85');
  });
});

describe('compareWithCanon — canon kernel for the same inputs', () => {
  it('case 4: default inputs -> shipped 53.846 vs canon 64.474 (+10.628, +19.7%)', () => {
    const c = compareWithCanon(DEFAULT_CALC);
    close(c.shipped.finalDamage, 53.846, 0.01);
    close(c.canon.total, 64.474, 0.01);
    close(c.delta, 10.628, 0.01);
    close(c.deltaPct, 19.7, 0.05);
    expect(c.divergences).toContain('armour-curve');
    expect(c.divergences).not.toContain('crit-cap');
  });

  it('case 5: a 100% crit build crits in shipped C++ but not under the 95% canon cap', () => {
    const c = compareWithCanon({ ...DEFAULT_CALC, critChance: 1, critRoll: 0.97 });
    expect(c.shipped.isCrit).toBe(true);
    expect(c.canon.isCrit).toBe(false);
    close(c.shipped.finalDamage, 134.615, 0.01);
    close(c.canon.total, 64.474, 0.01);
    expect(c.divergences).toEqual(expect.arrayContaining(['crit-cap', 'armour-curve']));
  });
});

describe('UE_EXECUTION_STEPS — one declared step table, one snippet source', () => {
  it('case 6: 13 rows in phase order, unique ids, snippet from EXEC_SNIPPETS; no inline armour curve', () => {
    expect(UE_EXECUTION_STEPS).toHaveLength(13);
    expect(UE_EXECUTION_STEPS.map((s) => s.phase)).toEqual([
      'invuln',
      'capture', 'capture', 'capture', 'capture',
      'setbycaller', 'setbycaller',
      'formula', 'formula', 'formula', 'formula',
      'output', 'output',
    ]);
    const ids = UE_EXECUTION_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of UE_EXECUTION_STEPS) expect(s.snippet).toBe(EXEC_SNIPPETS[s.id]);

    const lib = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'combat', 'ue-damage-execution.ts'), 'utf8');
    expect(lib).toMatch(/import\s*\{[^}]*\blegacyArmorMitigation\b[^}]*\}\s*from\s*'@\/lib\/ability\/damage-formula'/);
    // The model reads the curve, it never re-computes it inline.
    expect(lib).not.toMatch(/\.armor\s*\/\s*\(/);

    const dir = path.join(process.cwd(), 'src', 'components', 'modules', 'core-engine', 'sub_combat', 'damage-pipeline');
    const inlineCurve = /\/\s*\([^)\n]*\+\s*100\b/;
    const offenders = fs.readdirSync(dir)
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => inlineCurve.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
