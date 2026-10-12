// W30: the BOTW files item 7 kept open — six data-schema specs under ONE catalog-neutral map. The folders they sit in also hold
// descoped engine files, so each glob names exactly its place's open files (a folder glob would count the descoped ones as
// covered, vault Z-D119 (c)). Every path below is derived at run time from the registered specs and the descope patterns —
// no file name is written out — and every line of C++ and every name in it was coined for this test.
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import {
  BEHAVIOUR_NODE_ROW_MAP, BOTW_DESCOPES, CAMERA_SHOT_NODE_MAP, DATA_SCHEMA_CLASS_MAP, MOUNT_CLASS_MAP, PLAYER_CLASS_MAP,
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

const DECLS = BOTW.tables.filter((t) => t.technique === 'cpp-decls');
const SPECS = BOTW.tables.filter((t) => t.map === DATA_SCHEMA_CLASS_MAP);
/** The open files of the place: a 7a glob names them, and nothing else, as path segments. */
const OPEN = SPECS.flatMap((s) => expandBraces(s.file));
const FOLDERS = [...new Set(OPEN.map(dirOf))].sort();
/** Every concrete file a descope names in those folders (no wildcard): the engine files beside the open ones. */
const DESCOPE_PROBES = BOTW_DESCOPES
  .filter((d) => !/[*?]/.test(d.pattern))
  .flatMap((d) => expandBraces(d.pattern))
  .filter((p) => FOLDERS.includes(dirOf(p)));
/** One coined file per folder, neither open nor descoped. */
const STRAYS = FOLDERS.flatMap((f) => ['h', 'cpp'].map((e) => `${f}/coinedKeptProbe.${e}`));

const stemOf = (p: string) => p.replace(/\.(h|cpp)$/, '');
const STEMS = [...new Set(OPEN.map(stemOf))];
const specOf = (p: string) => SPECS.find((s) => matchesGlob(p, s.file))!;
const MARKER = '0x6d3f1b8e';

/** A coined header per stem: an enumeration, a struct and a class (with a marker-shaped comment); a coined source defines the class. */
function textOf(path: string): string {
  const k = STEMS.indexOf(stemOf(path));
  const header = path.endsWith('.h');
  if (specOf(path).catalogId === 'hud-elements') {
    return header ? `namespace vorquin::plot${k} { int ponderTally${k}(const char* name); }` : '// declarations only\n';
  }
  return header ? `
namespace vorquin::plot${k} {
enum class Hushwick${k} { Murk, Glim };
struct Marrowfen${k} {
    int mPebbleCount;
};
class Larkmoor${k} {
public:
    void ponderStep();
private:
    // murk_marker at offset ${MARKER}
    float mTwirlRate;
};
}` : `
namespace vorquin::plot${k} {
void Larkmoor${k}::ponderStep() {}
}`;
}

const FILES: Record<string, string> = {
  ...Object.fromEntries(OPEN.map((p) => [p, textOf(p)])),
  ...Object.fromEntries(STRAYS.map((p) => [p, 'namespace vorquin { class Wispmark { int mDriftAmount; }; }'])),
  ...Object.fromEntries(DESCOPE_PROBES.map((p) => [p, 'namespace vorquin { class Wispdetour { int mDriftAmount; }; }'])),
};

describe('BOTW item-7 data-schema specs (W30)', () => {
  it('registers six cpp-decls specs directly after the camera pair and directly before the first generic node row, with no handle twin', () => {
    expect(SPECS).toHaveLength(6);
    const at = SPECS.map((s) => BOTW.tables.indexOf(s));
    expect(at).toEqual(at.map((_, i) => at[0] + i)); // one contiguous block
    const camera = DECLS.filter((t) => t.map === CAMERA_SHOT_NODE_MAP);
    expect(camera).toHaveLength(2);
    expect(at[0]).toBe(BOTW.tables.indexOf(camera[1]) + 1);
    const firstRow = BOTW.tables.find((t) => t.map === BEHAVIOUR_NODE_ROW_MAP)!;
    expect(BOTW.tables.indexOf(firstRow)).toBe(at[5] + 1);
    // The NPC's AI decls spec still ends the cpp-decls block, its twin is still last of the table, and every handle spec follows the block.
    const lastDecl = DECLS.at(-1)!;
    expect(lastDecl.map).toBe(BEHAVIOUR_NODE_ROW_MAP);
    expect(BOTW.tables.indexOf(lastDecl)).toBeGreaterThan(at[5]);
    expect(BOTW.tables.at(-1)).toMatchObject({ technique: 'cpp-handles', file: lastDecl.file, catalogId: lastDecl.catalogId });
    expect(BOTW.tables.findIndex((t) => t.technique === 'cpp-handles')).toBeGreaterThan(BOTW.tables.indexOf(lastDecl));
    expect(BOTW.tables.filter((t) => t.technique === 'cpp-handles' && SPECS.some((s) => s.file === t.file))).toEqual([]);
  });

  it('gives each spec its ruled real catalog, the new map and the cpp-decls technique, and no spec uses a node map', () => {
    expect(SPECS.map((s) => s.catalogId)).toEqual(['props', 'props', 'music', 'zone-map', 'hud-elements', 'items']);
    for (const s of SPECS) {
      expect(s).toMatchObject({ technique: 'cpp-decls', keyColumn: 'qualifiedName' });
      expect(s.map).toBe(DATA_SCHEMA_CLASS_MAP);
      expect(getCatalogPipeline(s.catalogId)).not.toBeNull(); // a real catalog pipeline, never a module
      expect([PLAYER_CLASS_MAP, MOUNT_CLASS_MAP, CAMERA_SHOT_NODE_MAP, BEHAVIOUR_NODE_ROW_MAP]).not.toContain(s.map);
    }
  });

  it('reads exactly the 24 open files: each spec its own, no file twice, no other spec in the place', () => {
    expect(SPECS.map((s) => expandBraces(s.file).length)).toEqual([12, 2, 4, 2, 2, 2]);
    expect(OPEN).toHaveLength(24);
    expect(new Set(OPEN).size).toBe(24);
    expect(FOLDERS).toHaveLength(4);
    const everything = Object.keys(FILES);
    for (const s of SPECS) expect(expandGlob(everything, s.file)).toEqual([...expandBraces(s.file)].sort());
    for (const f of OPEN) expect(BOTW.tables.filter((t) => matchesGlob(f, t.file))).toEqual([specOf(f)]);
  });

  it('never reads a descoped file: no glob reaches one, a folder-wide glob would, and coverage keeps them descoped', () => {
    expect(DESCOPE_PROBES.length).toBeGreaterThan(OPEN.length); // the instrument can fail: the folders hold more descoped files than open ones
    for (const p of DESCOPE_PROBES) {
      expect(descoped(p)).toBe(true);
      expect(OPEN).not.toContain(p);
      for (const s of SPECS) expect(matchesGlob(p, s.file)).toBe(false);
      expect(BOTW.tables.some((t) => matchesGlob(p, t.file))).toBe(false);
    }
    for (const folder of FOLDERS) {
      const wide = `${folder}/*.{h,cpp}`;
      expect(DESCOPE_PROBES.some((p) => dirOf(p) === folder && matchesGlob(p, wide))).toBe(true);
      expect(OPEN.some((p) => dirOf(p) === folder && matchesGlob(p, wide))).toBe(true);
    }
    const cov = computePathCoverage([...OPEN, ...DESCOPE_PROBES], BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    expect(cov).toMatchObject({ total: OPEN.length + DESCOPE_PROBES.length, covered: 24, descoped: DESCOPE_PROBES.length, open: 0 });
  });

  it('leaves a folder-level file that is neither open nor descoped open, read by no spec of the place', () => {
    expect(STRAYS).toHaveLength(8);
    for (const p of STRAYS) {
      expect(descoped(p)).toBe(false);
      expect(OPEN).not.toContain(p);
      for (const s of SPECS) expect(matchesGlob(p, s.file)).toBe(false);
      expect(matchesGlob(p, `${dirOf(p)}/*.{h,cpp}`)).toBe(true); // a folder glob would have read it
    }
    const cov = computePathCoverage([...OPEN, ...STRAYS], BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    expect(cov).toMatchObject({ total: 32, covered: 24, descoped: 0, open: 8 });
    expect(cov.openFiles).toEqual([...STRAYS].sort());
  });

  it('classifies every reader column with a catalog-neutral data-schema map: bases, methods and fields stay gaps', () => {
    const audit = auditColumns([...CPP_RECORD_COLUMNS], DATA_SCHEMA_CLASS_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
    expect(audit).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'outer'],
      dropped: ['file', 'line', 'templateParams'],
      gap: [{ column: 'bases' }, { column: 'methods' }, { column: 'fields' }],
    });
    const catalogs = [...new Set(SPECS.map((s) => s.catalogId)), 'state-graph', 'cutscenes', 'bestiary', 'materials'];
    for (const g of audit.gap) {
      expect(g.why.length).toBeGreaterThan(40);
      expect(g.why).not.toMatch(/lifecycle|per-frame|hook|tick rule|selector|stub|shell/i); // a node-map reason is wrong for a data schema
      for (const id of catalogs) expect(g.why).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
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

    it('wraps the places with 0 unclassified columns, no handle record and no id held twice; the records are what a cpp-decls read gives; a second ingest moves nothing', () => {
      // A coined header really carries a handle-shaped marker, so "no handle twin" is shown, not assumed.
      const header = OPEN.find((p) => p.endsWith('.h') && specOf(p).catalogId !== 'hud-elements')!;
      expect(parseCppHandles(FILES[header], { file: header }).rows).toHaveLength(1);

      const first = ingestSourceFromDir('botw', 'clone', deps());
      expect([...new Set(reads)].sort()).toEqual([...OPEN].sort()); // nothing descoped, stray or foreign was read
      // 11 stems with records (enumeration + struct + class + definition = 4 each); the HUD stem declares a free function only.
      const rowsOf = [24, 4, 8, 4, 0, 4];
      SPECS.forEach((s, i) => {
        expect(first.tables.find((t) => t.file === s.file)).toMatchObject({
          catalogId: s.catalogId, status: 'ingested', rows: rowsOf[i], unclassified: [], declaredButAbsent: [],
          duplicateKeys: 0, malformed: 0, files: { matched: expandBraces(s.file).length, withoutRecords: i === 4 ? 2 : 0, refused: [] },
        });
      });
      expect(first.store).toEqual({ created: 44, rawChanged: 0, reprojected: 0, unchanged: 0 });

      const all = listWrappers(db, { sourceId: 'botw' });
      expect(new Set(all.map((w) => w.entity.id)).size).toBe(all.length);
      expect(all.every((w) => w.technique === 'cpp-decls@4')).toBe(true); // no cpp-handles record anywhere
      expect([...new Set(all.map((w) => w.raw.kind))].sort()).toEqual(['class', 'definition', 'enum', 'struct']);
      expect(new Set(all.map((w) => w.mappingVersion)).size).toBe(1); // one new stamp for the whole wave
      const byCatalog = (id: string) => listWrappers(db, { sourceId: 'botw', catalogId: id }).length;
      expect([byCatalog('props'), byCatalog('music'), byCatalog('zone-map'), byCatalog('items'), byCatalog('hud-elements')]).toEqual([28, 8, 4, 4, 0]);

      // Byte-identical to a cpp-decls-only read of the same text.
      for (const p of OPEN) {
        const stored = all.filter((w) => w.file === p).map((w) => w.raw).sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
        const direct = parseCppDecls(FILES[p], { file: p }).rows.sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
        expect(stored).toEqual(direct);
      }

      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 44 });
    });
  });
});
