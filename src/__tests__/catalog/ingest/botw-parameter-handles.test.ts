// W11: the parameter-handle records (vault Decisions Z-D46 – Z-D48). A SECOND technique, cpp-handles, reads the node
// areas' globs again — one spec per handle-bearing glob, each beside its cpp-decls twin, all under one catalog-neutral
// map — so no new file is covered and every cpp-decls record stays exactly what it was. Every path below is derived
// from the registered specs; every line of C++ and every name in it was coined for these tests (cppHandlesFixture.ts).
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import {
  BEHAVIOUR_NODE_ROW_MAP, BOTW_DESCOPES, CAMERA_SHOT_NODE_MAP, MOUNT_CLASS_MAP, PARAMETER_HANDLE_MAP, PLAYER_CLASS_MAP,
} from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { parseCppDecls } from '@/lib/catalog/ingest/cppDecls';
import { CPP_HANDLE_COLUMNS, parseCppHandles } from '@/lib/catalog/ingest/cppHandles';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage } from '@/lib/catalog/reference/pathCoverage';
import { BOTW, REFERENCE_SOURCES } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import { LANTERNWICK_CPP, LANTERNWICK_H, QUILLMOOR_H } from './cppHandlesFixture';

const HANDLE_SPECS = BOTW.tables.filter((t) => t.technique === 'cpp-handles');
const DECL_SPECS = BOTW.tables.filter((t) => t.technique === 'cpp-decls');
const twinOf = (file: string) => DECL_SPECS.find((t) => t.file === file);
const PLAYER = DECL_SPECS.find((t) => t.map === PLAYER_CLASS_MAP)!;
const AREA = PLAYER.file.slice(0, PLAYER.file.indexOf('/**'));
const FILES: Record<string, string> = {
  [`${AREA}/Glade/lanternwick.h`]: LANTERNWICK_H,
  [`${AREA}/Glade/lanternwick.cpp`]: LANTERNWICK_CPP,
  [`${AREA}/Glade/quillmoor.h`]: QUILLMOOR_H,
};
const [H, CPP, EMPTY_H] = Object.keys(FILES);

describe('BOTW parameter-handle specs (W11)', () => {
  it('appends one cpp-handles spec per handle-bearing glob after the cpp-decls specs, each beside its twin and in its catalog', () => {
    expect(DECL_SPECS).toHaveLength(37);
    expect(HANDLE_SPECS).toHaveLength(25);
    expect(BOTW.tables.slice(DECL_SPECS.length)).toEqual(HANDLE_SPECS);
    const twins = HANDLE_SPECS.map((s) => twinOf(s.file));
    for (const [i, spec] of HANDLE_SPECS.entries()) {
      expect(spec).toMatchObject({ technique: 'cpp-handles', keyColumn: 'qualifiedName', catalogId: twins[i]!.catalogId });
      expect(spec.map).toBe(PARAMETER_HANDLE_MAP);
    }
    // The twins are the player, mount and camera-action specs and the ten generic rows, the two folders, the nine AI rows and the NPC's AI folder, in registration order.
    expect(new Set(twins).size).toBe(25);
    expect(twins.map((t) => DECL_SPECS.indexOf(t!))).toEqual([...twins.map((t) => DECL_SPECS.indexOf(t!))].sort((a, b) => a - b));
    expect(twins.map((t) => t!.map)).toEqual([PLAYER_CLASS_MAP, MOUNT_CLASS_MAP, CAMERA_SHOT_NODE_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP, BEHAVIOUR_NODE_ROW_MAP]);
    // Of the two camera specs only the action half declares handles; the selector half declares none.
    expect(DECL_SPECS.filter((t) => t.map === CAMERA_SHOT_NODE_MAP)).toHaveLength(2);
  });

  it('covers no new file: coverage is the same with or without the handle specs', () => {
    const probe = [...DECL_SPECS.map((t) => t.file.replace('**/*', 'Probe/probe').replace(/\{([^,}]*)[^}]*\}/g, '$1').replace('*', 'Probe')), 'src/Elsewhere/open.h'];
    const all = computePathCoverage(probe, BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    const declsOnly = computePathCoverage(probe, DECL_SPECS.map((t) => t.file), BOTW_DESCOPES);
    expect(all.covered).toBeGreaterThan(5); // the instrument can fail: the probes really are spec files
    expect({ ...all, specs: [] }).toEqual({ ...declsOnly, specs: [] });
  });

  it('classifies every handle column with one catalog-neutral map', () => {
    const audit = auditColumns([...CPP_HANDLE_COLUMNS], PARAMETER_HANDLE_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
    expect(audit).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'owner'],
      dropped: ['file', 'line'],
      gap: [{ column: 'marker' }, { column: 'declaredType' }, { column: 'typeKind' }],
      coverage: 0.5,
    });
    const catalogs = new Set(Object.values(REFERENCE_SOURCES).flatMap((s) => s.tables.map((t) => t.catalogId)));
    expect(catalogs.size).toBeGreaterThan(5);
    for (const { why } of audit.gap) for (const id of catalogs) expect(why).not.toContain(id);
  });

  describe('over a synthetic tree', () => {
    let db: Database.Database;
    beforeEach(() => { db = new Database(':memory:'); });
    const deps = () => ({
      db,
      readFile: (p: string) => FILES[p.replace(/\\/g, '/').replace(/^clone\//, '')],
      listFiles: () => Object.keys(FILES),
    });

    it('wraps the handles beside byte-identical cpp-decls records under distinct ids, and a second ingest moves nothing', () => {
      const first = ingestSourceFromDir('botw', 'clone', deps());
      const decls = first.tables[DECL_SPECS.indexOf(PLAYER)];
      const handles = first.tables[BOTW.tables.indexOf(HANDLE_SPECS[0])];
      expect(decls).toMatchObject({ catalogId: 'player-movement', status: 'ingested', rows: 5, duplicateKeys: 0, malformed: 0 });
      expect(handles).toMatchObject({
        file: PLAYER.file, catalogId: 'player-movement', status: 'ingested', rows: 11, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 3, withoutRecords: 2, refused: [] },
      });
      expect(first.store).toEqual({ created: 16, rawChanged: 0, reprojected: 0, unchanged: 0 });

      const rows = listWrappers(db, { sourceId: 'botw' });
      expect(new Set(rows.map((w) => w.entity.id)).size).toBe(16);
      const declRows = rows.filter((w) => w.raw.kind !== 'handle');
      // The cpp-decls records in the store are exactly what the reader returns on its own.
      const expected = [H, CPP, EMPTY_H].flatMap((f) => parseCppDecls(FILES[f], { file: f }).rows);
      expect(declRows.map((w) => w.raw).sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName)))
        .toEqual(expected.sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName)));
      expect(declRows.every((w) => w.technique === 'cpp-decls@4')).toBe(true);

      const handleRows = rows.filter((w) => w.raw.kind === 'handle');
      expect(handleRows.map((w) => w.raw)).toEqual(expect.arrayContaining(parseCppHandles(LANTERNWICK_H, { file: H }).rows));
      expect(handleRows.every((w) => w.technique === 'cpp-handles@1' && w.catalogId === 'player-movement')).toBe(true);
      const sigil = handleRows.find((w) => w.raw.name === 'mSigil_k')!;
      expect(sigil.entity.id).toBe(`botw-glade::nodes::Lanternwick::mSigil_k::(handle@${H})`);
      // Mapped columns land; the three gaps (scope word, declared type, type kind) stay in the raw only.
      expect(sigil.entity.data).toEqual({
        declKind: 'handle', qualifiedName: `glade::nodes::Lanternwick::mSigil_k::(handle@${H})`, namespace: 'glade::nodes', owner: 'Lanternwick',
      });
      expect(sigil.raw).toMatchObject({ marker: 'knob_percall_alt', declaredType: 'const char*', typeKind: 'character' });

      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 16 });
    });
  });
});
