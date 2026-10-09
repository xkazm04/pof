// Stale-wrapper retirement on an in-memory store: a re-keyed record leaves its old row behind, and only
// a guarded, source-scoped step may delete it. Synthetic fixtures with coined names only.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { botwClassMap } from '@/lib/catalog/ingest/botw';
import { gap } from '@/lib/catalog/ingest/fieldMap';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { REFERENCE_SOURCES, type ReferenceSource } from '@/lib/catalog/reference/sources';
import { findStaleWrappers, producedWrapperIds, retireStaleWrappers } from '@/lib/catalog/reference/staleWrappers';
import { listWrappers, upsertWrappers } from '@/lib/catalog/reference/wrappers-db';

const MAP = botwClassMap({ bases: gap('fixture'), methods: gap('fixture'), fields: gap('fixture') });
const fixtureSource = (id: string, idPrefix: string, glob: string): ReferenceSource => ({
  id, game: 'Fixture', project: 'synthetic', licenceNote: 'synthetic test fixture', idPrefix, obtain: 'n/a', canonProfile: 'pof',
  tables: [{ file: glob, catalogId: 'player-movement', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: MAP }],
});
const TESSEL = fixtureSource('stale-tessel', 'stt', 'src/Tessel/**/*.{h,cpp}');
const OTHER = fixtureSource('stale-other', 'sto', 'src/Quernery/**/*.{h,cpp}');

let db: Database.Database;
let files: Record<string, string>;
const readFile = (p: string) => {
  const text = files[p.replace(/\\/g, '/').replace(/^root\//, '')];
  if (text === undefined) throw new Error(`no such file ${p}`);
  return text;
};
const deps = () => ({ db, readFile, listFiles: () => Object.keys(files), now: '2026-10-10T00:00:00.000Z' });
const produced = (source: ReferenceSource) => producedWrapperIds(source, Object.keys(files), readFile);
const ids = (sourceId: string) => listWrappers(db, { sourceId }).map((w) => w.wrapperId);

/** Simulate the row an earlier reader version left behind: the definition record under its file-less v2 key. */
function plantOldDefinitionRow(): string {
  const current = listWrappers(db, { sourceId: TESSEL.id }).find((w) => w.raw.kind === 'definition')!;
  const oldKey = current.key.replace(/::\(definitions@[^)]*\)$/, '::(definitions)');
  const old = {
    ...current, key: oldKey, wrapperId: `${TESSEL.id}:${current.file}:${oldKey}`,
    raw: { ...current.raw, qualifiedName: oldKey }, rawHash: 'old-reader', entity: { ...current.entity, id: `stt-${oldKey}` },
  };
  expect(upsertWrappers(db, [old])).toMatchObject({ created: 1 });
  return old.wrapperId;
}

beforeAll(() => { REFERENCE_SOURCES[TESSEL.id] = TESSEL; REFERENCE_SOURCES[OTHER.id] = OTHER; });
afterAll(() => { delete REFERENCE_SOURCES[TESSEL.id]; delete REFERENCE_SOURCES[OTHER.id]; });
beforeEach(() => {
  db = new Database(':memory:');
  files = {
    'src/Tessel/pumicer.h': 'namespace tessel { class Pumicer { void whetEdge(); }; }',
    'src/Tessel/pumicer.cpp': 'namespace tessel { void Pumicer::whetEdge() {} }',
    'src/Quernery/quern.cpp': 'namespace quernery { void Quernstone::grindFine() {} }',
  };
  ingestSourceFromDir(TESSEL.id, 'root', deps());
  ingestSourceFromDir(OTHER.id, 'root', deps());
});

describe('stale wrappers', () => {
  it('produces exactly the ids an ingest writes, without writing', () => {
    expect([...produced(TESSEL).ids].sort()).toEqual(ids(TESSEL.id));
    expect(produced(TESSEL).refused).toEqual([]);
    expect(findStaleWrappers(db, TESSEL.id, produced(TESSEL).ids)).toEqual([]);
  });

  it('finds the row a re-key left behind, with its kind and entity id', () => {
    const old = plantOldDefinitionRow();
    expect(findStaleWrappers(db, TESSEL.id, produced(TESSEL).ids)).toEqual([{
      wrapperId: old, file: 'src/Tessel/pumicer.cpp', kind: 'definition', entityId: 'stt-tessel::Pumicer::(definitions)', catalogId: 'player-movement',
    }]);
  });

  it('refuses a count other than the expected one, and deletes nothing', () => {
    plantOldDefinitionRow();
    const before = ids(TESSEL.id);
    const result = retireStaleWrappers(db, TESSEL.id, produced(TESSEL).ids, { expected: 2, kinds: ['definition'] });
    expect(result).toMatchObject({ ok: false, reason: 'stale count 1 is not the expected 2' });
    expect(ids(TESSEL.id)).toEqual(before);
  });

  it('refuses when a stale row is of a kind the guard does not allow, and deletes nothing', () => {
    plantOldDefinitionRow();
    files['src/Tessel/pumicer.h'] = 'namespace tessel { class Pumicery { void whetEdge(); }; }';
    const before = ids(TESSEL.id);
    const result = retireStaleWrappers(db, TESSEL.id, produced(TESSEL).ids, { expected: 2, kinds: ['definition'] });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('1 stale row(s) of a kind the guard does not allow (class');
    expect(ids(TESSEL.id)).toEqual(before);
  });

  it('refuses a read that produced nothing', () => {
    plantOldDefinitionRow();
    expect(retireStaleWrappers(db, TESSEL.id, new Set(), { expected: 3, kinds: ['definition', 'class'] }))
      .toMatchObject({ ok: false, reason: 'the read produced no wrapper — it cannot judge which rows are stale' });
    expect(listWrappers(db, { sourceId: TESSEL.id })).toHaveLength(3);
  });

  it('retires exactly the stale rows of its own source, then a re-run finds none and an ingest moves nothing', () => {
    const old = plantOldDefinitionRow();
    const otherBefore = ids(OTHER.id);
    const result = retireStaleWrappers(db, TESSEL.id, produced(TESSEL).ids, { expected: 1, kinds: ['definition'] });
    expect(result).toMatchObject({ ok: true, retired: [{ wrapperId: old }] });
    expect(ids(TESSEL.id)).toEqual([...produced(TESSEL).ids].sort());
    expect(ids(OTHER.id)).toEqual(otherBefore);
    expect(otherBefore).toHaveLength(1);
    expect(findStaleWrappers(db, TESSEL.id, produced(TESSEL).ids)).toEqual([]);
    expect(ingestSourceFromDir(TESSEL.id, 'root', deps()).store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 2 });
  });

  it('never judges another source: rows of a source the read does not cover are all "stale" to it, so the caller scopes by source', () => {
    // The same produced set judged against the OTHER source flags its row — which is why every call names its source.
    expect(findStaleWrappers(db, OTHER.id, produced(TESSEL).ids).map((s) => s.wrapperId)).toEqual(ids(OTHER.id));
    expect(findStaleWrappers(db, OTHER.id, produced(OTHER).ids)).toEqual([]);
  });

  it('throws on an unreadable file instead of reading its rows as stale', () => {
    const listed = [...Object.keys(files), 'src/Tessel/missing.h'];
    expect(() => producedWrapperIds(TESSEL, listed, readFile)).toThrow('no such file');
  });
});
