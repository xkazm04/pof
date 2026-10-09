// W02: the BOTW parameter-group spec. The registered glob must read the parameter-group folder and
// nothing else (above all no top-level Resource file — that level is descoped), its class map must
// classify every reader column for every record kind the area holds, and a second ingest must move
// nothing. The tree below copies only the reference's PATHS; every line of C++ in it was written
// for this test.
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { BOTW_DESCOPES, PARAM_GROUP_CLASS_MAP } from '@/lib/catalog/ingest/botw';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { CPP_RECORD_COLUMNS } from '@/lib/catalog/ingest/cppDecls';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';
import { computePathCoverage, expandGlob } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const AREA = 'src/KingSystem/Resource/GeneralParamList';

const FILES: Record<string, string> = {
  // A shared base plus the closed list of group kinds: one class record and one enum record.
  [`${AREA}/demoGroupBase.h`]: `
namespace demo::params {
enum class GroupKind { Blade = 0, Critter = 1 };
class TunableGroup : public DebugNode {
public:
    virtual const char* label() const = 0;
protected:
    ParamBag mBag;
};
}`,
  // A group with a nested struct and an out-of-line inline constructor: class + struct + definition.
  [`${AREA}/demoGroupBlade.h`]: `
namespace demo::params {
class BladeGroup : public TunableGroup {
public:
    struct Edge { Edge(); Tunable<float> mKeen; };
    BladeGroup();
    const char* label() const override { return "blade"; }
    Tunable<int> mReach;
    Tunable<float> mWear;
};
inline BladeGroup::BladeGroup() { mReach.init(1, "reach", obj()); }
}`,
  // A group whose constructor is defined in the class: one class record, no definition record.
  [`${AREA}/demoGroupCritter.h`]: `
namespace demo::params {
class CritterGroup : public TunableGroup {
public:
    CritterGroup() { mFlee.init(false, "flee", obj()); }
    const char* label() const override { return "critter"; }
    Tunable<bool> mFlee;
};
}`,
  // A source defining members of two owners: two definition records.
  [`${AREA}/demoGroupExtras.cpp`]: `
#include "demoGroupBlade.h"
namespace demo::params {
BladeGroup::Edge::Edge() = default;
void CritterGroup::scatter(int count) {}
}`,
  // Traits made only by a macro over a forward-declared template: read, but no record.
  [`${AREA}/demoGroupTraits.h`]: `
namespace demo::params {
template <GroupKind> struct KindTraits;
#define DEMO_KIND_TRAIT(N) template <> struct KindTraits<GroupKind::N> { using type = class N##Group; };
DEMO_KIND_TRAIT(Blade)
DEMO_KIND_TRAIT(Critter)
#undef DEMO_KIND_TRAIT
}`,
  // Top-level Resource file: descoped, so the spec must never read it.
  'src/KingSystem/Resource/demoLoader.h': 'namespace demo { class Loader { int mBudgetBytes; }; }',
  // Sibling folders: still open, and a name that merely starts like the area is not the area.
  'src/KingSystem/Resource/Actor/demoActorParams.h': 'namespace demo { class ActorParams { int mVigour; }; }',
  'src/KingSystem/Resource/GeneralParamListDraft/demoDraft.h': 'namespace demo { class Draft {}; }',
  // The Player spec's area, so the run shows the two specs side by side.
  'src/Game/Actor/Player/demoRunner.h': 'namespace demo::act { class Runner : public NodeBase { float mPaceLeft; }; }',
};

const AREA_FILES = Object.keys(FILES).filter((f) => f.startsWith(`${AREA}/`)).sort();
const spec = BOTW.tables.find((t) => t.file.startsWith(`${AREA}/`));

describe('BOTW parameter-group spec (W02)', () => {
  it('is registered once, as the second BOTW spec, wrap-only under items', () => {
    expect(BOTW.tables).toHaveLength(2);
    expect(spec).toMatchObject({ file: `${AREA}/**/*.{h,cpp}`, catalogId: 'items', technique: 'cpp-decls', keyColumn: 'qualifiedName' });
  });

  it('reads the parameter-group folder and nothing else', () => {
    expect(expandGlob(Object.keys(FILES), spec!.file)).toEqual(AREA_FILES);
    const cov = computePathCoverage(Object.keys(FILES), BOTW.tables.map((t) => t.file), BOTW_DESCOPES);
    // 5 area files + 1 Player file covered; the top-level Resource file descoped; the two siblings open.
    expect(cov).toMatchObject({ total: 9, covered: 6, descoped: 1, open: 2 });
    expect(cov.openFiles).toEqual(['src/KingSystem/Resource/Actor/demoActorParams.h', 'src/KingSystem/Resource/GeneralParamListDraft/demoDraft.h']);
    expect(cov.specs.find((s) => s.pattern === spec!.file)?.files).toBe(5);
  });

  it('classifies every reader column: kind/name/qualifiedName/namespace/outer mapped, methods dropped, bases and fields gaps', () => {
    const audit = auditColumns([...CPP_RECORD_COLUMNS], PARAM_GROUP_CLASS_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
    expect(audit).toMatchObject({
      mapped: ['kind', 'name', 'qualifiedName', 'namespace', 'outer'],
      dropped: ['file', 'line', 'templateParams', 'methods'],
      gap: [{ column: 'bases' }, { column: 'fields' }],
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

    it('wraps every record kind with 0 unclassified columns, and a second ingest moves nothing', () => {
      const first = ingestSourceFromDir('botw', 'clone', deps());
      expect([...new Set(reads)].sort()).toEqual([...AREA_FILES, 'src/Game/Actor/Player/demoRunner.h'].sort());
      const area = first.tables.find((t) => t.file === spec!.file);
      expect(area).toMatchObject({
        catalogId: 'items', status: 'ingested', rows: 8, unclassified: [], declaredButAbsent: [],
        duplicateKeys: 0, malformed: 0, files: { matched: 5, withoutRecords: 1, refused: [] },
      });
      expect(first.store).toEqual({ created: 9, rawChanged: 0, reprojected: 0, unchanged: 0 });

      const wrapped = listWrappers(db, { sourceId: 'botw', catalogId: 'items' });
      const kinds = wrapped.map((w) => w.raw.kind).sort();
      expect(kinds).toEqual(['class', 'class', 'class', 'definition', 'definition', 'definition', 'enum', 'struct']);
      expect(wrapped.map((w) => w.entity.id).sort()).toEqual([
        'botw-demo::params::BladeGroup',
        'botw-demo::params::BladeGroup::(definitions)',
        'botw-demo::params::BladeGroup::Edge',
        'botw-demo::params::BladeGroup::Edge::(definitions)',
        'botw-demo::params::CritterGroup',
        'botw-demo::params::CritterGroup::(definitions)',
        'botw-demo::params::GroupKind',
        'botw-demo::params::TunableGroup',
      ]);
      expect(wrapped.find((w) => w.raw.kind === 'enum')?.raw).toMatchObject({ name: 'GroupKind', fields: 'Blade;Critter' });
      expect(listWrappers(db, { sourceId: 'botw', catalogId: 'player-movement' })).toHaveLength(1);

      const second = ingestSourceFromDir('botw', 'clone', deps());
      expect(second.store).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 9 });
    });
  });
});
