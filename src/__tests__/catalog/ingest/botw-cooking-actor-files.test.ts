// W06: the BOTW cooking spec and per-object parameter-file spec. Each glob must read its area's code
// files and nothing else (not the descoped build file, not the parameter-group library beside the
// file area, not a top-level Resource file, and not a sibling folder whose name merely STARTS with the
// area's name), each class map must classify every reader column, and a second ingest must move
// nothing. The tree below copies only the reference's PATHS; every line of C++ in it was written for
// this test, and every name in it was coined for it.
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { ACTOR_FILE_CLASS_MAP, BOTW_DESCOPES, COOKING_CLASS_MAP } from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { CPP_RECORD_COLUMNS } from '@/lib/catalog/ingest/cppDecls';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage, expandGlob } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const KITCHEN = 'src/Game/Cooking';
const FILES_AREA = 'src/KingSystem/Resource/Actor';

const FILES: Record<string, string> = {
  // The kitchen: a dish record, a pot with a nested option record, a closed list of flavours.
  [`${KITCHEN}/demoStewPot.h`]: `
namespace demo::kitchen {
enum class Flavour { Bland, Zesty, Smoky };
struct Bowl {
    void wipe();
    int mPortion{};
    Flavour mFlavour = Flavour::Bland;
};
class StewPot {
public:
    struct Stirring {
        bool mGentle = false;
    };
    bool simmer(const Bowl& base, Bowl& out);
    void wipe();
private:
    float mSaltiness = 1.0f;
};
}`,
  // Its source: a helper record, and the bodies of two owners — one of them real logic.
  [`${KITCHEN}/demoStewPot.cpp`]: `
#include "demoStewPot.h"
namespace demo::kitchen {
struct Ladle {
    int mScoops;
};
void Bowl::wipe() { mPortion = 0; }
bool StewPot::simmer(const Bowl& base, Bowl& out) {
    if (base.mPortion > 0) {
        out = base;
        return true;
    }
    return false;
}
void StewPot::wipe() {}
}`,
  // The file area: a satchel file with an enumeration written as one macro call, a nested slot record,
  // and an owner defined out of line in its header AND its source (two definition records, two ids).
  [`${FILES_AREA}/resDemoSatchel.h`]: `
namespace demo::files {
class SatchelFile : public KnobFile {
public:
    DEMO_ROSTER(Pocket, Left, Right, Inner)
    struct Nook {
        int mHeld;
    };
    bool readFrom(const char* text);
    template <typename T>
    bool glimpse(const T* where) const;
private:
    Nook mNook;
};
template <typename T>
inline bool SatchelFile::glimpse(const T* where) const {
    return where != nullptr;
}
}`,
  [`${FILES_AREA}/resDemoSatchel.cpp`]: `
#include "resDemoSatchel.h"
namespace demo::files {
bool SatchelFile::readFrom(const char* text) { return text != nullptr; }
}`,
  // A kind hierarchy: one base test and one kind of it.
  [`${FILES_AREA}/resDemoGate.h`]: `
namespace demo::files {
class GateTest {
public:
    virtual bool admits();
};
class GateTestNear : public GateTest {
public:
    bool admits() override;
private:
    float mReach;
};
}`,
  [`${FILES_AREA}/resDemoGate.cpp`]: `
#include "resDemoGate.h"
namespace demo::files {
bool GateTest::admits() { return true; }
}`,
  // The kitchen's build file: descoped, so the spec may not read it.
  [`${KITCHEN}/CMakeLists.txt`]: 'wireDemoFolder(demoStewPot.cpp)\n',
  // Siblings whose names merely start like an area stay open.
  'src/Game/CookingDraft/demoDraftPot.h': 'namespace demo { class DraftPot { int mDrafted; }; }',
  'src/KingSystem/Resource/ActorDraft/resDemoDraftFile.h': 'namespace demo { class DraftFile { int mSketched; }; }',
  // The parameter-group library beside the file area belongs to the items spec, not to this one.
  'src/KingSystem/Resource/GeneralParamList/resDemoKnobGroup.h': 'namespace demo { class KnobGroup { float mTwist; }; }',
  // A top-level Resource file: descoped.
  'src/KingSystem/Resource/resDemoLoader.h': 'namespace demo { class Loader { int mBudgetBytes; }; }',
};

const under = (area: string) => Object.keys(FILES)
  .filter((f) => f.startsWith(`${area}/`) && !f.endsWith('CMakeLists.txt')).sort();
const specFor = (area: string) => BOTW.tables.find((t) => t.file.startsWith(`${area}/`));

describe('BOTW cooking and per-object parameter-file specs (W06)', () => {
  it('registers one spec per area, wrap-only: cooking under crafting-recipes, the file area under props', () => {
    expect(BOTW.tables).toHaveLength(16);
    expect(specFor(KITCHEN)).toMatchObject({ file: `${KITCHEN}/**/*.{h,cpp}`, catalogId: 'crafting-recipes', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(specFor(KITCHEN)!.map).toBe(COOKING_CLASS_MAP);
    expect(specFor(FILES_AREA)).toMatchObject({ file: `${FILES_AREA}/**/*.{h,cpp}`, catalogId: 'props', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
    expect(specFor(FILES_AREA)!.map).toBe(ACTOR_FILE_CLASS_MAP);
  });

  it('each glob reads its area\'s code files and nothing else', () => {
    expect(under(KITCHEN)).toHaveLength(2);
    expect(under(FILES_AREA)).toHaveLength(4);
    expect(expandGlob(Object.keys(FILES), specFor(KITCHEN)!.file)).toEqual(under(KITCHEN));
    expect(expandGlob(Object.keys(FILES), specFor(FILES_AREA)!.file)).toEqual(under(FILES_AREA));
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 2 kitchen + 4 file-area files + the parameter-group file covered; the build file and the top-level
    // Resource file descoped; the two look-alike siblings open.
    expect(cov).toMatchObject({ total: 11, covered: 7, descoped: 2, open: 2 });
    expect(cov.openFiles).toEqual([
      'src/Game/CookingDraft/demoDraftPot.h',
      'src/KingSystem/Resource/ActorDraft/resDemoDraftFile.h',
    ]);
    expect(cov.specs.find((s) => s.pattern === specFor(KITCHEN)!.file)?.files).toBe(2);
    expect(cov.specs.find((s) => s.pattern === specFor(FILES_AREA)!.file)?.files).toBe(4);
  });

  it('classifies every reader column of the cooking map: bases dropped (empty), methods and fields gaps', () => {
    const audit = auditColumns([...CPP_RECORD_COLUMNS], COOKING_CLASS_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
    expect(audit).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'outer'],
      dropped: ['file', 'line', 'templateParams', 'bases'],
      gap: [{ column: 'methods' }, { column: 'fields' }],
    });
  });

  it('classifies every reader column of the parameter-file map: bases, methods and fields gaps', () => {
    const audit = auditColumns([...CPP_RECORD_COLUMNS], ACTOR_FILE_CLASS_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
    expect(audit).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'outer'],
      dropped: ['file', 'line', 'templateParams'],
      gap: [{ column: 'bases' }, { column: 'methods' }, { column: 'fields' }],
    });
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

    it('wraps both areas with 0 unclassified columns and no id held twice, and a second ingest moves nothing', () => {
      const first = ingestSourceFromDir('botw', 'clone', deps());
      expect([...new Set(reads)].sort()).toEqual([
        ...under(KITCHEN), ...under(FILES_AREA), 'src/KingSystem/Resource/GeneralParamList/resDemoKnobGroup.h',
      ].sort());
      expect(first.tables.find((t) => t.file === specFor(KITCHEN)!.file)).toMatchObject({
        catalogId: 'crafting-recipes', status: 'ingested', rows: 7, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 2, withoutRecords: 0, refused: [] },
      });
      expect(first.tables.find((t) => t.file === specFor(FILES_AREA)!.file)).toMatchObject({
        catalogId: 'props', status: 'ingested', rows: 8, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 4, withoutRecords: 0, refused: [] },
      });
      expect(first.store).toEqual({ created: 16, rawChanged: 0, reprojected: 0, unchanged: 0 });

      const kitchen = listWrappers(db, { sourceId: 'botw', catalogId: 'crafting-recipes' });
      expect(kitchen.map((w) => w.entity.id).sort()).toEqual([
        'botw-demo::kitchen::Bowl',
        'botw-demo::kitchen::Bowl::(definitions@src/Game/Cooking/demoStewPot.cpp)',
        'botw-demo::kitchen::Flavour',
        'botw-demo::kitchen::Ladle',
        'botw-demo::kitchen::StewPot',
        'botw-demo::kitchen::StewPot::(definitions@src/Game/Cooking/demoStewPot.cpp)',
        'botw-demo::kitchen::StewPot::Stirring',
      ]);
      const dish = (id: string) => kitchen.find((w) => w.entity.id === id)?.raw;
      expect(dish('botw-demo::kitchen::StewPot')).toMatchObject({ kind: 'class', bases: '', methods: 'simmer;wipe', fields: 'mSaltiness' });
      expect(dish('botw-demo::kitchen::Flavour')).toMatchObject({ kind: 'enum', fields: 'Bland;Zesty;Smoky' });
      expect(kitchen.every((w) => w.raw.bases === '')).toBe(true);

      const files = listWrappers(db, { sourceId: 'botw', catalogId: 'props' });
      expect(files.map((w) => w.entity.id).sort()).toEqual([
        'botw-demo::files::GateTest',
        'botw-demo::files::GateTest::(definitions@src/KingSystem/Resource/Actor/resDemoGate.cpp)',
        'botw-demo::files::GateTestNear',
        'botw-demo::files::SatchelFile',
        'botw-demo::files::SatchelFile::(definitions@src/KingSystem/Resource/Actor/resDemoSatchel.cpp)',
        'botw-demo::files::SatchelFile::(definitions@src/KingSystem/Resource/Actor/resDemoSatchel.h)',
        'botw-demo::files::SatchelFile::Nook',
        'botw-demo::files::SatchelFile::Pocket',
      ]);
      const file = (id: string) => files.find((w) => w.entity.id === id)?.raw;
      expect(file('botw-demo::files::SatchelFile::Pocket')).toMatchObject({ kind: 'enum', fields: 'Left;Right;Inner' });
      expect(file('botw-demo::files::GateTestNear')).toMatchObject({ kind: 'class', bases: 'GateTest', fields: 'mReach' });
      expect(file('botw-demo::files::SatchelFile::(definitions@src/KingSystem/Resource/Actor/resDemoSatchel.h)')).toMatchObject({ methods: 'glimpse' });

      const all = listWrappers(db, { sourceId: 'botw' });
      expect(new Set(all.map((w) => w.entity.id)).size).toBe(all.length);
      expect(listWrappers(db, { sourceId: 'botw', catalogId: 'items' })).toHaveLength(1);

      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 16 });
    });
  });
});
