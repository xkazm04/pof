import { describe, expect, it } from 'vitest';
import { assessLines } from '@/lib/games/gtai-quest/lineGuard';
import { CLEAN, CLEAN_JUDGE, LEDGER_QUEST, ctx, mutate } from '@/__tests__/games/gtai-quest/fixtures';
import type { LineJudgeReport, QuestDesign, QuestGuardContext } from '@/lib/games/gtai-quest/types';

const codes = (d: QuestDesign, c: QuestGuardContext = ctx()) => assessLines(d, c).findings.map((f) => f.code);
const find = (d: QuestDesign, code: string, c: QuestGuardContext = ctx()) => assessLines(d, c).findings.find((f) => f.code === code);
const judged = (fn: (j: { -readonly [K in keyof LineJudgeReport]: LineJudgeReport[K] }) => void): QuestGuardContext => {
  const j = structuredClone(CLEAN_JUDGE) as { -readonly [K in keyof LineJudgeReport]: LineJudgeReport[K] };
  fn(j);
  return ctx({ judge: j });
};

describe('assessLines: structural', () => {
  it('the clean fixture is green, with no findings, and says the judge is unmeasured', () => {
    const v = assessLines(CLEAN, ctx());
    expect(v.findings).toEqual([]);
    expect(v.state).toBe('green');
    expect(v.basis).toBe('structural only; judge unmeasured');
  });

  const cases: [string, 'error' | 'warn', QuestDesign, QuestGuardContext?][] = [
    ['LINE_NO_PURPOSE', 'error', mutate((d) => { d.lines[0].purpose = []; })],
    ['LINE_UNKNOWN_SPEAKER', 'error', mutate((d) => { d.lines[0].speaker = 'king'; })],
    ['BEAT_UNKNOWN_LINE', 'error', mutate((d) => { d.beats[0].lineIds.push('ghost-line'); })],
    ['LINE_UNUSED', 'warn', mutate((d) => { d.lines.push({ id: 'stray', speaker: 'rivet', purpose: ['character'], text: 'Nobody hears this one.', audio: null }); })],
    ['DUPLICATE_LINE_ID', 'error', mutate((d) => { d.lines[1].id = d.lines[0].id; })],
    ['LINE_REUSED_FROM_LEDGER', 'error', mutate((d) => { d.lines[1].text = 'witnesses are CRUMBS, child -- crumbs go in the bag!'; })],
    ['NO_VOICE_BIBLE', 'error', CLEAN, ctx({ voiceBibles: new Set(['rivet', 'gearbox']) })],
    ['EDITORIAL_TELL', 'warn', mutate((d) => { d.lines[1].text = "It's not a factory, it's a graveyard with a parking lot."; })],
    ['TOO_FEW_LINES', 'error', mutate((d) => { d.lines = d.lines.slice(0, 5); })],
  ];
  it.each(cases)('%s fires as %s on its mutation and not on the clean fixture', (code, severity, d, c) => {
    expect(find(d, code, c)?.severity).toBe(severity);
    expect(codes(CLEAN)).not.toContain(code);
  });

  it('NO_VOICE_BIBLE is only a warn for a new speaker', () => {
    const d = mutate((x) => {
      x.characters.push({ id: 'toner-tony', name: 'Toner Tony', status: 'new', role: 'target', designNote: 'a printer in a tracksuit' });
      x.lines[1].speaker = 'toner-tony';
    });
    expect(find(d, 'NO_VOICE_BIBLE')).toMatchObject({ severity: 'warn', ref: 'toner-tony' });
  });

  it('soul voices are speakable only from their own act on', () => {
    expect(codes(mutate((d) => { d.lines[1].speaker = 'sentry'; }))).toContain('LINE_UNKNOWN_SPEAKER');
    const act2 = mutate((d) => { d.act = 'act2'; d.lines[1].speaker = 'sentry'; });
    expect(codes(act2, ctx({ voiceBibles: new Set(['rivet', 'don-fax', 'gearbox', 'sentry']) }))).toEqual([]);
  });

  it('each editorial tell pattern is caught and labelled unmeasured', () => {
    const texts = [
      "It's not a factory, it's a graveyard with a parking lot.",
      'Why do I keep killing cops? Because they keep showing up.',
      'I welded the door shut. Sometimes the door welds you back.',
    ];
    for (const t of texts) {
      const f = find(mutate((d) => { d.lines[1].text = t; }), 'EDITORIAL_TELL');
      expect(f?.message.startsWith('editorial (unmeasured):')).toBe(true);
    }
  });

  it('does not flag its own package as reusing a ledger line', () => {
    expect(codes(LEDGER_QUEST)).not.toContain('LINE_REUSED_FROM_LEDGER');
  });
});

describe('assessLines: judge', () => {
  it('a clean cross-family judge keeps it green and names the judge in the basis', () => {
    const v = assessLines(CLEAN, ctx({ judge: CLEAN_JUDGE }));
    expect(v.findings).toEqual([]);
    expect(v.basis).toBe('structural + judge(grok)');
  });

  const cases: [string, 'error' | 'warn', QuestGuardContext][] = [
    ['JUDGE_SAME_FAMILY', 'error', judged((j) => { j.judgeSeat = 'claude'; })],
    ['LINE_NOT_EARNED', 'error', judged((j) => { j.lines = j.lines.map((l, i) => (i === 0 ? { ...l, earned: 2 } : l)); })],
    ['VOICE_DRIFT', 'warn', judged((j) => { j.lines = j.lines.map((l, i) => (i === 0 ? { ...l, voiceFit: 2 } : l)); })],
    ['LINE_UNJUDGED', 'warn', judged((j) => { j.lines = j.lines.slice(1); })],
  ];
  it.each(cases)('%s fires as %s on its mutation and not on the clean judge', (code, severity, c) => {
    expect(find(CLEAN, code, c)?.severity).toBe(severity);
    expect(codes(CLEAN, ctx({ judge: CLEAN_JUDGE }))).not.toContain(code);
  });
});
