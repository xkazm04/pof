// W22: F18's bases resolution (vault Decisions Z-D97, Z-D98). A bare FIRST base of a cpp-decls class record becomes an
// 'extends' link on the child's PROJECTION — to the parent record's entity id and the parent record's OWN catalog — or, when
// no record of the run answers it, an explicit marker that keeps the name as written and is listed in the run's LinkReport.
// The pass is a run-level link pass of the botw source; its version joins every cpp-decls spec's mapping version. Raw records
// never move. The two folders below are DERIVED from the registered specs (the first two cpp-decls '/**' specs in different
// catalogs); every line of C++, every name and the one hex value were coined for this test.
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { gap, type FieldMap } from '@/lib/catalog/ingest/fieldMap';
import { parseCppDecls } from '@/lib/catalog/ingest/cppDecls';
import { CPP_DECLS_PARENT_PASS, EXTENDS_ROLE, UNRESOLVED_MARKER_FIELD } from '@/lib/catalog/reference/baseLinks';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { resolveLinks } from '@/lib/catalog/reference/links';
import { BOTW, DIABLO1 } from '@/lib/catalog/reference/sources';
import { mappingVersion, projectionHash, wrapTable, type ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const TREE_SPECS = BOTW.tables.filter((t) => t.technique === 'cpp-decls' && t.file.includes('/**'));
const NEAR = TREE_SPECS[0];
const FAR = TREE_SPECS.find((t) => t.catalogId !== NEAR.catalogId)!;
const dirOf = (glob: string) => glob.slice(0, glob.indexOf('/**'));

const NEAR_H = `${dirOf(NEAR.file)}/marrowNear.h`;
const NEAR_CPP = `${dirOf(NEAR.file)}/marrowNear.cpp`;
const FAR_H = `${dirOf(FAR.file)}/marrowFar.h`;

const FILES: Record<string, string> = {
  [NEAR_H]: [
    'namespace marrowkit {',
    'class MarrowBase {};',
    'class MarrowChild : public MarrowBase {};',
    'class MarrowCrosser : public MarrowRemote {};',
    'class MarrowSibling {};',
    'class MarrowOuter {',
    '  class MarrowSibling {};',
    '  class MarrowNested : public MarrowSibling {};',
    '};',
    'namespace marrowdeep {',
    'class MarrowDeep : public MarrowSummit {};',
    'class MarrowTyped : public MarrowBase<int> {};',
    '}',
    'class MarrowLost : public MarrowMissing {};',
    'class MarrowHaunted : public MarrowGhost {};',
    'class MarrowQualified : public marrowyonder::MarrowBase {};',
    'class MarrowAlone {',
    '  // marrowscope bound at 0xbeadfeed',
    '  int* mMarrowGauge;',
    '};',
    'class MarrowSelfish : public MarrowSelfish {};',
    'enum class MarrowMode { MarrowStill, MarrowBrisk };',
    '}',
    'class MarrowSummit {};',
    'enum class MarrowGhost { MarrowWisp, MarrowShade };',
    '',
  ].join('\n'),
  [NEAR_CPP]: [
    'namespace marrowkit {',
    'void MarrowChild::marrowStir() {}',
    '}',
    '',
  ].join('\n'),
  [FAR_H]: [
    'namespace marrowkit {',
    'class MarrowRemote {};',
    '}',
    '',
  ].join('\n'),
};

function syntheticDeps(db: Database.Database) {
  return {
    db,
    readFile: (p: string) => FILES[p.replace(/\\/g, '/').replace(/^clone\//, '')],
    listFiles: () => Object.keys(FILES),
  };
}

function ingestOnce() {
  const db = new Database(':memory:');
  const summary = ingestSourceFromDir(BOTW.id, 'clone', syntheticDeps(db));
  const wrappers = listWrappers(db, { sourceId: BOTW.id });
  const decl = (qualifiedName: string, kind = 'class') => wrappers.find((w) => w.raw.qualifiedName === qualifiedName && w.raw.kind === kind)!;
  const extendsOf = (w: ReferenceWrapper) => (w.entity.links ?? []).filter((l) => l.role === EXTENDS_ROLE);
  const markerOf = (w: ReferenceWrapper) => w.entity.data[UNRESOLVED_MARKER_FIELD];
  return { db, summary, wrappers, decl, extendsOf, markerOf };
}

describe('BOTW bases resolution: a bare first base becomes a parent link on the projection (W22)', () => {
  it('derives two folders in different catalogs from the registered specs', () => {
    expect(NEAR).toBeDefined();
    expect(FAR).toBeDefined();
    expect(FAR.catalogId).not.toBe(NEAR.catalogId);
    expect(BOTW.linkPasses).toEqual([CPP_DECLS_PARENT_PASS]);
  });

  it('resolves a bare parent in the same namespace to its record\'s entity id and catalog', () => {
    const { decl, extendsOf } = ingestOnce();
    const parent = decl('marrowkit::MarrowBase');
    expect(extendsOf(decl('marrowkit::MarrowChild'))).toEqual([{ catalogId: parent.catalogId, entityId: parent.entity.id, role: EXTENDS_ROLE }]);
    expect(parent.catalogId).toBe(NEAR.catalogId);
  });

  it('gives a parent wrapped by another spec in another catalog the PARENT\'s catalog', () => {
    const { decl, extendsOf } = ingestOnce();
    const child = decl('marrowkit::MarrowCrosser');
    const parent = decl('marrowkit::MarrowRemote');
    expect(parent.catalogId).toBe(FAR.catalogId);
    expect(extendsOf(child)).toEqual([{ catalogId: FAR.catalogId, entityId: parent.entity.id, role: EXTENDS_ROLE }]);
    expect(child.catalogId).not.toBe(parent.catalogId);
  });

  it('looks in the enclosing class first: a nested sibling wins over a same-named class at namespace scope', () => {
    const { decl, extendsOf } = ingestOnce();
    const nestedSibling = decl('marrowkit::MarrowOuter::MarrowSibling');
    const namespaceSibling = decl('marrowkit::MarrowSibling');
    expect(nestedSibling).toBeDefined();
    expect(namespaceSibling).toBeDefined();
    expect(extendsOf(decl('marrowkit::MarrowOuter::MarrowNested'))).toEqual([
      { catalogId: nestedSibling.catalogId, entityId: nestedSibling.entity.id, role: EXTENDS_ROLE },
    ]);
  });

  it('walks the namespaces outward to the global scope, template arguments stripped', () => {
    const { decl, extendsOf } = ingestOnce();
    expect(extendsOf(decl('marrowkit::marrowdeep::MarrowDeep')).map((l) => l.entityId)).toEqual([decl('MarrowSummit').entity.id]);
    expect(extendsOf(decl('marrowkit::marrowdeep::MarrowTyped')).map((l) => l.entityId)).toEqual([decl('marrowkit::MarrowBase').entity.id]);
  });

  it('marks a parent no record answers with the name as written, lists it in the LinkReport and never guesses an id', () => {
    const { summary, decl, extendsOf, markerOf } = ingestOnce();
    const lost = decl('marrowkit::MarrowLost');
    expect(extendsOf(lost)).toEqual([]);
    expect(markerOf(lost)).toEqual([{ role: EXTENDS_ROLE, ref: 'MarrowMissing' }]);
    expect(summary.links.unresolved).toContainEqual({ wrapperId: lost.wrapperId, role: EXTENDS_ROLE, catalogId: '', ref: 'MarrowMissing' });
    // An enum record carries the id a guess would build; the generic loop must not turn the marker into it.
    const haunted = decl('marrowkit::MarrowHaunted');
    expect(decl('MarrowGhost', 'enum').entity.id).toBe(`${BOTW.idPrefix}-MarrowGhost`);
    expect(haunted.entity.links ?? []).toEqual([]);
    expect(markerOf(haunted)).toEqual([{ role: EXTENDS_ROLE, ref: 'MarrowGhost' }]);
    expect(summary.links.unresolved.filter((u) => u.role === EXTENDS_ROLE).map((u) => u.ref).sort()).toEqual(['MarrowGhost', 'MarrowMissing', 'MarrowSelfish']);
  });

  it('gives a qualified base, no base, and definition, enum and handle records neither a link nor a marker', () => {
    const { wrappers, decl, markerOf } = ingestOnce();
    const untouched = [
      decl('marrowkit::MarrowQualified'), decl('marrowkit::MarrowAlone'), decl('marrowkit::MarrowMode', 'enum'),
      ...wrappers.filter((w) => w.raw.kind === 'definition' || w.raw.kind === 'handle'),
    ];
    expect(wrappers.some((w) => w.raw.kind === 'definition')).toBe(true);
    expect(wrappers.some((w) => w.raw.kind === 'handle')).toBe(true);
    for (const w of untouched) {
      expect(w.entity.links ?? []).toEqual([]);
      expect(markerOf(w)).toBeUndefined();
    }
  });

  it('never links a record to itself', () => {
    const { wrappers, decl, extendsOf, markerOf } = ingestOnce();
    for (const w of wrappers) expect(extendsOf(w).some((l) => l.entityId === w.entity.id)).toBe(false);
    expect(markerOf(decl('marrowkit::MarrowSelfish'))).toEqual([{ role: EXTENDS_ROLE, ref: 'MarrowSelfish' }]);
  });

  it('stamps a rewritten row with its spec\'s printed version, which joins the pass to the map; a reason\'s text moves the version, never the projection', () => {
    const { summary, decl } = ingestOnce();
    const printed = summary.tables.find((t) => t.file === NEAR.file && t.status === 'ingested' && t.mappingVersion.includes('+'))!;
    const child = decl('marrowkit::MarrowChild');
    expect(child.mappingVersion).toBe(printed.mappingVersion);
    expect(child.mappingVersion).toBe(`${mappingVersion(NEAR.map)}+${CPP_DECLS_PARENT_PASS.version}`);
    expect(child.mappingVersion).not.toBe(mappingVersion(NEAR.map));
    const handleTable = summary.tables.find((t) => t.file === NEAR.file && !t.mappingVersion.includes('+'));
    expect(handleTable).toBeDefined();

    const reworded: FieldMap = { ...NEAR.map, methods: gap('a reworded reason, coined for this test') };
    const before = wrapTable(BOTW, { ...NEAR, file: NEAR_H }, FILES[NEAR_H]);
    const after = wrapTable(BOTW, { ...NEAR, file: NEAR_H, map: reworded }, FILES[NEAR_H]);
    expect(after.mappingVersion).not.toBe(before.mappingVersion);
    expect(after.wrappers.map((w) => projectionHash(w.entity))).toEqual(before.wrappers.map((w) => projectionHash(w.entity)));
  });

  it('keeps every raw record equal to a reader-only read, file by file', () => {
    const { wrappers } = ingestOnce();
    for (const [file, text] of Object.entries(FILES)) {
      const stored = wrappers.filter((w) => w.file === file && w.technique.startsWith('cpp-decls@')).map((w) => JSON.stringify(w.raw)).sort();
      expect(stored).toEqual(parseCppDecls(text, { file }).rows.map((r) => JSON.stringify(r)).sort());
    }
  });

  it('is idempotent: a second ingest creates and reprojects nothing', () => {
    const db = new Database(':memory:');
    const first = ingestSourceFromDir(BOTW.id, 'clone', syntheticDeps(db));
    expect(first.store.created).toBeGreaterThan(0);
    const second = ingestSourceFromDir(BOTW.id, 'clone', syntheticDeps(db));
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: first.store.created });
    expect(second.links.resolved).toBe(first.links.resolved);
    expect(second.links.resolved).toBe(5);
  });

  it('returns diablo1-shaped wrappers unchanged and never joins a tsv spec\'s version', () => {
    const tsv: ReferenceWrapper = {
      wrapperId: 'diablo1:items/x.tsv:MarrowRelic', sourceId: 'diablo1', file: 'items/x.tsv', technique: 'tsv@1',
      key: 'MarrowRelic', keyKind: 'column', raw: { kind: 'class', bases: 'MarrowBase', qualifiedName: 'MarrowRelic' }, rawHash: 'r',
      catalogId: 'items', mappingVersion: 'synthetic',
      entity: { id: 'd1-MarrowRelic', name: 'MarrowRelic', data: {}, links: [{ catalogId: 'items', entityId: 'MarrowBase', role: 'base-item' }] } as unknown as ReferenceWrapper['entity'],
    };
    const passed = CPP_DECLS_PARENT_PASS.run([tsv]);
    expect(passed.wrappers[0]).toBe(tsv);
    expect(passed.unresolved).toEqual([]);
    expect(DIABLO1.linkPasses).toBeUndefined();
    expect(resolveLinks([tsv], DIABLO1.idPrefix, DIABLO1.linkPasses)).toEqual(resolveLinks([tsv], DIABLO1.idPrefix));
    const spec = DIABLO1.tables[0];
    const text = 'x\n';
    expect(wrapTable({ ...DIABLO1, linkPasses: [CPP_DECLS_PARENT_PASS] }, spec, text).mappingVersion).toBe(wrapTable(DIABLO1, spec, text).mappingVersion);
  });
});
