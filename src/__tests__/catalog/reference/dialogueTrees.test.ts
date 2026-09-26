import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { graphValid } from '@/lib/catalog/acceptance/graphCheckers';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { dialogueTrees, seedDialogSteps } from '@/lib/catalog/reference/dialogueTrees';
import { resolveLinks } from '@/lib/catalog/reference/links';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { wrapTable } from '@/lib/catalog/reference/wrapper';

const spec = (file: string) => DIABLO1.tables.find((table) => table.file === file)!;
const table = (columns: string[], rows: Record<string, string>[]) =>
  [columns.join('\t'), ...rows.map((row) => columns.map((column) => row[column] ?? '').join('\t'))].join('\n');
const wrapped = (file: string, rows: Record<string, string>[]) => {
  const source = spec(file);
  return wrapTable(DIABLO1, source, table(Object.keys(source.map), rows), 't0').wrappers;
};

const characterRows = wrapped('towners/towners.tsv', [
  { type: 'TOWN_HOST', name: 'Synthetic Host', gossipTexts: 'TEXT_SYNTH_GOSSIP' },
  { type: 'TOWN_COW', name: 'Synthetic Cow', gossipTexts: 'TEXT_SYNTH_COW' },
  { type: 'TOWN_COW', name: 'Synthetic Cow', gossipTexts: 'TEXT_SYNTH_COW' },
  { type: 'TOWN_COW', name: 'Synthetic Cow', gossipTexts: 'TEXT_SYNTH_COW' },
  { type: 'TOWN_EMPTY', name: 'Silent Synthetic', gossipTexts: '' },
  { type: 'TOWN_BROKEN', name: 'Broken Synthetic', gossipTexts: 'TEXT_SYNTH_MISSING' },
]);
const lineRows = wrapped('text/textdat.tsv', [
  { txtstrid: 'TEXT_SYNTH_GOSSIP', txtstr: 'A made-up greeting.', scrlltxt: 'false', sfxnr: 'VOICE_SYNTH_GOSSIP' },
  { txtstrid: 'TEXT_SYNTH_COW', txtstr: 'A made-up bovine line.', scrlltxt: 'false', sfxnr: 'None' },
  { txtstrid: 'TEXT_SYNTH_ROCK', txtstr: 'A made-up first topic.', scrlltxt: 'true', sfxnr: 'VOICE_SYNTH_TOPIC' },
  { txtstrid: 'TEXT_SYNTH_MUSHROOM', txtstr: 'A made-up second topic.', scrlltxt: 'false', sfxnr: 'None' },
]);
const questTalkRows = wrapped('towners/quest_dialog.tsv', [{
  towner_type: 'TOWN_HOST',
  Q_ROCK: 'TEXT_SYNTH_ROCK',
  Q_MUSHROOM: 'TEXT_SYNTH_MUSHROOM',
  Q_GARBUD: 'TEXT_SYNTH_TOPIC_MISSING',
}]);
// Deliberately scramble table projection order: aggregation must restore quest enum order.
questTalkRows[0].entity.data.questTalk = [...(questTalkRows[0].entity.data.questTalk as unknown[])].reverse();
const questRows = wrapped('quests/questdat.tsv', [
  { qlstr: 'Invented Stone Errand' },
  { qlstr: 'Invented Fungal Errand' },
  { qlstr: 'Invented Third Errand' },
]);
const wrappers = resolveLinks(
  [...characterRows, ...lineRows, ...questTalkRows, ...questRows],
  'd1',
).wrappers;
const result = dialogueTrees(wrappers);

describe('dialogueTrees', () => {
  it('aggregates one conversation per towner, including one tree for all duplicate cow rows', () => {
    expect(result.wrappers.map((tree) => tree.entity.id).sort()).toEqual([
      'd1-dialog-TOWN_COW',
      'd1-dialog-TOWN_HOST',
    ]);
    expect(result.wrappers.filter((tree) => tree.entity.id === 'd1-dialog-TOWN_COW')).toHaveLength(1);
  });

  it('skips towners with no resolvable lines and reports the reason', () => {
    expect(result.skipped).toContainEqual({
      towner: 'TOWN_EMPTY',
      reason: 'no gossip or quest-talk lines are present in the reference tables',
    });
    expect(result.skipped.find((item) => item.towner === 'TOWN_BROKEN')?.reason).toMatch(/resolved/);
  });

  it('reports missing line wrappers instead of silently dropping their references', () => {
    expect(result.unresolved).toEqual(expect.arrayContaining([
      { towner: 'TOWN_HOST', line: 'TEXT_SYNTH_TOPIC_MISSING' },
      { towner: 'TOWN_BROKEN', line: 'TEXT_SYNTH_MISSING' },
    ]));
  });

  it('orders topics by QUEST_ROW_IDS and carries host/quest links plus all read provenance files', () => {
    const host = result.wrappers.find((tree) => tree.entity.id === 'd1-dialog-TOWN_HOST')!;
    const data = host.entity.data as { speaker: string; topics: { quest: string; questEntity: string; questTitle: string; expansion: string; line: string }[] };
    expect(data.speaker).toBe('d1-TOWN_HOST');
    expect(data.topics.map((topic) => topic.quest)).toEqual(['Q_ROCK', 'Q_MUSHROOM']);
    expect(data.topics[0]).toMatchObject({
      questEntity: 'd1-Q_ROCK',
      questTitle: 'Invented Stone Errand',
      expansion: 'diablo',
      line: 'TEXT_SYNTH_ROCK',
    });
    expect(host.entity.links).toEqual([
      { catalogId: 'characters', entityId: 'd1-TOWN_HOST', role: 'host' },
      { catalogId: 'quests', entityId: 'd1-Q_ROCK', role: 'advances' },
      { catalogId: 'quests', entityId: 'd1-Q_MUSHROOM', role: 'advances' },
    ]);
    for (const file of ['towners/towners.tsv', 'text/textdat.tsv', 'towners/quest_dialog.tsv', 'quests/questdat.tsv']) {
      expect(host.entity.provenance?.sourceFile).toContain(file);
    }
  });
});

describe('seedDialogSteps', () => {
  const entity = result.wrappers.find((tree) => tree.entity.id === 'd1-dialog-TOWN_HOST')!.entity;
  const seeds = seedDialogSteps(entity);

  it('seeds only Branch Graph and VO Script and stamps both as SOURCED', () => {
    expect(seeds.map((seed) => seed.step)).toEqual(['Branch Graph', 'VO Script']);
    for (const seed of seeds) expect(seed.data.sourced).toBeDefined();
  });

  it('builds the engine-law graph with the handler gap, service placeholder, topic conditions, and back edge', () => {
    const branch = seeds[0];
    const graph = branch.data.graph as { nodes: { id: string; label: string; terminal?: boolean }[]; edges: { from: string; to: string; label?: string }[] };
    expect(graph.nodes[0]).toMatchObject({ id: 'quest_handlers' });
    expect(graph.nodes.find((node) => node.id === 'services')).toMatchObject({ terminal: true });
    expect(graph.nodes.find((node) => node.id === 'gossip')?.label).toContain('TEXT_SYNTH_GOSSIP');
    expect(graph.edges).toContainEqual({ from: 'talk', to: 'topic_q_rock', label: 'quest Q_ROCK ACTIVE and logged' });
    expect(graph.edges).toContainEqual({ from: 'talk', to: 'menu', label: 'Back' });
    expect(branch.gaps).toContain('quest_handlers: the ordered first-match handlers live in engine code (towners.cpp TalkTo*), not in the reference tables');
    expect(graphValid('graph', 'valid')(branch.data).status).toBe('pass');
  });

  it('the real registered Branch Graph step fails only because the valid artifact is sourced', () => {
    const accept = getCatalogPipeline('dialog-trees')!.steps.find((step) => step.label === 'Branch Graph')!.accept;
    const context = { catalog: 'dialog-trees', siblings: {}, has: () => true, canonProfile: 'diablo1' };
    const sourced = accept(seeds[0].data, context);
    expect(sourced.status).toBe('pending');
    expect(sourced.reason).toMatch(/^SOURCED:/);
    const unsourced = { ...seeds[0].data };
    delete unsourced.sourced;
    expect(accept(unsourced, context).status).toBe('pass');
  });

  it('writes one checklist entry per gossip/topic line with exact clip-or-gap and scrolling metadata', () => {
    const vo = seeds[1];
    const entries = vo.data.voLines as string[];
    expect(entries).toHaveLength(3);
    expect(entries[0]).toContain('TEXT_SYNTH_GOSSIP: "A made-up greeting."');
    expect(entries[0]).toContain('voiceClip: VOICE_SYNTH_GOSSIP; scrolling: false');
    expect(entries.find((entry) => entry.startsWith('TEXT_SYNTH_MUSHROOM:'))).toContain(`voiceClip: ${REFERENCE_GAP}; scrolling: false`);
    expect(vo.gaps).toContain('TEXT_SYNTH_MUSHROOM.voiceClip: this reference line is unvoiced; no clip name was invented');
  });
});
