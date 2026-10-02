import { describe, it, expect } from 'vitest';
import {
  DR_CONFIGS, DR_CURVE_TABLE_NAME, DR_CURVE_TABLE_PATH,
  drEffectiveBonus, drMultiplierAt, drMarginalSeries, drCurveTableCSV,
} from '@/components/modules/core-engine/sub_progression/_shared/diminishingReturns';
import { DR_ATTRIBUTES } from '@/components/modules/core-engine/sub_progression/_shared/data';
import {
  generateDataTableJSON, generateGESource,
} from '@/components/modules/core-engine/sub_progression/_internals/DRCodeGenerator/helpers';

const [STR] = DR_CONFIGS;

describe('diminishing-returns kernel', () => {
  it('case 1: Strength (softCap 60, base 2.0, postCap 0.4) at 80 pts -> 153.7', () => {
    expect(STR).toMatchObject({ attribute: 'Strength', softCap: 60, baseValuePerPoint: 2.0, postCapMultiplier: 0.4 });
    expect(drEffectiveBonus(STR, 80)).toBeCloseTo(153.7, 2);
  });

  it('case 2 [guard]: pre-cap scaling is exactly 1:1 for every config', () => {
    for (const cfg of DR_CONFIGS) {
      for (let pts = 0; pts <= cfg.softCap; pts++) {
        expect(drEffectiveBonus(cfg, pts)).toBeCloseTo(pts * cfg.baseValuePerPoint, 9);
        if (pts > 0) expect(drMultiplierAt(cfg, pts)).toBe(1);
      }
    }
  });

  it('never drops below the post-cap multiplier past 100 points (UE clamps a curve past its last key)', () => {
    expect(drMultiplierAt(STR, 100)).toBeCloseTo(0.4, 9);
    expect(drMultiplierAt(STR, 140)).toBeCloseTo(0.4, 9);
    expect(drMultiplierAt({ ...STR, softCap: 100 }, 120)).toBeCloseTo(0.4, 9);
  });
});

describe('case 3: one UCurveTable CSV, and every UE reference names that one table', () => {
  const csv = drCurveTableCSV(DR_CONFIGS);
  const lines = csv.split(/\r?\n/);

  it('header is the UCurveTable key row Name,0,5,...,100', () => {
    const header = lines[0].split(',');
    expect(header[0]).toBe('Name');
    const keys = header.slice(1).map(Number);
    expect(keys).toHaveLength(21);
    expect(keys).toEqual(Array.from({ length: 21 }, (_, i) => i * 5));
  });

  it('exactly one data row per attribute, named as FindCurve looks it up, all finite', () => {
    const rows = lines.slice(1).filter(l => l.trim() !== '');
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.split(',')[0])).toEqual(['Strength', 'Dexterity', 'Intelligence']);
    for (const row of rows) {
      const cells = row.split(',').slice(1);
      expect(cells).toHaveLength(21);
      for (const c of cells) expect(Number.isFinite(Number.parseFloat(c))).toBe(true);
    }
    expect(lines.some(l => l.startsWith('//'))).toBe(false);
  });

  it('each row samples the kernel multiplier at its key', () => {
    const strRow = lines[1].split(',').slice(1).map(Number);
    expect(strRow[16]).toBeCloseTo(drMultiplierAt(STR, 80), 4); // key 80
    expect(strRow[20]).toBeCloseTo(0.4, 4);
  });

  it('every config and every DataTable row references the one curve table the CSV is for', () => {
    for (const cfg of DR_CONFIGS) expect(cfg.curveTableName).toBe(DR_CURVE_TABLE_NAME);
    const rows = JSON.parse(generateDataTableJSON(DR_CONFIGS)) as Record<string, unknown>[];
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map(r => r.ScalingCurve))).toEqual(new Set([DR_CURVE_TABLE_PATH]));
    expect(DR_CURVE_TABLE_PATH).toContain(`/${DR_CURVE_TABLE_NAME}.${DR_CURVE_TABLE_NAME}`);
    // FindCurve(AttributeName) reads the struct's AttributeName, which must name a CSV row.
    const csvRowNames = lines.slice(1).filter(Boolean).map(l => l.split(',')[0]);
    expect(rows.map(r => r.AttributeName)).toEqual(csvRowNames);
    expect(generateGESource(DR_CONFIGS)).toContain('FindCurve(AttributeName');
  });

  it('a config pointing at a different CT_* asset is reported, not silently exported', () => {
    const drifted = DR_CONFIGS.map((c, i) => (i === 1 ? { ...c, curveTableName: 'CT_DEX_Scaling' } : c));
    expect(() => drCurveTableCSV(drifted)).toThrow(/CT_DEX_Scaling/);
    expect(() => generateDataTableJSON(drifted)).toThrow(/CT_DEX_Scaling/);
  });
});

describe('case 4: the C++ curve-miss path evaluates the kernel falloff', () => {
  const src = generateGESource(DR_CONFIGS);

  it('no flat PostCapMultiplier on a missing curve row', () => {
    expect(src).not.toContain('Curve->Eval(LookupKey) : PostCapMultiplier');
    expect(src).not.toMatch(/:\s*PostCapMultiplier\s*;/);
  });

  it('missing table and missing row both fall back to the Lerp falloff', () => {
    expect(src).toContain('FMath::Lerp(1.f, PostCapMultiplier');
    // A null ScalingCurve and a FindCurve miss both leave Curve null -> Falloff.
    expect(src).toMatch(/ScalingCurve \? ScalingCurve->FindCurve\(AttributeName/);
    expect(src).toMatch(/Curve \? Curve->Eval\(LookupKey\) : Falloff/);
  });
});

describe('case 5: DR_ATTRIBUTES is derived from DR_CONFIGS', () => {
  it('softCap and curve come from the kernel', () => {
    expect(DR_ATTRIBUTES).toHaveLength(DR_CONFIGS.length);
    DR_CONFIGS.forEach((cfg, i) => {
      expect(DR_ATTRIBUTES[i].name).toBe(cfg.attribute);
      expect(DR_ATTRIBUTES[i].softCap).toBe(cfg.softCap);
      expect(DR_ATTRIBUTES[i].curve).toEqual(drMarginalSeries(cfg, 10));
    });
  });

  it('Strength marginal is 2.0 through the cap and 0.8 at 100 pts', () => {
    const curve = drMarginalSeries(STR, 10);
    for (const pt of curve.filter(c => c.points <= 60)) expect(pt.marginalValue).toBeCloseTo(2.0, 9);
    expect(curve.find(c => c.points === 100)?.marginalValue).toBeCloseTo(0.8, 9);
    expect(DR_ATTRIBUTES[0].curve[0].marginalValue).toBeCloseTo(2.0, 9);
  });
});
