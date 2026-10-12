// W31: the BOTW expansion-content files item 7b kept open - three singleton managers under ONE catalog-neutral manager map.
// Two of them share a folder with a second home, so they are named by stem; the engine folder's code files share one home, so a
// folder glob is honest there. Every path is derived at run time from the registered specs, so no file name is written out, and
// every line of C++ and every name in it was coined for this test (checked whole-word against the reference clone: 0 hits).
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import {
  BEHAVIOUR_NODE_ROW_MAP, BOTW_DESCOPES, CAMERA_SHOT_NODE_MAP, DATA_SCHEMA_CLASS_MAP, MANAGER_CLASS_MAP, MOUNT_CLASS_MAP, PLAYER_CLASS_MAP,
} from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { CPP_RECORD_COLUMNS, parseCppDecls } from '@/lib/catalog/ingest/cppDecls';
import { parseCppHandles } from '@/lib/catalog/ingest/cppHandles';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage, expandGlob, matchesGlob } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

/** Every path a brace pattern names (`a{b,c}.{h,cpp}` gives four). */
function expandBraces(pattern: string): string[] {
  const m = /\{([^}]*)\}/.exec(pattern);
  if (!m) return [pattern];
  const head = pattern.slice(0, m.index);
  const tail = pattern.slice(m.index + m[0].length);
  return m[1].split(',').flatMap((alt) => expandBraces(head + alt + tail));
}
const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/'));
const descoped = (path: string) => BOTW_DESCOPES.some((d) => matchesGlob(path, d.pattern));
const isWide = (glob: string) => /[*?]/.test(glob);

const DECLS = BOTW.tables.filter((t) => t.technique === 'cpp-decls');
const SCHEMA = BOTW.tables.filter((t) => t.map === DATA_SCHEMA_CLASS_MAP);
const SPECS = BOTW.tables.filter((t) => t.map === MANAGER_CLASS_MAP);
const NAMED = SPECS.filter((s) => !isWide(s.file));
const WIDE = SPECS.filter((s) => isWide(s.file));
/** The files a stem-named spec names, as path segments only. */
const OPEN = NAMED.flatMap((s) => expandBraces(s.file));
const NAMED_FOLDERS = [...new Set(OPEN.map(dirOf))].sort();
const WIDE_FOLDERS = WIDE.map((s) => dirOf(s.file));
/** A coined code file pair a folder glob reads (the folder has one home), and a coined stray in each stem-named folder. */
const WIDE_FILES = WIDE_FOLDERS.flatMap((f) => ['h', 'cpp'].map((e) => `${f}/coinedHeldMgr.${e}`));
const STRAYS = NAMED_FOLDERS.flatMap((f) => ['h', 'cpp'].map((e) => `${f}/coinedKeptProbe.${e}`));
const BUILD_FILES = [...new Set([...NAMED_FOLDERS, ...WIDE_FOLDERS])].map((f) => `${f}/CMakeLists.txt`);

const stemOf = (p: string) => p.replace(/\.(h|cpp)$/, '');
const STEMS = [...new Set([...OPEN, ...WIDE_FILES].map(stemOf))];
const specOf = (p: string) => SPECS.find((s) => matchesGlob(p, s.file))!;
const MARKER = '0x2B7E91C4';

/** A coined header per stem: a valued macro enumeration, a struct and a class (with a marker-shaped comment); a coined source defines the class. */
function textOf(path: string): string {
  const k = STEMS.indexOf(stemOf(path));
  return path.endsWith('.h') ? `
namespace brindle::yard${k} {
BRINDLE_LIST(Tallow${k}, Sorrelet = 0, Fennick = 1)
struct Pannier${k} {
    int mHoopCount;
};
class Cobwalk${k} {
public:
    void trundleOn();
private:
    // bramble_marker at offset ${MARKER}
    float mWhistleRate;
};
}` : `
namespace brindle::yard${k} {
void Cobwalk${k}::trundleOn() {}
}`;
}

const FILES: Record<string, string> = {
  ...Object.fromEntries([...OPEN, ...WIDE_FILES].map((p) => [p, textOf(p)])),
  ...Object.fromEntries(STRAYS.map((p) => [p, 'namespace brindle { class Gorsewick { int mDriftAmount; }; }'])),
  ...Object.fromEntries(BUILD_FILES.map((p) => [p, 'add_library(coined)'])),
};

describe('BOTW item-7b manager specs (W31)', () => {
  it('registers three cpp-decls specs after the 7a block and directly before the first generic node row, with no handle twin', () => {
    expect(SPECS).toHaveLength(3);
    const at = SPECS.map((s) => BOTW.tables.indexOf(s));
    expect(at).toEqual(at.map((_, i) => at[0] + i)); // one contiguous block
    expect(SCHEMA).toHaveLength(6);
    expect(at[0]).toBe(BOTW.tables.indexOf(SCHEMA[5]) + 1); // directly after the 7a block's last spec
    const firstRow = BOTW.tables.find((t) => t.map === BEHAVIOUR_NODE_ROW_MAP)!;
    expect(BOTW.tables.indexOf(firstRow)).toBe(at[2] + 1);
    // The NPC's AI decls spec still ends the cpp-decls block, its twin is still last of the table, and every handle spec follows the block.
    const lastDecl = DECLS.at(-1)!;
    expect(lastDecl.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(BOTW.tables.indexOf(lastDecl)).toBeGreaterThan(at[2]);
    expect(BOTW.tables.at(-1)).toMatchObject({ technique: 'cpp-handles', file: lastDecl.file, catalogId: lastDecl.catalogId });
    expect(BOTW.tables.findIndex((t) => t.technique === 'cpp-handles')).toBeGreaterThan(BOTW.tables.indexOf(lastDecl));
    expect(BOTW.tables.filter((t) => t.technique === 'cpp-handles' && SPECS.some((s) => s.file === t.file))).toEqual([]);
  });

  it('gives each spec its ruled real catalog, the manager map and the cpp-decls technique, and no spec uses another map', () => {
    expect(SPECS.map((s) => s.catalogId)).toEqual(['bestiary', 'achievements', 'save-points']);
    for (const s of SPECS) {
      expect(s).toMatchObject({ technique: 'cpp-decls', keyColumn: 'qualifiedName' });
      expect(s.map).toBe(MANAGER_CLASS_MAP);
      expect(getCatalogPipeline(s.catalogId)).not.toBeNull(); // a real catalog pipeline, never a module
      expect([PLAYER_CLASS_MAP, MOUNT_CLASS_MAP, CAMERA_SHOT_NODE_MAP, BEHAVIOUR_NODE_ROW_MAP, DATA_SCHEMA_CLASS_MAP]).not.toContain(s.map);
    }
    expect(NAMED).toHaveLength(2);
    expect(WIDE).toHaveLength(1);
  });

  it('reads exactly the named files and the single-home folder\'s code files: each spec its own, no file twice, no other spec in the place', () => {
    expect(NAMED.map((s) => expandBraces(s.file).length)).toEqual([2, 2]);
    expect(new Set(OPEN).size).toBe(4);
    const everything = Object.keys(FILES);
    for (const s of NAMED) expect(expandGlob(everything, s.file)).toEqual([...expandBraces(s.file)].sort());
    expect(expandGlob(everything, WIDE[0].file)).toEqual([...WIDE_FILES].sort()); // code files only, never the build file
    for (const f of [...OPEN, ...WIDE_FILES]) expect(BOTW.tables.filter((t) => matchesGlob(f, t.file))).toEqual([specOf(f)]);
    const all = SPECS.flatMap((s) => expandGlob(everything, s.file));
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps a folder-level file open when its spec is stem-named, reads it when the folder has one home, and never reads a build file', () => {
    expect(STRAYS).toHaveLength(NAMED_FOLDERS.length * 2);
    for (const p of STRAYS) {
      expect(descoped(p)).toBe(false);
      expect(OPEN).not.toContain(p);
      for (const s of SPECS) expect(matchesGlob(p, s.file)).toBe(false);
      expect(matchesGlob(p, `${dirOf(p)}/*.{h,cpp}`)).toBe(true); // a folder glob would have read it
    }
    // the folder glob is honest only because its folder has one home: a coined stray there IS read by its spec
    expect(matchesGlob(`${WIDE_FOLDERS[0]}/coinedKeptProbe.h`, WIDE[0].file)).toBe(true);
    expect(BUILD_FILES.length).toBeGreaterThan(0);
    for (const p of BUILD_FILES) {
      expect(descoped(p)).toBe(true);
      expect(BOTW.tables.some((t) => matchesGlob(p, t.file))).toBe(false);
    }
    const files = [...OPEN, ...WIDE_FILES, ...STRAYS, ...BUILD_FILES];
    const cov = computePathCoverage(files, BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    expect(cov).toMatchObject({ total: files.length, covered: 4 + WIDE_FILES.length, descoped: BUILD_FILES.length, open: STRAYS.length });
    expect(cov.openFiles).toEqual([...STRAYS].sort());
  });

  it('classifies every reader column with a catalog-neutral manager map: bases dropped, methods and fields gaps', () => {
    const audit = auditColumns([...CPP_RECORD_COLUMNS], MANAGER_CLASS_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
    expect(audit).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'outer'],
      dropped: ['file', 'line', 'templateParams', 'bases'],
      gap: [{ column: 'methods' }, { column: 'fields' }],
    });
    const catalogs = [...new Set(SPECS.map((s) => s.catalogId)), 'state-graph', 'cutscenes', 'props', 'music', 'zone-map', 'quests'];
    for (const g of audit.gap) {
      expect(g.why.length).toBeGreaterThan(40);
      expect(g.why).not.toMatch(/lifecycle|per-frame|hook|tick rule|selector|stub|shell/i); // a node-map reason is wrong for a manager
      for (const id of catalogs) expect(g.why).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
    // The drop is true of the coined records too: no class or struct of the fixture names a base.
    for (const p of [...OPEN, ...WIDE_FILES]) for (const r of parseCppDecls(FILES[p], { file: p }).rows) expect(r.bases).toBe('');
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

    it('wraps the places with 0 unclassified columns, no handle record and no id held twice; the valued enumeration is an enum record with names only; a second ingest moves nothing', () => {
      // A coined header really carries a handle-shaped marker, so "no handle twin" is shown, not assumed.
      const header = OPEN.find((p) => p.endsWith('.h'))!;
      expect(parseCppHandles(FILES[header], { file: header }).rows).toHaveLength(1);

      const first = ingestSourceFromDir('botw', 'clone', deps());
      // nothing stray, build or foreign was read by a 7b spec (the stem-named strays are read by no spec at all)
      const read7b = [...new Set(reads)].filter((p) => SPECS.some((s) => matchesGlob(p, s.file))).sort();
      expect(read7b).toEqual([...OPEN, ...WIDE_FILES].sort());
      for (const p of [...STRAYS, ...BUILD_FILES]) expect(reads).not.toContain(p);
      // every stem with a header and a source gives enumeration + struct + class + definition = 4 rows.
      SPECS.forEach((s) => {
        const summary = first.tables.find((t) => t.file === s.file)!;
        expect(summary).toMatchObject({ catalogId: s.catalogId, status: 'ingested', unclassified: [], declaredButAbsent: [], duplicateKeys: 0, malformed: 0 });
      });
      const wrappers = listWrappers(db, { sourceId: 'botw' });
      expect(new Set(wrappers.map((w) => w.entity.id)).size).toBe(wrappers.length);
      expect(wrappers.every((w) => w.technique === 'cpp-decls@4')).toBe(true); // no cpp-handles record anywhere
      expect([...new Set(wrappers.map((w) => w.raw.kind))].sort()).toEqual(['class', 'definition', 'enum', 'struct']);
      expect(new Set(wrappers.map((w) => w.mappingVersion)).size).toBe(1); // one new stamp for the whole wave

      // The valued macro enumeration of every coined header arrives as an enum record: the NAMES, never a value.
      const enums = wrappers.filter((w) => w.raw.kind === 'enum');
      expect(enums).toHaveLength(3);
      for (const w of enums) {
        expect(w.raw.fields).toBe('Sorrelet;Fennick');
        expect(JSON.stringify([w.raw, w.entity])).not.toMatch(/Sorrelet\s*=|Fennick\s*=|=\s*[01]\b/);
        expect(w.technique).toBe('cpp-decls@4');
      }
      const byCatalog = (id: string) => listWrappers(db, { sourceId: 'botw', catalogId: id }).length;
      expect(byCatalog('bestiary')).toBe(4);
      expect(byCatalog('achievements')).toBe(4);
      expect(byCatalog('save-points')).toBe(4);

      // Byte-identical to a cpp-decls-only read of the same text.
      for (const p of [...OPEN, ...WIDE_FILES]) {
        const stored = wrappers.filter((w) => w.file === p).map((w) => w.raw).sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
        const direct = parseCppDecls(FILES[p], { file: p }).rows.sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
        expect(stored).toEqual(direct);
      }

      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: first.store.created });
    });
  });
});
