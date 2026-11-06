import { describe, expect, it } from 'vitest';
import { validateStoryGraph } from '@/lib/story/validate';
import { assessStory, buildCampaignGraph, claimableBeats, PROTECTED_VARS } from '@/lib/games/gtai-quest/storyGuard';
import { GTAI_CAST } from '@/lib/games/gtai-quest/campaignBaseline';
import { CLEAN, LEDGER_QUEST, ctx, mutate } from '@/__tests__/games/gtai-quest/fixtures';
import type { QuestDesign, QuestPackage } from '@/lib/games/gtai-quest/types';

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
    expect([...PROTECTED_VARS].sort()).toEqual(['act_antagonist_order', 'betrayer']);
    const g = buildCampaignGraph([]);
    for (const name of PROTECTED_VARS) expect(g.variables.find((v) => v.name === name)?.writers).toEqual([]);
  });

  it('marks [proposal] beats as proposals', () => {
    const g = buildCampaignGraph([]);
    expect(g.nodes.find((n) => n.id === 'act1.soul-1')).toMatchObject({ authoring: 'proposal', status: '[proposal]' });
    expect(g.nodes.find((n) => n.id === 'act3.twist')).toMatchObject({ authoring: 'authored', status: '[owner]' });
  });

  it('casts the four ghosts as the souls, in the owner\'s story order, and none of the descoped souls', () => {
    expect(GTAI_CAST.filter((c) => c.kind === 'soul').map((c) => c.id)).toEqual(['dent', 'tonnage', 'kerf', 'ohm']);
    const ids = GTAI_CAST.map((c) => c.id);
    for (const gone of ['gearbox', 'sentry', 'hauler', 'soul-4', 'mop']) expect(ids).not.toContain(gone);
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

describe('claimsBeat (a quest realises an arc beat)', () => {
  const soulQuest = (over: Partial<QuestDesign> = {}): QuestDesign => ({
    ...CLEAN,
    claimsBeat: 'act1.soul-1',
    story: { reads: [], writes: [...CLEAN.story.writes, { var: 'soul_dent_unlocked', value: true }] },
    ...over,
  });
  const asPackage = (d: QuestDesign, id: string): QuestPackage => ({ ...LEDGER_QUEST, ...d, id });
  const claimCodes = (d: QuestDesign, ledger: QuestPackage[] = []) =>
    assessStory('soul-job', d, ctx({ ledger })).findings.map((f) => f.code);

  it('lets the claiming quest write its beat variable, with a clean graph', () => {
    const v = assessStory('soul-job', soulQuest(), ctx({ ledger: [] }));
    expect(v.findings.filter((f) => f.severity === 'error')).toEqual([]);
    expect(v.state).toBe('green');
  });
  it('still forbids writing an arc variable without the claim', () => {
    expect(claimCodes(soulQuest({ claimsBeat: undefined }))).toContain('ARC_VAR_NOT_OWNED');
  });
  it('requires the claimed beat to be written', () => {
    expect(claimCodes(soulQuest({ story: CLEAN.story }))).toContain('BEAT_CLAIM_UNWRITTEN');
  });
  it('rejects unknown, wrong-act and open-canon beats', () => {
    expect(claimCodes(soulQuest({ claimsBeat: 'act1.nope' }))).toContain('BEAT_UNKNOWN');
    expect(claimCodes(soulQuest({ claimsBeat: 'act2.soul-2' }))).toContain('BEAT_WRONG_ACT');
    expect(claimCodes(soulQuest({ act: 'act3', claimsBeat: 'act3.betrayal', story: { reads: [], writes: [{ var: 'betrayal_happened', value: true }] } })))
      .toContain('BEAT_NOT_CLAIMABLE');
    expect(claimableBeats().map((b) => b.id)).toContain('act4.soul-4');
    expect(claimableBeats().map((b) => b.id)).not.toContain('act3.betrayal');
    expect(claimableBeats().map((b) => b.id)).toContain('act1.soul-1');
  });
  it('allows one quest per beat', () => {
    expect(claimCodes(soulQuest(), [asPackage(soulQuest({ title: 'Rival' }), 'rival-quest')])).toContain('BEAT_ALREADY_CLAIMED');
  });
  it('removes the claimed beat node and makes the quest the writer', () => {
    const g = buildCampaignGraph([asPackage(soulQuest(), 'soul-job')]);
    expect(g.nodes.some((n) => n.id === 'act1.soul-1')).toBe(false);
    expect(g.variables.find((v) => v.name === 'soul_dent_unlocked')?.writers).toEqual(['quest.soul-job']);
    expect(validateStoryGraph(g).filter((f) => f.severity === 'error')).toEqual([]);
  });
});
