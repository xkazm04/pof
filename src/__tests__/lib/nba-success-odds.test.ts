/**
 * The NBA card's success odds must come from REAL recorded runs.
 *
 * Before this suite, `computeNBA` fell back to a hard-coded `0.5` for any module
 * with no history, and `moduleStore.moduleHistory` — its only history source —
 * has no production writer at all (`addHistoryEntry` has zero non-test call
 * sites; the real `~/.pof/pof.db` has `project_progress.history_json = {}`).
 * So on every project the card asserted "50% past success on similar work" and
 * `nbaFactorSegments` emitted a 6-point "Success odds" segment to back it up.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { computeNBA, computeProjectNBA } from '@/lib/nba-engine';
import { nbaFactorSegments, nbaSuccessOdds } from '@/lib/nba-breakdown';
import { makeRunEvidence, NO_RUN_EVIDENCE } from '@/lib/nba-run-evidence';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';

beforeEach(() => {
  useModuleStore.setState({ checklistProgress: {}, moduleHistory: {}, moduleHealth: {} });
  usePatternLibraryStore.setState({ patterns: [] });
  useEvaluatorStore.setState({ lastScan: null });
});

describe('success odds with no recorded runs', () => {
  it('reports an UNKNOWN probability instead of a 0.5 constant', () => {
    const recs = computeNBA('arpg-combat');
    expect(recs.length).toBeGreaterThan(0);
    for (const rec of recs) {
      expect(rec.successProbability).toBeNull();
      expect(rec.breakdown.successProb).toBe(0);
      expect(rec.successEvidence.source).toBe('none');
    }
  });

  it('emits no "Success odds" segment at all', () => {
    const rec = computeNBA('arpg-combat')[0];
    const segs = nbaFactorSegments(rec);
    expect(segs.find((s) => s.key === 'successProb')).toBeUndefined();
  });

  it('still has a sentence to show, and it names the absence', () => {
    const odds = nbaSuccessOdds(computeNBA('arpg-combat')[0]);
    expect(odds.pct).toBeNull();
    expect(odds.scored).toBe(false);
    expect(odds.note).toBe('No recorded runs for this module yet — success odds not scored');
  });
});

describe('success odds from injected recorded runs', () => {
  it('uses the real rate and names the sample size', () => {
    const recs = computeNBA('arpg-combat', undefined, undefined, makeRunEvidence(3, 2));
    const rec = recs[0];
    expect(rec.successProbability).toBeCloseTo(2 / 3, 10);
    expect(rec.successEvidence).toMatchObject({ source: 'runs', runs: 3, successes: 2 });

    const seg = nbaFactorSegments(rec).find((s) => s.key === 'successProb');
    expect(seg).toBeDefined();
    expect(seg?.plain).toBe('2 of 3 past runs succeeded');
  });

  it('scores a real all-failed record as zero rather than as unknown', () => {
    // The measured shape of the real DB (86 recorded sessions, 0 successes).
    const rec = computeNBA('arpg-combat', undefined, undefined, makeRunEvidence(14, 0))[0];
    expect(rec.successProbability).toBe(0);
    expect(rec.breakdown.successProb).toBe(0);
    expect(rec.successEvidence.source).toBe('runs');
    expect(nbaSuccessOdds(rec).note).toBe('0 of 14 past runs succeeded');
  });

  it('falls back to the local history slice when nothing is injected', () => {
    useModuleStore.setState({
      moduleHistory: {
        'arpg-combat': [
          { id: '1', moduleId: 'arpg-combat', prompt: 'a', status: 'completed', timestamp: 1 },
          { id: '2', moduleId: 'arpg-combat', prompt: 'b', status: 'failed', timestamp: 2 },
        ],
      },
    });
    const rec = computeNBA('arpg-combat')[0];
    expect(rec.successProbability).toBe(0.5);
    expect(rec.successEvidence).toMatchObject({ source: 'runs', runs: 2, successes: 1 });
    // …and says so, rather than coincidentally reading like the old constant.
    expect(rec.successEvidence.note).toBe('1 of 2 past runs succeeded');
  });

  it('keeps the breakdown summing to the composite score', () => {
    const rec = computeNBA('arpg-combat', undefined, undefined, makeRunEvidence(4, 3))[0];
    const b = rec.breakdown;
    expect(Math.round(b.urgency + b.successProb + b.impact + b.recency + b.readiness))
      .toBe(rec.score);
  });
});

describe('computeProjectNBA run evidence', () => {
  it('routes each module its OWN recorded runs', () => {
    const evidence = new Map([['arpg-combat', makeRunEvidence(10, 9)]]);
    const recs = computeProjectNBA(undefined, 40, evidence);

    const combat = recs.filter((r) => r.moduleId === 'arpg-combat');
    const others = recs.filter((r) => r.moduleId !== 'arpg-combat');
    expect(combat.length).toBeGreaterThan(0);
    for (const r of combat) expect(r.successEvidence.runs).toBe(10);
    // A module absent from the map has no evidence — it does not inherit any.
    for (const r of others) expect(r.successProbability).toBeNull();
  });

  it('scores nothing from success odds when the evidence map is empty', () => {
    const recs = computeProjectNBA(undefined, 5, new Map());
    for (const r of recs) {
      expect(r.breakdown.successProb).toBe(0);
      expect(r.successEvidence).toMatchObject({ source: 'none', runs: 0, successes: 0 });
    }
    expect(NO_RUN_EVIDENCE.rate).toBeNull();
  });
});
