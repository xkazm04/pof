// cpp-registrations@1 (vault Decisions Z-D127, W32 part 1): one record per source-side registration call that hands a
// handle's address to a loader, read beside the unchanged cpp-decls and cpp-handles records. Every line of C++, every
// name and every call word below was coined for this test; no registration argument after the first is ever stored.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { parseCppDecls, walkCppDecls, type CppLineComment, type CppMemberStatement } from '@/lib/catalog/ingest/cppDecls';
import { parseCppHandles } from '@/lib/catalog/ingest/cppHandles';
import { CPP_REGISTRATION_COLUMNS, cppRegistrationSegment, parseCppRegistrations } from '@/lib/catalog/ingest/cppRegistrations';
import { dropped, mapped, type FieldMap } from '@/lib/catalog/ingest/fieldMap';
import { BOTW, type ReferenceSource, type ReferenceTableSpec } from '@/lib/catalog/reference/sources';
import { getTechnique, techniqueLabel } from '@/lib/catalog/reference/techniques';
import { wrapTable } from '@/lib/catalog/reference/wrapper';
import { createReferenceDb, listWrappers, upsertWrappers } from '@/lib/catalog/reference/wrappers-db';
import { LANTERNWICK_CPP, LANTERNWICK_H, QUILLMOOR_H } from './cppHandlesFixture';

const FILE = 'src/Tidemark/wrenchloft.cpp';

const LOADING_HOOK = [
  '#include "tidemark/wrenchloft.h"',
  '',
  'namespace tidemark::gauges {',
  '',
  'void Wrenchloft::fetchKnobs() {',
  '    bindKnob(&mBrinePitch, "Pitch", 0, 10);',
  '    bindKnob(&mCogCount, "Cogs");',
  '    bindDial(&mFlagWord, "Flag", false);',
  '}',
  '',
  '}  // namespace tidemark::gauges',
  '',
].join('\n');

const NOT_REGISTRATIONS = [
  'namespace tidemark::gauges {',
  '',
  'bool Wrenchloft::probe() {',
  '    int cached = 0;',
  '    if (bindKnob(&mSkipped, "late")) return true;',
  '    return mReading == cached;',
  '}',
  '',
  'void Wrenchloft::fetchKnobs() {',
  '    stash.bindKnob(&mHeldAside, "aside");',
  '    stash->bindKnob(&mArrowAside, "aside");',
  '    gauges::bindKnob(&mQualified, "q");',
  '    bindKnob(&holder.mNested, "n");',
  '    bindKnob(&list[2], "i");',
  '    bindKnob(this, "self");',
  '    bindKnob(&this->mArrow, "arrow");',
  '    bindKnob(mPlain, "plain");',
  '    bindKnob(*mDeref, "deref");',
  '    int held = bindKnob(&mAssigned, "a");',
  '    consume(bindKnob(&mInner, "inner"));',
  '    bindKnob(&mTail, "t") + 1;',
  '    while (bindKnob(&mLooped, "l")) {}',
  '    return bindKnob(&mReturned, "r");',
  '}',
  '',
  'void freeBind() { bindKnob(&mFree, "f"); }',
  '',
  'class Inlineloft {',
  '    void fill() { bindKnob(&mInline, "i"); }',
  '    int mInline;',
  '};',
  '',
  '#if 0',
  'void Hiddenloft::fill() { bindKnob(&mHidden, "h"); }',
  '#endif',
  '',
  '}  // namespace tidemark::gauges',
  '',
].join('\n');

const SECOND_SHAPE = [
  'namespace tidemark::gauges {',
  '',
  'void Wrenchloft::readEventKnobs(const Probe& arg) {',
  '    loadKnobInt(arg.paramLens, "Pitch");',
  '    loadKnobText(arg.paramLens, "Flag");',
  '}',
  '',
  '}  // namespace tidemark::gauges',
  '',
].join('\n');

const NESTED = [
  'namespace outerline {',
  'namespace innerline {',
  'void Alphaloft::fill() { setKnob(&mOne, "x"); }',
  '}',
  'void Betaloft::fill() { setKnob(&mTwo, "y"); }',
  '}',
  'void Gammaloft::fill() { setKnob(&mThree, "z"); }',
  '',
].join('\n');

const TWICE = [
  'namespace tidemark::gauges {',
  'void Wrenchloft::fetchKnobs() {',
  '    bindKnob(&mBrinePitch, "Pitch");',
  '    bindKnob(&mCogCount, "Cogs");',
  '    bindKnob(&mBrinePitch, "Pitch");',
  '}',
  '}',
  '',
].join('\n');

const SPLICED = [
  'namespace tidemark::gauges {',
  'void Wrenchloft::fetchKnobs() {',
  '    bindKnob(&/* gap */mAlone, "k"); // trailing note',
  '    bindKnob \\',
  '      (&mSpliced, "s");',
  '}',
  '}',
  '',
].join('\n');

const regs = (text: string, file = FILE) => parseCppRegistrations(text, { file }).rows;
const lineOf = (text: string, needle: string) => text.split('\n').findIndex((l) => l.includes(needle)) + 1;
const key = (ns: string, owner: string, member: string, file = FILE) => `${ns ? `${ns}::` : ''}${owner}::${member}::${cppRegistrationSegment(file)}`;

describe('cpp-registrations@1 - one record per registration call', () => {
  it('reads a loading hook with three registrations: columns, key and call as written, no later argument', () => {
    const table = parseCppRegistrations(LOADING_HOOK, { file: FILE });
    expect(table.columns).toEqual([...CPP_REGISTRATION_COLUMNS]);
    expect(table.malformed).toEqual([]);
    expect(table.rows).toEqual([
      {
        file: FILE, line: String(lineOf(LOADING_HOOK, '&mBrinePitch')), kind: 'registration', name: 'mBrinePitch',
        qualifiedName: key('tidemark::gauges', 'Wrenchloft', 'mBrinePitch'), namespace: 'tidemark::gauges', owner: 'Wrenchloft',
        call: 'bindKnob', function: 'fetchKnobs',
      },
      {
        file: FILE, line: String(lineOf(LOADING_HOOK, '&mCogCount')), kind: 'registration', name: 'mCogCount',
        qualifiedName: key('tidemark::gauges', 'Wrenchloft', 'mCogCount'), namespace: 'tidemark::gauges', owner: 'Wrenchloft',
        call: 'bindKnob', function: 'fetchKnobs',
      },
      {
        file: FILE, line: String(lineOf(LOADING_HOOK, '&mFlagWord')), kind: 'registration', name: 'mFlagWord',
        qualifiedName: key('tidemark::gauges', 'Wrenchloft', 'mFlagWord'), namespace: 'tidemark::gauges', owner: 'Wrenchloft',
        call: 'bindDial', function: 'fetchKnobs',
      },
    ]);
    // Nothing after the first argument is kept: not a key text, a default, a range.
    const everything = JSON.stringify(table.rows);
    for (const never of ['"Pitch"', '"Cogs"', '"Flag"', '"10"', '"0"', '"false"']) expect(everything.includes(never)).toBe(false);
  });

  it('reads no record from any form that is not a whole-statement address registration', () => {
    const table = parseCppRegistrations(NOT_REGISTRATIONS, { file: FILE });
    expect(table.malformed).toEqual([]);
    expect(table.rows).toEqual([]);
    // The same text DOES read when its forms are corrected, so the empty result is the rule's, not an empty read.
    const control = NOT_REGISTRATIONS.replace('bindKnob(&mTail, "t") + 1;', 'bindKnob(&mTail, "t");');
    expect(regs(control).map((r) => r.name)).toEqual(['mTail']);
  });

  it('gives the owners and namespaces of two owners in nested namespaces', () => {
    const rows = regs(NESTED);
    expect(rows.map((r) => [r.name, r.owner, r.namespace, r.function, r.call])).toEqual([
      ['mOne', 'Alphaloft', 'outerline::innerline', 'fill', 'setKnob'],
      ['mTwo', 'Betaloft', 'outerline', 'fill', 'setKnob'],
      ['mThree', 'Gammaloft', '', 'fill', 'setKnob'],
    ]);
    expect(rows.map((r) => r.qualifiedName)).toEqual([
      key('outerline::innerline', 'Alphaloft', 'mOne'), key('outerline', 'Betaloft', 'mTwo'), key('', 'Gammaloft', 'mThree'),
    ]);
  });

  it('keeps two rows with one key when a member is registered twice', () => {
    const rows = regs(TWICE);
    expect(rows.map((r) => r.name)).toEqual(['mBrinePitch', 'mCogCount', 'mBrinePitch']);
    expect(rows[0].qualifiedName).toBe(rows[2].qualifiedName);
    expect(rows[0].line).not.toBe(rows[2].line);
  });

  it('is not moved by a line splice or a comment between tokens', () => {
    const rows = regs(SPLICED);
    expect(rows.map((r) => [r.name, r.call, r.line])).toEqual([
      ['mAlone', 'bindKnob', String(lineOf(SPLICED, 'mAlone'))],
      ['mSpliced', 'bindKnob', String(lineOf(SPLICED, 'bindKnob \\'))],
    ]);
  });

  it('reads nothing from the second shape: a parameter list loaded from the query argument', () => {
    expect(regs(SECOND_SHAPE)).toEqual([]);
  });

  it('refuses an oversized file with zero rows and the full column list, as the other readers do', () => {
    const table = parseCppRegistrations(LOADING_HOOK, { file: FILE }, { maxBytes: 8 });
    expect(table.rows).toEqual([]);
    expect(table.columns).toEqual([...CPP_REGISTRATION_COLUMNS]);
    expect(table.refusal?.limit).toBe('maxBytes');
  });
});

describe('the body hook leaves cpp-decls and cpp-handles exactly as they were', () => {
  const dir = resolve(process.cwd(), 'src/__tests__/catalog/ingest');
  const siblings = readdirSync(dir).filter((f) => /^cppDecls.*\.test\.ts$/.test(f) || f === 'cppHandles.test.ts');
  // Every template literal and every single-quoted line of the sibling tests is a C++ fixture or a harmless string: the
  // lexer reads any text, so all of them are fed through both readers, with and without a sharing reader attached.
  const literals = siblings.flatMap((f) => {
    const src = readFileSync(resolve(dir, f), 'utf8');
    const ticks = [...src.matchAll(/`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1]);
    const quoted = [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1].replace(/\\n/g, '\n')).filter((s) => /[;{}]/.test(s));
    return [...ticks, ...quoted].filter((s) => !s.includes('${'));
  });
  const fixtures = [...literals, LANTERNWICK_H, LANTERNWICK_CPP, QUILLMOOR_H, LOADING_HOOK, NOT_REGISTRATIONS, SECOND_SHAPE, NESTED, TWICE, SPLICED];

  it('reads the sibling test files and finds fixtures in them', () => {
    expect(siblings.length).toBeGreaterThanOrEqual(5);
    expect(literals.length).toBeGreaterThan(40);
  });

  it('returns deep-equal tables with and without the hook, and the same side channels', () => {
    let bodies = 0;
    for (const text of fixtures) {
      const ctx = { file: FILE };
      const plain = parseCppDecls(text, ctx);
      const hooked = walkCppDecls(text, ctx, {}, { onBody: () => { bodies++; } });
      expect(hooked).toEqual(plain);
      const side = { comments: [] as CppLineComment[], members: [] as CppMemberStatement[] };
      const sideHooked = { comments: [] as CppLineComment[], members: [] as CppMemberStatement[] };
      const a = walkCppDecls(text, ctx, {}, { comments: side.comments, onMember: (m) => side.members.push(m) });
      const b = walkCppDecls(text, ctx, {}, { comments: sideHooked.comments, onMember: (m) => sideHooked.members.push(m), onBody: () => { bodies++; } });
      expect(b).toEqual(a);
      expect(sideHooked).toEqual(side);
      const before = parseCppHandles(text, ctx);
      parseCppRegistrations(text, ctx);
      expect(parseCppHandles(text, ctx)).toEqual(before);
    }
    expect(bodies).toBeGreaterThan(0);
  });
});

describe('through the wrapper store', () => {
  const MAP: FieldMap = {
    file: dropped('identity and provenance'), line: dropped('a position'), kind: mapped('data.declKind'), name: mapped('name'),
    qualifiedName: mapped('data.qualifiedName'), namespace: mapped('data.namespace'), owner: mapped('data.owner'),
    call: dropped('test map: the callee is not projected'), function: dropped('test map: the function is not projected'),
  };
  const SOURCE: ReferenceSource = { ...BOTW, id: 'tidemark-demo', idPrefix: 'tm', tables: [], linkPasses: [] };
  const SPEC: ReferenceTableSpec = { file: FILE, catalogId: 'state-graph', technique: 'cpp-registrations', keyColumn: 'qualifiedName', map: MAP };

  it('labels the records cpp-registrations@1 and a second ingest is idempotent', () => {
    const db = new Database(':memory:');
    createReferenceDb(db);
    const first = wrapTable(SOURCE, SPEC, LOADING_HOOK);
    expect(first.wrappers).toHaveLength(3);
    expect(first.duplicateKeys).toEqual([]);
    expect(first.wrappers.every((w) => w.technique === 'cpp-registrations@1')).toBe(true);
    expect(upsertWrappers(db, first.wrappers)).toEqual({ created: 3, rawChanged: 0, reprojected: 0, unchanged: 0 });
    const second = wrapTable(SOURCE, SPEC, LOADING_HOOK, '2030-01-01T00:00:00.000Z');
    expect(upsertWrappers(db, second.wrappers)).toEqual({ created: 0, rawChanged: 0, reprojected: 0, unchanged: 3 });
    expect(listWrappers(db, { sourceId: SOURCE.id }).map((w) => w.raw.call).sort()).toEqual(['bindDial', 'bindKnob', 'bindKnob']);
  });

  it('reports a doubled registration as a duplicate key, never dedupes it', () => {
    const result = wrapTable(SOURCE, SPEC, TWICE);
    expect(result.wrappers).toHaveLength(3);
    expect(result.duplicateKeys).toHaveLength(1);
  });

  it('registers the technique at version 1 beside the unchanged versions of the other two readers', () => {
    const t = getTechnique('cpp-registrations');
    expect(t.assetKind).toBe('source-code');
    expect(t.version).toBe(1);
    expect(techniqueLabel(t)).toBe('cpp-registrations@1');
    expect(techniqueLabel(getTechnique('cpp-decls'))).toBe('cpp-decls@4');
    expect(techniqueLabel(getTechnique('cpp-handles'))).toBe('cpp-handles@1');
    expect(t.read(LOADING_HOOK, { file: FILE }).rows).toHaveLength(3);
  });
});
