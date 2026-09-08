/* eslint-disable no-restricted-syntax -- the hex literals below are MEASURED cell
   palettes captured from a real generated sheet, not UI colours. Same precedent as
   kit-coherence.test.ts. */
import { describe, it, expect } from 'vitest';
import {
  gradeKitCoherence,
  KIT_COHERENCE_REFERENCE,
  DRIFT_DELTA_E,
} from '@/lib/visual-gen/kit-coherence';

/**
 * The 16 cell palettes of the first single-pass contact sheet PoF generated
 * (`generated/images/qwen-image_1788892296725.png`) — a kit that is coherent BY
 * CONSTRUCTION, since one model pass rendered all sixteen. `kit-coherence.ts` said in
 * as many words that it had no such kit to calibrate against. Captured 2026-09-08.
 */
const SHEET_PALETTES = [
  ['#1a1816', '#201e1b', '#161311', '#201a14'],
  ['#151616', '#161616', '#1c1a18', '#1a1817'],
  ['#232523', '#2e2e2c', '#1c1c1a', '#292622'],
  ['#222426', '#272728', '#1c1c1a', '#272523'],
  ['#2e2826', '#2e2927', '#1c1818', '#362c26'],
  ['#191819', '#191818', '#1b1b1a', '#1c1b1a'],
  ['#23211e', '#26221c', '#1a1918', '#211c16'],
  ['#27231f', '#2d271f', '#221d18', '#211a13'],
  ['#1d1e1e', '#201f1e', '#151515', '#1e1c19'],
  ['#26211d', '#231e1b', '#191613', '#201a13'],
  ['#262521', '#1f1e1b', '#222220', '#2a2721'],
  ['#23211c', '#332e26', '#1c1911', '#2f2a1e'],
  ['#23221d', '#26231e', '#171716', '#211c15'],
  ['#1a1d1f', '#212020', '#151516', '#211f1d'],
  ['#131517', '#161719', '#0f1113', '#141414'],
  ['#222020', '#1e1d1c', '#131416', '#171717'],
].map((palette, i) => ({ name: `cell${i}`, palette }));

describe('the measured known-coherent-kit reference', () => {
  it('reproduces the sheet the reference was measured from', () => {
    const g = gradeKitCoherence(SHEET_PALETTES);
    expect(g.meanDeltaE).toBeCloseTo(KIT_COHERENCE_REFERENCE.meanDeltaE, 1);
    expect(g.worstPair!.deltaE).toBeCloseTo(KIT_COHERENCE_REFERENCE.worstPairDeltaE, 1);
  });

  it('records that the current max-pair rule calls that known-coherent kit drifting', () => {
    // The finding, not a wish: 16 portraits from ONE pass, mean 3.3 apart, and the
    // worst pair alone (a masked assassin against a green orc) breaches the threshold.
    const g = gradeKitCoherence(SHEET_PALETTES);
    expect(g.verdict).toBe('drifting');
    expect(KIT_COHERENCE_REFERENCE.worstPairDeltaE).toBeGreaterThan(DRIFT_DELTA_E);
    expect(KIT_COHERENCE_REFERENCE.meanDeltaE).toBeLessThan(DRIFT_DELTA_E);
  });

  it('says so in the reason, so nobody re-generates a perfectly good asset', () => {
    const g = gradeKitCoherence(SHEET_PALETTES);
    expect(g.reason).toMatch(/mean/i);
    expect(g.reason).toContain(String(KIT_COHERENCE_REFERENCE.meanDeltaE));
    expect(g.reason).toMatch(/variety/i);
  });

  it('leaves a genuine drift alone — a high mean gets no reprieve', () => {
    const drifting = [
      { name: 'a', palette: ['#101010', '#141414', '#0e0e0e', '#121212'] },
      { name: 'b', palette: ['#e0d0a0', '#f0e8c0', '#d8c890', '#eae0b0'] },
      { name: 'c', palette: ['#2040c0', '#3050d0', '#1830b0', '#2848c8'] },
    ];
    const g = gradeKitCoherence(drifting);
    expect(g.verdict).toBe('drifting');
    expect(g.meanDeltaE!).toBeGreaterThan(DRIFT_DELTA_E);
    expect(g.reason).not.toMatch(/variety/i);
  });

  it('names the per-call control the reference is contrasted with', () => {
    expect(KIT_COHERENCE_REFERENCE.perCallControl.meanDeltaE).toBeGreaterThan(
      KIT_COHERENCE_REFERENCE.meanDeltaE,
    );
    // the control varies in SUBJECT as well as in call — stated, not hidden
    expect(KIT_COHERENCE_REFERENCE.perCallControl.confound).toMatch(/subject/i);
  });
});
