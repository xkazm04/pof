import { describe, expect, it } from 'vitest';
import { validateStoryGraph } from '@/lib/story/validate';
import { assessStory, buildCampaignGraph, PROTECTED_VARS } from '@/lib/games/gtai-quest/storyGuard';
import { GTAI_CAST } from '@/lib/games/gtai-quest/campaignBaseline';
import { CLEAN, LEDGER_QUEST, ctx, mutate } from '@/__tests__/games/gtai-quest/fixtures';
import type { QuestDesign } from '@/lib/games/gtai-quest/types';

const codes = (d: QuestDesign, subject = 'per-my-last-fax') => assessStory(subject, d, ctx()).findings.map((f) => f.code);

describe('campaign baseline', () => {
  it('the empty-ledger baseline graph validates with zero error findings', () => {
    const errors = validateStoryGraph(buildCampaignGraph([])).filter((f) => f.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('a ledger quest merges in as a contract container inside its act, still error-free', () => {
    const g = buildCampaignGraph([LEDGER_QUEST]);
    const q = g.nodes.find((n) => n.id === 'quest.witnesses-are-crumbs');
    expect(q?.kind).toBe('container');
    expect(q?.class).toBe('contract');
    expect(q?.parent).toBe('act1');
    expect(q?.realises).toEqual([{ catalogId: 'contracts', entityId: 'witnesses-are-crumbs' }]);
    expect(g.project).toBe('gtai');
    expect(g.graphId).toBe('gtai-campaign');
    expect(validateStoryGraph(g).filter((f) => f.severity === 'error')).toEqual([]);
  });

  it('protects the three open-canon variables with an empty writers list', () => {
    expect([...PROTECTED_VARS].sort()).toEqual(['act_antagonist_order', 'betrayer', 'soul4_identity']);
    const g = buildCampaignGraph([]);
    for (const name of PROTECTED_VARS) expect(g.variables.find((v) => v.name === name)?.writers).toEqual([]);
  });

  it('marks [proposal] beats as proposals', () => {
    const g = buildCampaignGraph([]);
    expect(g.nodes.find((n) => n.id === 'act1.soul-1')).toMatchObject({ authoring: 'proposal', status: '[proposal]' });
    expect(g.nodes.find((n) => n.id === 'act3.twist')).toMatchObject({ authoring: 'authored', status: '[owner]' });
  });

  it('casts the placeholder soul-4 and never the protected fourth soul', () => {
    const ids = GTAI_CAST.map((c) => c.id);
    expect(ids).toContain('soul-4');
    expect(ids).not.toContain('mop');
  });
});

describe('assessStory', () => {
  it('the clean fixture is green with no findings', () => {
    const v = assessStory('per-my-last-fax', CLEAN, ctx());
    expect(v.findings).toEqual([]);
    expect(v.state).toBe('green');
    expect(v.basis).toBe('gtai-campaign baseline + 1 ledger quests');
  });

  const cases: [string, QuestDesign][] = [
    ['PROTECTED_VAR_WRITE', mutate((d) => { d.story.writes.push({ var: 'betrayer', value: 'don-fax' }); })],
    ['ARC_VAR_NOT_OWNED', mutate((d) => { d.story.writes.push({ var: 'twist_revealed', value: true }); })],
    ['UNKNOWN_VAR', mutate((d) => { d.story.writes.push({ var: 'fax_jam', value: true }); })],
    ['READS_FUTURE_STATE', mutate((d) => { d.story.reads.push('twist_revealed'); })],
    ['UNKNOWN_EXISTING_CHARACTER', mutate((d) => { d.characters.push({ id: 'mop', name: 'Mop', status: 'existing', role: 'ally' }); })],
    ['NEW_CHARACTER_COLLIDES', mutate((d) => { d.characters.push({ id: 'vend-etta', name: 'Vend-Etta', status: 'new', role: 'ally', designNote: 'a vending machine' }); })],
    ['NEW_CHARACTER_NO_DESIGN', mutate((d) => { d.characters.push({ id: 'toner-tony', name: 'Toner Tony', status: 'new', role: 'target' }); })],
    ['GRAPH_VAR_NO_REACHING_WRITE', mutate((d) => { d.story.reads.push('q_nobody_writes_this'); })],
    ['GRAPH_VAR_DOMAIN_VIOLATION', mutate((d) => { d.story.writes.push({ var: 'q_fax_jam', value: 5 }); })],
  ];
  it.each(cases)('%s fires on its mutation and not on the clean fixture', (code, d) => {
    expect(codes(d)).toContain(code);
    expect(codes(CLEAN)).not.toContain(code);
  });

  it('error mutations turn the guard red; NEW_CHARACTER_NO_DESIGN alone is a warn', () => {
    expect(assessStory('x', cases[0][1], ctx()).state).toBe('red');
    const warnOnly = assessStory('x', cases[6][1], ctx());
    expect(warnOnly.state).toBe('green');
    expect(warnOnly.findings.map((f) => f.severity)).toEqual(['warn']);
  });

  it('reports one code per fact: a protected write is not repeated as a GRAPH_ finding', () => {
    expect(codes(cases[0][1]).filter((c) => c.startsWith('GRAPH_'))).toEqual([]);
  });

  it('a quest var written in an earlier or the same act is readable; one first written later is future state', () => {
    const reader = mutate((d) => { d.story.reads.push('q_crumbs_swept'); });
    expect(assessStory('x', reader, ctx()).findings).toEqual([]);
    const later = { ...LEDGER_QUEST, act: 'act2' as const };
    expect(assessStory('x', reader, ctx({ ledger: [later] })).findings.map((f) => f.code)).toEqual(['READS_FUTURE_STATE']);
  });

  it('re-scoring a package already in the ledger does not collide with itself', () => {
    const v = assessStory(LEDGER_QUEST.id, LEDGER_QUEST, ctx());
    expect(v.findings).toEqual([]);
    expect(v.basis).toBe('gtai-campaign baseline + 0 ledger quests');
  });

  it("a new character another quest already introduced still collides", () => {
    const d = mutate((x) => { x.characters.push({ id: 'dust-bunny', name: 'Dust Bunny', status: 'new', role: 'ally', designNote: 'lint' }); });
    expect(codes(d)).toContain('NEW_CHARACTER_COLLIDES');
  });
});
