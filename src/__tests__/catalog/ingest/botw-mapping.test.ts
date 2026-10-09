// The BOTW source carries STRUCTURE only: a pin, path globs, and PoF's classification of the
// cpp-decls reader's columns. These tests pin that contract and run the registered spec over a
// synthetic tree shaped like the reference's layout (paths only — every line of C++ below was
// written for this test).
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { BOTW_DESCOPES, BOTW_PIN, BOTW_TREE, PLAYER_CLASS_MAP } from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { CPP_RECORD_COLUMNS } from '@/lib/catalog/ingest/cppDecls';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { BOTW, DIABLO1, getReferenceSource } from '@/lib/catalog/reference/sources';
import { computePathCoverage } from '@/lib/catalog/reference/pathCoverage';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

describe('BOTW source contract', () => {
  it('is registered, pinned to a full commit, and prefixes its ids apart from Diablo', () => {
    expect(getReferenceSource('botw')).toBe(BOTW);
    expect(BOTW.pin).toBe(BOTW_PIN);
    expect(BOTW_PIN).toMatch(/^[0-9a-f]{40}$/);
    expect(BOTW.obtain).toContain(BOTW_PIN);
    expect(BOTW.idPrefix).not.toBe(DIABLO1.idPrefix);
    expect(BOTW.licenceNote).toMatch(/reference-only/i);
  });

  it('reads only source-code specs inside the in-scope tree, and classifies every reader column', () => {
    expect(BOTW.tables.length).toBeGreaterThan(0);
    for (const spec of BOTW.tables) {
      expect(spec.file.startsWith(`${BOTW_TREE}/`)).toBe(true);
      expect(spec.technique).toBe('cpp-decls');
      expect(spec.keyColumn).toBe('qualifiedName');
      const audit = auditColumns([...CPP_RECORD_COLUMNS], spec.map);
      expect(audit.unclassified).toEqual([]);
      expect(audit.declaredButAbsent).toEqual([]);
    }
    expect(auditColumns([...CPP_RECORD_COLUMNS], PLAYER_CLASS_MAP)).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'outer'],
      dropped: ['file', 'line', 'templateParams'],
      gap: [{ column: 'bases' }, { column: 'methods' }, { column: 'fields' }],
    });
  });

  it('descopes only inside the tree, each with a reason, and never a mapped area', () => {
    for (const d of BOTW_DESCOPES) {
      expect(d.pattern.startsWith(`${BOTW_TREE}/`)).toBe(true);
      expect(d.reason.length).toBeGreaterThan(15);
    }
    const fake = ['src/Game/Actor/Player/a.h', 'src/Game/Actor/Player/a.cpp', 'src/Game/Actor/Player/CMakeLists.txt'];
    const cov = computePathCoverage(fake, BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    expect(cov).toMatchObject({ covered: 2, descoped: 1, open: 0 });
  });
});

describe('BOTW Player spec over a synthetic tree', () => {
  const FILES: Record<string, string> = {
    'src/Game/Actor/Player/demoRunner.h': `
namespace sample::act {
class Runner : public NodeBase {
public:
    void start();
    bool isDone() const;
private:
    float mTicksLeft = 0;
};
}`,
    'src/Game/Actor/Player/demoRunner.cpp': 'namespace sample::act { void Runner::start() {} bool Runner::isDone() const { return true; } }',
    'src/Game/Actor/Player/Moves/demoLeap.h': 'namespace sample::act { struct Leap : NodeBase { int mApex; }; }',
    'src/Game/Actor/Player/CMakeLists.txt': '# synthetic build file',
    'src/Game/Actor/Enemy/demoOther.h': 'class NotPlayer {};',
  };
  let db: Database.Database;
  beforeEach(() => { db = new Database(':memory:'); });
  const deps = () => ({
    db,
    readFile: (p: string) => FILES[p.replace(/\\/g, '/').replace(/^clone\//, '')],
    listFiles: () => Object.keys(FILES),
  });

  it('wraps the Player area into player-movement and is idempotent on re-ingest', () => {
    const first = ingestSourceFromDir('botw', 'clone', deps());
    expect(first.tables[0]).toMatchObject({
      catalogId: 'player-movement', status: 'ingested', rows: 2, unclassified: [],
      files: { matched: 3, withoutRecords: 1, refused: [] },
    });
    expect(first.store).toEqual({ created: 2, rawChanged: 0, reprojected: 0, unchanged: 0 });
    const ids = listWrappers(db, { sourceId: 'botw' }).map((w) => w.entity.id);
    expect(ids).toEqual(['botw-sample::act::Leap', 'botw-sample::act::Runner']);

    const second = ingestSourceFromDir('botw', 'clone', deps());
    expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 2 });
  });
});
