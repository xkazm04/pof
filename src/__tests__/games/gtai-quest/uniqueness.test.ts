import { describe, expect, it } from 'vitest';
import { assessUniqueness } from '@/lib/games/gtai-quest/uniqueness';
import { CLEAN, LEDGER_QUEST, ctx, mutate } from '@/__tests__/games/gtai-quest/fixtures';
import type { QuestDesign } from '@/lib/games/gtai-quest/types';

const codes = (d: QuestDesign, selfId?: string) => assessUniqueness(d, ctx(), selfId).findings.map((f) => f.code);

describe('assessUniqueness', () => {
  it('the clean fixture is green against the ledger', () => {
    const v = assessUniqueness(CLEAN, ctx());
    expect(v.findings).toEqual([]);
    expect(v.state).toBe('green');
    expect(v.basis).toBe('1 ledger quests');
  });

  const cases: [string, QuestDesign][] = [
    ['DUPLICATE_SHAPE', mutate((d) => { d.fingerprint = { ...d.fingerprint, giver: 'Sister-Suction', coreVerb: 'clean', newMechanic: 'vacuum-evidence' }; })],
    ['NEAR_DUPLICATE', mutate((d) => { d.fingerprint = { ...d.fingerprint, giver: 'sister-suction', coreVerb: 'clean', payoffKind: 'gag' }; })],
    ['DUPLICATE_TITLE', mutate((d) => { d.title = 'witnesses are CRUMBS'; })],
    ['MECHANIC_NOT_NEW', mutate((d) => { d.fingerprint.newMechanic = 'vacuum-evidence'; })],
  ];
  it.each(cases)('%s fires on its mutation and not on the clean fixture', (code, d) => {
    expect(codes(d)).toContain(code);
    expect(codes(CLEAN)).not.toContain(code);
  });

  it('a null new mechanic equals a null one', () => {
    const ledger = [{ ...LEDGER_QUEST, fingerprint: { ...LEDGER_QUEST.fingerprint, newMechanic: null } }];
    const d = mutate((x) => { x.fingerprint = { ...x.fingerprint, giver: 'sister-suction', coreVerb: 'clean', newMechanic: null }; });
    expect(assessUniqueness(d, ctx({ ledger })).findings.map((f) => f.code)).toEqual(['DUPLICATE_SHAPE']);
  });

  it('NEAR_DUPLICATE needs the payoff to match too', () => {
    expect(codes(mutate((d) => { d.fingerprint = { ...d.fingerprint, giver: 'sister-suction', coreVerb: 'clean' }; }))).toEqual([]);
  });

  it('skips selfId', () => {
    expect(codes(LEDGER_QUEST, LEDGER_QUEST.id)).toEqual([]);
    expect(codes(LEDGER_QUEST)).toContain('DUPLICATE_SHAPE');
  });
});
