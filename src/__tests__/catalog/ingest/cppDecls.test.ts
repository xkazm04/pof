// The cpp-decls reader turns one C++ file into one record per class definition. Every fixture
// here is synthetic — written for this test, shaped like real-world headers (RTTI-style macros
// without semicolons, size-check macros, matching/non-matching twin branches) but carrying no
// code from any reference project.
import { describe, expect, it } from 'vitest';
import { CPP_LIST_SEP, CPP_RECORD_COLUMNS, parseCppDecls } from '@/lib/catalog/ingest/cppDecls';
import { getTechnique, techniqueLabel } from '@/lib/catalog/reference/techniques';

const list = (cell: string | undefined) => (cell ? cell.split(CPP_LIST_SEP) : []);
const read = (text: string) => parseCppDecls(text, { file: 'demo/forge.h' });
const byName = (text: string) => Object.fromEntries(read(text).rows.map((r) => [r.qualifiedName, r]));
// v2 added enum and out-of-line definition records beside the class records; the v1 assertions
// below still hold, unchanged, over the class / struct / union records.
const CLASS_KINDS = new Set(['class', 'struct', 'union']);
const classRows = (text: string) => read(text).rows.filter((r) => CLASS_KINDS.has(r.kind));

describe('cpp-decls reader — classes and members', () => {
  const HEADER = `
#pragma once
#include <stdint.h>

namespace forge::play {

class Ember;  // forward declaration: not a record

class Lantern : public Light, private virtual Counted<Lantern, 2> {
    FORGE_RTTI(Lantern, Light)
public:
    explicit Lantern(int glow);
    ~Lantern() override;
    void kindle(float seconds) override;
    void kindle(int ticks);                 // an overload collapses into one name
    bool operator==(const Lantern& other) const;
    explicit operator bool() const { return mGlow > 0; }
    static Lantern* create();
    int glow() const { if (mGlow) { return mGlow; } return 0; }

protected:
    int mGlow = 0;
    float mFuel{1.5f};
    uint32_t mBits : 4, mMode : 2;
    Ember* mSpark, *mSecondSpark;
    void (*mOnDim)(int level);
    char mTagText[16];
    static constexpr int cMaxGlow = 9;
};
FORGE_CHECK_SIZE(Lantern, 0x40);

}  // namespace forge::play
`;

  it('records the class with its namespace, bases, member functions and fields — and nothing for a forward declaration', () => {
    const table = read(HEADER);
    expect(table.malformed).toEqual([]);
    expect(table.columns).toEqual([...CPP_RECORD_COLUMNS]);
    expect(table.rows).toHaveLength(1);
    const lantern = table.rows[0];
    expect(lantern).toMatchObject({
      file: 'demo/forge.h', kind: 'class', name: 'Lantern', qualifiedName: 'forge::play::Lantern',
      namespace: 'forge::play', outer: '', templateParams: '', line: '9',
    });
    expect(list(lantern.bases)).toEqual(['Light', 'Counted<Lantern,2>']);
    expect(list(lantern.methods)).toEqual(['Lantern', '~Lantern', 'kindle', 'operator==', 'operator bool', 'create', 'glow']);
    expect(list(lantern.fields)).toEqual(['mGlow', 'mFuel', 'mBits', 'mMode', 'mSpark', 'mSecondSpark', 'mOnDim', 'mTagText', 'cMaxGlow']);
  });

  it('is registered as a source-code technique and reads through the technique table with the file path', () => {
    const technique = getTechnique('cpp-decls');
    expect(technique.assetKind).toBe('source-code');
    expect(techniqueLabel(technique)).toBe('cpp-decls@2');
    expect(technique.read(HEADER, { file: 'x/y.h' }).rows[0].file).toBe('x/y.h');
  });
});

describe('cpp-decls reader — namespaces, nesting and templates', () => {
  const NESTED = `
namespace outer {
namespace inner {
inline namespace v2 {
struct Gauge {
    struct Needle { float angle; };
    union { int asInt; float asFloat; };   // anonymous: members fold into Gauge
    enum class Unit { Bar, Psi };          // an enum is not a record
    Needle needle;
};
}  // namespace v2
}  // namespace inner
namespace {
struct Hidden { int secret; };
}
}  // namespace outer

namespace a::b::c { class Deep {}; }

struct Gauge::Needle2 : Base {};
`;

  it('tracks nested, inline, anonymous and compact namespaces, and nested classes', () => {
    const rows = byName(NESTED);
    expect(classRows(NESTED).map((r) => r.qualifiedName).sort()).toEqual([
      'Gauge::Needle2',
      'a::b::c::Deep',
      'outer::(anonymous)::Hidden',
      'outer::inner::v2::Gauge',
      'outer::inner::v2::Gauge::Needle',
    ]);
    // v2: the nested enum is a record of its own (and still adds nothing to Gauge's fields).
    expect(Object.keys(rows).sort()).toEqual([
      'Gauge::Needle2',
      'a::b::c::Deep',
      'outer::(anonymous)::Hidden',
      'outer::inner::v2::Gauge',
      'outer::inner::v2::Gauge::Needle',
      'outer::inner::v2::Gauge::Unit',
    ]);
    expect(rows['outer::inner::v2::Gauge::Unit']).toMatchObject({ kind: 'enum', outer: 'Gauge', fields: 'Bar;Psi' });
    expect(rows['outer::inner::v2::Gauge::Needle']).toMatchObject({ outer: 'Gauge', namespace: 'outer::inner::v2', fields: 'angle' });
    expect(list(rows['outer::inner::v2::Gauge'].fields)).toEqual(['asInt', 'asFloat', 'needle']);
    expect(rows['Gauge::Needle2'].bases).toBe('Base');
  });

  const TEMPLATES = `
namespace kit {
template <typename T, int N = 4>
class Ring : public Store<T> {
public:
    template <typename U> void push(U&& value);
    T& operator[](int index);
    T& operator()(int a, int b);
private:
    T mItems[N];
    int mHead = 0;
};

template <>
class Ring<bool, 1> {
    bool mOnly;
};

template <template <typename> class Policy>
struct Holder : Policy<int> { Policy<int> mPolicy; };

template <typename T> T clamp(T v) { return v < T{} ? T{} : v; }
}
`;

  it('reads template parameters, explicit specializations and template-template parameters', () => {
    const rows = byName(TEMPLATES);
    expect(Object.keys(rows).sort()).toEqual(['kit::Holder', 'kit::Ring', 'kit::Ring<bool,1>']);
    expect(rows['kit::Ring']).toMatchObject({ templateParams: 'typename T,int N=4', bases: 'Store<T>' });
    expect(list(rows['kit::Ring'].methods)).toEqual(['push', 'operator[]', 'operator()']);
    expect(list(rows['kit::Ring'].fields)).toEqual(['mItems', 'mHead']);
    expect(rows['kit::Ring<bool,1>']).toMatchObject({ templateParams: '<>', fields: 'mOnly' });
    expect(rows['kit::Holder']).toMatchObject({ bases: 'Policy<int>', fields: 'mPolicy' });
  });
});

describe('cpp-decls reader — what it must not choke on', () => {
  const NOISY = `
/* A block comment with a fake class: class Phantom { int x; }; and an unmatched { brace */
// class AlsoPhantom {
#define FORGE_DECLARE(name) \\
    class name##Impl {      \\
        int value;          \\
    };
#define OPEN_BRACE {

#if 0
class Disabled { int dead; };
#else
class Enabled { int alive; };
#endif

#ifdef FORGE_MATCHING
class Twin {
    void tick();
#else
class Twin {
    void tick() const;
#endif
    int mTwin;
};

struct Quoted {
    const char* mText = "class InString { }";
    char mBrace = '{';
    const char* mRaw = R"tag(struct InRaw { } )tag";
    void run() { auto s = "}"; (void)s; }
};

extern "C" {
struct CBridge { int handle; };
}

void freeFunction() {
    struct LocalOnly { int hidden; };   // local to a body: skipped with the body
    int table[] = { 1, 2, 3 };
}

namespace sys {
Machine::Machine() : mA(1), mB{2}, Base<int>{3} {
    struct Local {};
}
}
`;

  it('skips comments, macro bodies, disabled and twin branches, literals and function bodies', () => {
    const table = read(NOISY);
    expect(table.malformed).toEqual([]);
    expect(classRows(NOISY).map((r) => r.qualifiedName)).toEqual(['Enabled', 'Twin', 'Quoted', 'CBridge']);
    // v2: the out-of-line constructor is a definition record; the free function and every
    // body-local class stay invisible.
    expect(table.rows.map((r) => r.qualifiedName)).toEqual(['Enabled', 'Twin', 'Quoted', 'CBridge', 'sys::Machine::(definitions)']);
    expect(table.rows[4]).toMatchObject({ kind: 'definition', name: 'Machine', methods: 'Machine', fields: '' });
    const rows = byName(NOISY);
    expect(rows.Twin.methods).toBe('tick');
    expect(rows.Twin.fields).toBe('mTwin');
    expect(list(rows.Quoted.fields)).toEqual(['mText', 'mBrace', 'mRaw']);
    expect(rows.Quoted.methods).toBe('run');
    expect(rows.CBridge.namespace).toBe('');
  });

  it('spells an empty file, a no-definition file and an unreadable file differently', () => {
    const empty = read('');
    expect(empty).toEqual({ columns: [...CPP_RECORD_COLUMNS], rows: [], malformed: [] });

    const declarationsOnly = read('#pragma once\nnamespace z { class Later; enum class Mode : int; int f(int); }\n');
    expect(declarationsOnly.rows).toEqual([]);
    expect(declarationsOnly.malformed).toEqual([]);
    // v1 counted `enum class Mode { A }` among the declarations; v2 reads it as the enum definition it is (F1).
    const withEnumBody = read('#pragma once\nnamespace z { class Later; enum class Mode { A }; int f(int); }\n');
    expect(withEnumBody.rows.map((r) => [r.kind, r.qualifiedName, r.fields])).toEqual([['enum', 'z::Mode', 'A']]);
    expect(withEnumBody.malformed).toEqual([]);

    const broken = read('namespace z {\nclass Open {\n  int x;\n');
    expect(broken.malformed.map((m) => m.raw)).toEqual([
      'unbalanced braces: class scope never closes',
      'unbalanced braces: namespace scope never closes',
    ]);
    // A definition that was opened is still recorded — the defect is reported beside it, not instead of it.
    expect(broken.rows.map((r) => r.qualifiedName)).toEqual(['z::Open']);

    expect(read('}\nclass After {};\n').malformed).toEqual([{ line: 1, expected: 0, actual: 1, raw: 'stray } at file scope' }]);
    expect(read('/* never closed\nclass X {};').malformed[0].raw).toBe('unterminated block comment');
  });

  it('refuses a file over its byte limit instead of reading part of it', () => {
    const table = parseCppDecls('class A {};\n'.repeat(50), { file: 'big.h' }, { maxBytes: 100 });
    expect(table.rows).toEqual([]);
    expect(table.columns).toEqual([...CPP_RECORD_COLUMNS]);
    expect(table.refusal).toMatchObject({ limit: 'maxBytes', maximum: 100, observed: 600 });
  });

  it('is deterministic: the same text reads to the same records', () => {
    expect(read(NOISY)).toEqual(read(NOISY));
  });
});
