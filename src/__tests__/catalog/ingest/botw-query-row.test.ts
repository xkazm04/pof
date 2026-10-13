// W32 part 2: the BOTW condition-query folder - ONE glob read by a PAIR of specs (the cpp-decls records under the query-node map, the
// cpp-registrations records under the registration map), both in the plurality catalog. Every path is derived at run time from the
// registered specs, so no file name is written out, and every line of C++ and every name in it was coined for this test (checked
// whole-word against the reference clone: 0 hits).
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import {
  BEHAVIOUR_NODE_ROW_MAP, BOTW_DESCOPES, MANAGER_CLASS_MAP, PARAMETER_HANDLE_MAP, PARAMETER_REGISTRATION_MAP, QUERY_NODE_ROW_MAP,
} from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { CPP_RECORD_COLUMNS, parseCppDecls } from '@/lib/catalog/ingest/cppDecls';
import { CPP_REGISTRATION_COLUMNS, parseCppRegistrations } from '@/lib/catalog/ingest/cppRegistrations';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage, expandGlob, matchesGlob } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const REGS_SPEC = BOTW.tables.find((t) => t.technique === 'cpp-registrations')!; // the one spec of the third reader: the pair is found from it, so a swapped map fails an assertion, not the module load
const DECLS_SPEC = BOTW.tables.find((t) => t.technique === 'cpp-decls' && t.file === REGS_SPEC.file)!;
const PAIR = [DECLS_SPEC, REGS_SPEC];
const FOLDER = DECLS_SPEC.file.slice(0, DECLS_SPEC.file.lastIndexOf('/'));
const descoped = (path: string) => BOTW_DESCOPES.some((d) => matchesGlob(path, d.pattern));

/** Three coined nodes: two register parameters (2 and 1 of their fields), one declares no loading hook at all and holds no field. */
const REGISTERED = [2, 1, 0];
const fileOf = (k: number, ext: string) => `${FOLDER}/coinedQuery${k}.${ext}`;
const HEADERS = REGISTERED.map((n, k) => `
namespace harrowmere::lantern {
class Dunmoor${k} : public harrowmere::Bridlewick {
public:
    Dunmoor${k}();
    ~Dunmoor${k}() override;
    bool weighTide(Weighbar* wb) const override;${k < 2 ? `
    void gatherFennel(Fenntray* ft) override;
private:
    float mPlinthSpan;
    int mCoombRate;
    bool mSedgeSeen;` : ''}
};
}`);
const SOURCES = REGISTERED.map((n, k) => `
namespace harrowmere::lantern {
${k === 1 ? 'namespace {\nenum class Hushmood { Brisk, Slack };\n}\n' : ''}Dunmoor${k}::Dunmoor${k}() = default;
bool Dunmoor${k}::weighTide(Weighbar* wb) const { return true; }
${k < 2 ? `void Dunmoor${k}::gatherFennel(Fenntray* ft) {
    tendBinder(&mPlinthSpan, "span", 1);${n === 2 ? `
    tendBinderLate(&mCoombRate, "rate");` : ''}
}` : ''}
}`);
const FILES: Record<string, string> = {
  ...Object.fromEntries(REGISTERED.flatMap((_, k) => [[fileOf(k, 'h'), HEADERS[k]], [fileOf(k, 'cpp'), SOURCES[k]]])),
  [`${FOLDER}/CMakeLists.txt`]: 'add_library(coined)',
  [`${FOLDER}/Coinedsub/stray.h`]: 'namespace harrowmere { class Pennon { int mSlip; }; }',
};
const READ = Object.keys(FILES).filter((p) => /\.(h|cpp)$/.test(p) && !p.includes('Coinedsub'));

describe('BOTW condition-query row spec pair (W32 part 2)', () => {
  it('registers a cpp-decls spec and a cpp-registrations spec over ONE glob, in one real catalog, after the 7b block and before the generic node rows', () => {
    expect(PAIR.map((s) => s.technique)).toEqual(['cpp-decls', 'cpp-registrations']);
    expect(REGS_SPEC.file).toBe(DECLS_SPEC.file);
    for (const s of PAIR) expect(s).toMatchObject({ catalogId: 'state-graph', keyColumn: 'qualifiedName' });
    expect(getCatalogPipeline(DECLS_SPEC.catalogId)).not.toBeNull(); // a real catalog pipeline, never a module
    expect(DECLS_SPEC.map).toBe(QUERY_NODE_ROW_MAP);
    expect(REGS_SPEC.map).toBe(PARAMETER_REGISTRATION_MAP);
    expect([BEHAVIOUR_NODE_ROW_MAP, MANAGER_CLASS_MAP, PARAMETER_HANDLE_MAP]).not.toContain(DECLS_SPEC.map);
    expect([BEHAVIOUR_NODE_ROW_MAP, MANAGER_CLASS_MAP, PARAMETER_HANDLE_MAP]).not.toContain(REGS_SPEC.map);
    // position: the pair is contiguous, directly after the last 7b manager spec and directly before the first generic node row
    const at = PAIR.map((s) => BOTW.tables.indexOf(s));
    expect(at[1]).toBe(at[0] + 1);
    const lastManager = BOTW.tables.filter((t) => t.map === MANAGER_CLASS_MAP).at(-1)!;
    expect(at[0]).toBe(BOTW.tables.indexOf(lastManager) + 1);
    expect(at[1] + 1).toBe(BOTW.tables.indexOf(BOTW.tables.find((t) => t.map === BEHAVIOUR_NODE_ROW_MAP)!));
    // the only cpp-registrations spec of the table, and no cpp-handles twin: the folder holds no handle marker
    expect(BOTW.tables.filter((t) => t.technique === 'cpp-registrations')).toEqual([REGS_SPEC]);
    expect(BOTW.tables.filter((t) => t.technique === 'cpp-handles' && t.file === DECLS_SPEC.file)).toEqual([]);
    // the table is 67 specs: 41 cpp-decls, 25 cpp-handles and this row's one cpp-registrations spec
    expect(BOTW.tables).toHaveLength(67);
  });

  it('reads exactly the folder\'s code files: the pair reads the same set, never a build file, a deeper folder or a file of another spec', () => {
    const everything = Object.keys(FILES);
    expect(expandGlob(everything, DECLS_SPEC.file)).toEqual([...READ].sort());
    expect(expandGlob(everything, REGS_SPEC.file)).toEqual(expandGlob(everything, DECLS_SPEC.file));
    for (const p of READ) expect(BOTW.tables.filter((t) => matchesGlob(p, t.file))).toEqual(PAIR);
    const build = `${FOLDER}/CMakeLists.txt`;
    const deeper = `${FOLDER}/Coinedsub/stray.h`;
    expect(descoped(build)).toBe(true);
    expect(BOTW.tables.some((t) => matchesGlob(build, t.file))).toBe(false);
    expect(descoped(deeper)).toBe(false);
    expect(BOTW.tables.some((t) => matchesGlob(deeper, t.file))).toBe(false); // the glob stops at the folder
    const cov = computePathCoverage(everything, BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    expect(cov).toMatchObject({ total: everything.length, covered: READ.length, descoped: 1, open: 1 });
    expect(cov.openFiles).toEqual([deeper]);
  });

  it('classifies every column of both readers: the query-node map holds three gaps, the registration map two', () => {
    const decls = auditColumns([...CPP_RECORD_COLUMNS], QUERY_NODE_ROW_MAP);
    expect(decls.unclassified).toEqual([]);
    expect(decls.declaredButAbsent).toEqual([]);
    expect(decls).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'outer'],
      dropped: ['file', 'line', 'templateParams'],
      gap: [{ column: 'bases' }, { column: 'methods' }, { column: 'fields' }],
    });
    const regs = auditColumns([...CPP_REGISTRATION_COLUMNS], PARAMETER_REGISTRATION_MAP);
    expect(regs.unclassified).toEqual([]);
    expect(regs.declaredButAbsent).toEqual([]);
    expect(regs).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'owner'],
      dropped: ['file', 'line'],
      gap: [{ column: 'call' }, { column: 'function' }],
    });
    const catalogs = ['state-graph', 'items', 'vendors', 'quests', 'zone-map', 'dialog-trees', 'cutscenes', 'characters', 'factions'];
    for (const g of [...decls.gap, ...regs.gap]) {
      expect(g.why.length).toBeGreaterThan(40);
      for (const id of catalogs) expect(g.why).not.toMatch(new RegExp(`\\b${id}\\b`)); // catalog-neutral: the spec carries the catalog
    }
    // the node-map sentences the Query census made false are not in the new map
    for (const g of decls.gap) expect(g.why).not.toMatch(/fixed node lifecycle \(load parameters|an action base, a general AI node\)|often several levels deep/);
  });

  describe('over a synthetic tree', () => {
    let db: Database.Database;
    let reads: string[];
    beforeEach(() => { db = new Database(':memory:'); reads = []; });
    const deps = () => ({
      db,
      readFile: (p: string) => {
        const rel = p.replace(/\\/g, '/').replace(/^clone\//, '');
        reads.push(rel);
        return FILES[rel];
      },
      listFiles: () => Object.keys(FILES),
    });

    it('pins the row\'s record counts: 7 declaration records and 3 registrations from 6 files, 0 handle records, nothing held twice', () => {
      const first = ingestSourceFromDir('botw', 'clone', deps());
      const readByPair = [...new Set(reads)].filter((p) => matchesGlob(p, DECLS_SPEC.file)).sort();
      expect(readByPair).toEqual([...READ].sort());
      expect(reads).not.toContain(`${FOLDER}/CMakeLists.txt`);
      expect(reads).not.toContain(`${FOLDER}/Coinedsub/stray.h`);
      for (const s of PAIR) {
        const summary = first.tables[BOTW.tables.indexOf(s)];
        expect(summary).toMatchObject({ catalogId: s.catalogId, status: 'ingested', unclassified: [], declaredButAbsent: [], duplicateKeys: 0, malformed: 0 });
      }
      const wrappers = listWrappers(db, { sourceId: 'botw' });
      expect(new Set(wrappers.map((w) => w.entity.id)).size).toBe(wrappers.length);
      const decls = wrappers.filter((w) => w.technique === 'cpp-decls@4');
      const regs = wrappers.filter((w) => w.technique === 'cpp-registrations@1');
      expect(decls.length + regs.length).toBe(wrappers.length); // no cpp-handles record anywhere
      const kinds = (ws: typeof wrappers) => ws.map((w) => w.raw.kind).sort();
      expect(kinds(decls)).toEqual(['class', 'class', 'class', 'definition', 'definition', 'definition', 'enum']);
      expect(kinds(regs)).toEqual(['registration', 'registration', 'registration']);
      expect(wrappers).toHaveLength(10);
      expect(listWrappers(db, { sourceId: 'botw', catalogId: 'state-graph' })).toHaveLength(10);
      expect(new Set(decls.map((w) => w.mappingVersion)).size).toBe(1);
      expect(new Set(regs.map((w) => w.mappingVersion)).size).toBe(1);
      expect(decls[0].mappingVersion).not.toBe(regs[0].mappingVersion); // two maps, two stamps
    });

    it('pairs each registration with a FIELD of its owner\'s class record, and the external base leaves no link and no marker', () => {
      ingestSourceFromDir('botw', 'clone', deps());
      const wrappers = listWrappers(db, { sourceId: 'botw' });
      const classes = wrappers.filter((w) => w.raw.kind === 'class');
      const regs = wrappers.filter((w) => w.raw.kind === 'registration');
      expect(regs.map((w) => w.raw.name).sort()).toEqual(['mCoombRate', 'mPlinthSpan', 'mPlinthSpan']);
      for (const r of regs) {
        const owner = classes.filter((c) => c.raw.name === r.raw.owner && c.raw.namespace === r.raw.namespace);
        expect(owner).toHaveLength(1);
        expect(owner[0].raw.fields.split(';')).toContain(r.raw.name);
      }
      // 3 fields are runtime state: of the 6 fields of the two loading nodes, 3 are registered
      expect(classes.flatMap((c) => (c.raw.fields ? c.raw.fields.split(';') : []))).toHaveLength(6);
      // every first base is spelled qualified, so the run-level parent pass writes neither an extends link nor an unresolved marker
      expect(classes).toHaveLength(3);
      for (const c of classes) {
        expect(c.raw.bases).toBe('harrowmere::Bridlewick');
        expect((c.entity.links ?? []).filter((l) => l.role === 'extends')).toEqual([]);
        expect(c.entity.data.unresolvedLinks).toBeUndefined();
      }
    });

    it('is byte-identical to a direct read of the same text, and a second ingest moves nothing', () => {
      const first = ingestSourceFromDir('botw', 'clone', deps());
      const wrappers = listWrappers(db, { sourceId: 'botw' });
      const sorted = (rows: Record<string, string>[]) => [...rows].sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
      for (const p of READ) {
        const here = wrappers.filter((w) => w.file === p);
        const direct = [
          ...parseCppDecls(FILES[p], { file: p }).rows.map((r) => ({ ...r })),
          ...parseCppRegistrations(FILES[p], { file: p }).rows.map((r) => ({ ...r })),
        ];
        expect(sorted(here.map((w) => w.raw))).toEqual(sorted(direct));
      }
      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: first.store.created });
    });
  });
});
