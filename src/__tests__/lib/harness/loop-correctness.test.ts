import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { detectGates } from '@/lib/harness/verifier';
import { computeFeaturePassRate } from '@/lib/harness/orchestrator';

// ── (i) detectGates: UE markers win over package.json ────────────────────────

describe('detectGates — UE markers checked before package.json', () => {
  const dirs: string[] = [];
  function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gates-'));
    dirs.push(d);
    return d;
  }
  afterEach(() => {
    for (const d of dirs.splice(0)) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
  });

  const isUe = (gates: ReturnType<typeof detectGates>) => gates.some(g => g.type === 'ue-compile');
  const isWebapp = (gates: ReturnType<typeof detectGates>) =>
    gates.some(g => g.name === 'build' && g.command === 'npx next build');

  it('a UE tree carrying a package.json still gets UE gates (the category-error fix)', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'package.json'), '{"name":"tooling"}');
    fs.writeFileSync(path.join(d, 'MyGame.uproject'), '{}');
    const gates = detectGates(d);
    expect(isUe(gates)).toBe(true);
    expect(isWebapp(gates)).toBe(false);
  });

  it('a Source/ + package.json tree gets UE gates', () => {
    const d = tmp();
    fs.mkdirSync(path.join(d, 'Source'));
    fs.writeFileSync(path.join(d, 'package.json'), '{"name":"tooling"}');
    expect(isUe(detectGates(d))).toBe(true);
  });

  it('a pure webapp (package.json, no UE marker) still gets WEBAPP gates', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'package.json'), '{"name":"webapp"}');
    const gates = detectGates(d);
    expect(isWebapp(gates)).toBe(true);
    expect(isUe(gates)).toBe(false);
  });
});

// ── (iii) zero-feature area is vacuously satisfied ───────────────────────────

describe('computeFeaturePassRate — zero-feature areas', () => {
  it('a zero-feature area rates to 1 (vacuously satisfied, not 0)', () => {
    expect(computeFeaturePassRate(0, 0)).toBe(1);
  });

  it('normal ratios are unchanged', () => {
    expect(computeFeaturePassRate(2, 4)).toBe(0.5);
    expect(computeFeaturePassRate(4, 4)).toBe(1);
    expect(computeFeaturePassRate(0, 3)).toBe(0);
  });

  it('with green required gates a zero-feature area clears any positive threshold', () => {
    // areaSuccess = requiredGatesPassed && featurePassRate >= threshold.
    // A zero-feature area now yields featurePassRate 1, so it passes for any
    // threshold in (0, 1] instead of being trapped below it forever.
    const featurePassRate = computeFeaturePassRate(0, 0);
    for (const threshold of [0.5, 0.9, 1]) {
      expect(featurePassRate >= threshold).toBe(true);
    }
  });
});
