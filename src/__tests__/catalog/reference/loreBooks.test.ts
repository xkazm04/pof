import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { loreBooks, seedLoreSteps } from '@/lib/catalog/reference/loreBooks';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { wrapTable } from '@/lib/catalog/reference/wrapper';

const textSpec = DIABLO1.tables.find((entry) => entry.file === 'text/textdat.tsv')!;
const columns = Object.keys(textSpec.map);
const table = (rows: Record<string, string>[]) => [
  columns.join('\t'),
  ...rows.map((row) => columns.map((column) => row[column] ?? '').join('\t')),
].join('\n');
const invented = (label: string) => `${label} ${'made-up lore '.repeat(40)}`;
const wrappers = wrapTable(DIABLO1, textSpec, table([
  { txtstrid: 'TEXT_BOOK11', txtstr: invented('Synthetic library page.'), scrlltxt: 'true', sfxnr: 'SYNTH_LIBRARY' },
  { txtstrid: 'TEXT_BONER', txtstr: invented('Synthetic warrior reading.'), scrlltxt: 'true', sfxnr: 'SYNTH_WARRIOR' },
  { txtstrid: 'TEXT_RBONER', txtstr: invented('Synthetic rogue reading.'), scrlltxt: 'true', sfxnr: 'SYNTH_ROGUE' },
  { txtstrid: 'TEXT_MBONER', txtstr: invented('Synthetic sorcerer reading.'), scrlltxt: 'true', sfxnr: 'SYNTH_SORCERER' },
  { txtstrid: 'TEXT_HBONER', txtstr: invented('Synthetic monk reading.'), scrlltxt: 'true', sfxnr: 'SYNTH_MONK' },
  { txtstrid: 'TEXT_BLINDING', txtstr: invented('Synthetic incomplete quest reading.'), scrlltxt: 'true', sfxnr: 'SYNTH_BLIND' },
]), 't0').wrappers;
const result = loreBooks(wrappers);

describe('loreBooks', () => {
  it('aggregates one entry per title and keeps the engine volume order', () => {
    const book = result.wrappers.find((entry) => entry.entity.id === 'd1-lore-mythical-book')!;
    const volumes = book.entity.data.volumes as { line: string; text: string; voiceClip?: string; scrolling: unknown }[];
    expect(volumes.map((volume) => volume.line)).toEqual(['TEXT_BONER', 'TEXT_RBONER', 'TEXT_MBONER', 'TEXT_HBONER']);
    expect(volumes[0]).toMatchObject({ voiceClip: 'SYNTH_WARRIOR', scrolling: 'true' });
    expect(book.entity.name).toBe('Mythical Book');
    expect(book.entity.tags).toEqual(['diablo-lore']);
  });

  it('adds a quest link only when the engine configuration ties the book to a quest', () => {
    const questBook = result.wrappers.find((entry) => entry.entity.id === 'd1-lore-mythical-book')!;
    const libraryBook = result.wrappers.find((entry) => entry.entity.id === 'd1-lore-the-great-conflict')!;
    expect(questBook.entity.links).toEqual([{ catalogId: 'quests', entityId: 'd1-Q_SCHAMB', role: 'cross-reference' }]);
    expect(libraryBook.entity.links).toEqual([]);
  });

  it('reports configured lines that have no wrapper and lists text plus engine provenance', () => {
    expect(result.unresolved).toContainEqual({ entry: 'Book of the Blind', line: 'TEXT_RBLINDING' });
    const book = result.wrappers.find((entry) => entry.entity.id === 'd1-lore-mythical-book')!;
    expect(book.entity.provenance?.sourceFile).toContain('text/textdat.tsv');
    expect(book.entity.provenance?.sourceFile).toContain('Source/objects.cpp');
    expect(book.entity.provenance?.sourceRow).toContain('TEXT_BONER');
    expect(book.entity.provenance?.sourceRow).toContain('Source/objects.cpp:1969');
  });
});

describe('seedLoreSteps', () => {
  const entity = result.wrappers.find((entry) => entry.entity.id === 'd1-lore-mythical-book')!.entity;
  const seeds = seedLoreSteps(entity);

  it('seeds only Lore Body and Unlock Rules, with verbatim joined volumes and SOURCED stamps', () => {
    expect(seeds.map((seed) => seed.step)).toEqual(['Lore Body', 'Unlock Rules']);
    for (const seed of seeds) expect(seed.data.sourced).toBeDefined();
    const volumes = entity.data.volumes as { text: string }[];
    expect(seeds[0].data.loreBody).toBe(volumes.map((volume) => volume.text).join('\n\n'));
  });

  it('records the engine read path and quest dependency in the codex unlock-rule shape', () => {
    const rules = seeds[1].data.unlockRules as {
      primary: { trigger: string };
      fallback: { trigger: string };
      wiringContract: { dependencies: string[] };
    };
    expect(rules.primary.trigger).toContain('OBJ_BOOK2R');
    expect(rules.fallback.trigger).toContain('No alternate reveal path');
    expect(rules.wiringContract.dependencies).toEqual(['quests::d1-Q_SCHAMB']);
    expect(seeds[1].gaps.join(' ')).toContain('no alternate unlock path');
  });

  it('both valid codex artifacts are held pending as SOURCED, never passed', () => {
    const pipeline = getCatalogPipeline('codex')!;
    const context = { catalog: 'codex', siblings: {}, has: () => true, canonProfile: 'diablo1' };
    for (const seed of seeds) {
      const accept = pipeline.steps.find((step) => step.label === seed.step)!.accept;
      const verdict = accept(seed.data, context);
      expect(verdict.status).toBe('pending');
      // Held by the SOURCED stamp, or by a PoF style law not in force under diablo1 (codex-lore-depth, W22) — never passed.
      expect(verdict.reason).toMatch(/^(SOURCED|UNGRADED):/);
    }
  });
});
