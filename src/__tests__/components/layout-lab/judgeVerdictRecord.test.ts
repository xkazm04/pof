import { describe, it, expect } from 'vitest';
import {
  STORED_FINDINGS_CAP, judgeDirection, matchVerdict, parseFindings, pointsShort, retiredByReproduce, weakestFirst,
} from '@/components/layout-lab/steps/ux/judgeVerdictRecord';
import { uxVariantsIn } from '@/components/layout-lab/steps/ux/useUxVariant';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { stepContentHash } from '@/lib/judge/contentHash';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

const base: JudgeVerdict = {
  catalogId: 'combat-map', entityId: 'e', step: 'Concept Brief', judge: 'llm-panel', verdict: 'fail',
  score: 77, findings: 'x', model: 'claude-opus-4-8', rubricVersion: RUBRIC_VERSION, judgedAt: '2026-10-01 10:00:00',
};

describe('parseFindings — the judge runner record, split back into its parts', () => {
  it('reads the header, the panel scores, the critique and the trailing FIX', () => {
    const p = parseFindings('[rubric v4+canon] [median-of-3: 76,77,88] Strong voice. But the waves disagree. FIX: State two waves.');
    expect(p).toEqual({ rubric: 'v4', canon: true, panel: [76, 77, 88], critique: 'Strong voice. But the waves disagree.', fix: 'State two waves.', clipped: false });
  });

  it('a single-shot record without canon has no panel scores', () => {
    const p = parseFindings('[rubric v4] Thin brief. FIX: Name the arena.');
    expect(p.panel).toEqual([]);
    expect(p.canon).toBe(false);
    expect(p.fix).toBe('Name the arena.');
  });

  it('a record from another writer (no header, no FIX) is all critique', () => {
    expect(parseFindings('generic filler stats')).toEqual({ canon: false, panel: [], critique: 'generic filler stats', clipped: false });
  });

  it('a record at the storage cap is marked clipped — that is where the FIX gets cut away', () => {
    const raw = `[rubric v4] ${'a'.repeat(STORED_FINDINGS_CAP)}`.slice(0, STORED_FINDINGS_CAP);
    const p = parseFindings(raw);
    expect(p.clipped).toBe(true);
    expect(p.fix).toBeUndefined();
  });
});

describe('verdict helpers', () => {
  it('matchVerdict returns the verdict the bridge attributed, not a neighbour', () => {
    const other = { ...base, score: 60, judgedAt: '2026-09-01 10:00:00' };
    const hit = matchVerdict([other, base], { provenance: 'current', verdict: 'fail', score: 77, judge: 'llm-panel', model: 'claude-opus-4-8', judgedAt: base.judgedAt, note: '' });
    expect(hit).toBe(base);
  });

  it('a re-produce retires a current-scheme or hash-less verdict, but not an old-scheme one', () => {
    expect(retiredByReproduce({ ...base, contentHash: stepContentHash({ brief: 'b' }) })).toBe(true);
    expect(retiredByReproduce({ ...base, contentHash: undefined })).toBe(true);
    expect(retiredByReproduce({ ...base, contentHash: 'v2-qdk-1jmiqij' })).toBe(false);
  });

  it('points short of the bar, and dimensions weakest first', () => {
    expect(pointsShort(85)).toBe(5);
    expect(pointsShort(93)).toBe(0);
    expect(weakestFirst({ voice: 92, plausibility: 84, coherence: 93 }).map(([k]) => k)).toEqual(['plausibility', 'voice', 'coherence']);
    expect(weakestFirst(undefined)).toEqual([]);
  });

  it('the seeded direction quotes the judge’s fix, or its critique when no fix survived', () => {
    const withFix = judgeDirection('Concept Brief', base, parseFindings('[rubric v4] Bad. FIX: Do X.'));
    expect(withFix).toMatch(/scored it 77 against a bar of 90\. The judge's fix: Do X\./);
    const noFix = judgeDirection('Concept Brief', base, parseFindings('[rubric v4] The waves disagree.'));
    expect(noFix).toMatch(/The judge found: The waves disagree\./);
  });
});

describe('uxVariantsIn — the opt-in reader', () => {
  it('reads repeated and comma-separated ux params, and nothing else', () => {
    expect(uxVariantsIn('?legacy=0&c=items&ux=judge-verdict')).toEqual(['judge-verdict']);
    expect(uxVariantsIn('?ux=a,b&ux=c')).toEqual(['a', 'b', 'c']);
    expect(uxVariantsIn('?legacy=0&c=items')).toEqual([]);
  });
});
