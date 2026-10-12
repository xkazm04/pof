// cpp-handles@1 (vault Decisions Z-D46 – Z-D48): one record per parameter handle — a member a full-line marker comment
// sits directly above — beside the unchanged cpp-decls records of the same file. Every fixture is synthetic C++
// (cppHandlesFixture.ts); the marker words and the registration calls are coined there.
import { describe, expect, it } from 'vitest';
import { parseCppDecls } from '@/lib/catalog/ingest/cppDecls';
import { CPP_HANDLE_COLUMNS, cppHandleSegment, cppTypeKind, parseCppHandles } from '@/lib/catalog/ingest/cppHandles';
import { getTechnique, techniqueLabel } from '@/lib/catalog/reference/techniques';
import { LANTERNWICK_CPP, LANTERNWICK_H, QUILLMOOR_H } from './cppHandlesFixture';

const H = 'src/Glade/lanternwick.h';
const CPP = 'src/Glade/lanternwick.cpp';
const EMPTY_H = 'src/Glade/quillmoor.h';

/** The cpp-decls rows of the fixture, pinned as `cpp-decls@3` read them BEFORE the handle reader existed (the W11 base commit's reader). */
const DECLS_BEFORE = {
  [H]: [
    {
      file: H, line: '5', kind: 'enum', name: 'Brightness', qualifiedName: 'glade::nodes::Brightness', namespace: 'glade::nodes',
      outer: '', templateParams: '', bases: '', methods: '', fields: 'Dim;Glow;Blaze',
    },
    {
      file: H, line: '7', kind: 'class', name: 'Lanternwick', qualifiedName: 'glade::nodes::Lanternwick', namespace: 'glade::nodes',
      outer: '', templateParams: '', bases: 'NodeKernel', methods: 'Lanternwick;kindle;snuff;flare',
      fields: 'mFlickerRate_k;mWickCount_k;mIsLit_k;mSigil_k;mHook_k;mBurnDepth_k;mPhrase_k;mAim_k;mSpan_k;mEmber_k;mStray_k;mDrift_k;'
        + 'mTwoLine_k;mPairA_k;mPairB_k;mTrailing_k;mNoMarker_k;mSpare_k',
    },
    {
      file: H, line: '14', kind: 'struct', name: 'Wickcap', qualifiedName: 'glade::nodes::Lanternwick::Wickcap', namespace: 'glade::nodes',
      outer: 'Lanternwick', templateParams: '', bases: '', methods: '', fields: 'mInner_k;mTally_k',
    },
  ],
  [CPP]: [
    {
      file: CPP, line: '5', kind: 'definition', name: 'Lanternwick', qualifiedName: 'glade::nodes::Lanternwick::(definitions@src/Glade/lanternwick.cpp)',
      namespace: 'glade::nodes', outer: '', templateParams: '', bases: '', methods: 'Lanternwick;kindle;snuff', fields: '',
    },
  ],
  [EMPTY_H]: [
    {
      file: EMPTY_H, line: '5', kind: 'class', name: 'Quillmoor', qualifiedName: 'glade::nodes::Quillmoor', namespace: 'glade::nodes',
      outer: '', templateParams: '', bases: 'NodeKernel', methods: 'kindle', fields: 'mGust_k',
    },
  ],
};

describe('cpp-decls stays byte-identical beside the handle reader', () => {
  it('reads the class, struct, enum and definition records of the handle fixture exactly as before', () => {
    for (const [text, file] of [[LANTERNWICK_H, H], [LANTERNWICK_CPP, CPP], [QUILLMOOR_H, EMPTY_H]] as const) {
      const table = parseCppDecls(text, { file });
      expect(table.malformed).toEqual([]);
      expect(table.rows).toEqual(DECLS_BEFORE[file]);
    }
  });
});

const handles = (text: string, file: string) => parseCppHandles(text, { file }).rows;
const row = (line: number, name: string, owner: string, marker: string, declaredType: string, typeKind: string) => ({
  file: H, line: String(line), kind: 'handle', name, qualifiedName: `glade::nodes::${owner}::${name}::(handle@${H})`,
  namespace: 'glade::nodes', owner, marker, declaredType, typeKind,
});

describe('cpp-handles@1 — one record per parameter handle', () => {
  it('reads every handle of the header — each keyword type kind, two named types, an array — in declaration order', () => {
    const table = parseCppHandles(LANTERNWICK_H, { file: H });
    expect(table.columns).toEqual([...CPP_HANDLE_COLUMNS]);
    expect(table.malformed).toEqual([]);
    expect(table.rows).toEqual([
      row(16, 'mInner_k', 'Lanternwick::Wickcap', 'knob_tuning', 'const float*', 'real'),
      row(22, 'mFlickerRate_k', 'Lanternwick', 'knob_tuning', 'const float*', 'real'),
      row(24, 'mWickCount_k', 'Lanternwick', 'knob_tuning', 'const int*', 'integer'),
      row(26, 'mIsLit_k', 'Lanternwick', 'knob_percall', 'bool*', 'boolean'),
      row(28, 'mSigil_k', 'Lanternwick', 'knob_percall_alt', 'const char*', 'character'),
      row(30, 'mHook_k', 'Lanternwick', 'knob_placed', 'void*', 'void'),
      row(32, 'mBurnDepth_k', 'Lanternwick', 'knob_shared', 'const double*', 'real'),
      row(34, 'mPhrase_k', 'Lanternwick', 'knob_tuning', 'glade::Phrase', 'named'),
      row(36, 'mAim_k', 'Lanternwick', 'knob_percall', 'glade::Triple*', 'named'),
      row(38, 'mSpan_k', 'Lanternwick', 'knob_placed', 'unsigned short*', 'integer'),
      row(40, 'mEmber_k', 'Lanternwick', 'knob_tuning', 'float*[]', 'real'),
    ]);
  });

  it('keeps every scope word as written — five coined ones here — and a handle inside a nested class under its own owner', () => {
    const rows = handles(LANTERNWICK_H, H);
    expect([...new Set(rows.map((r) => r.marker))].sort()).toEqual(['knob_percall', 'knob_percall_alt', 'knob_placed', 'knob_shared', 'knob_tuning']);
    expect(rows.find((r) => r.name === 'mInner_k')).toMatchObject({ owner: 'Lanternwick::Wickcap', qualifiedName: `glade::nodes::Lanternwick::Wickcap::mInner_k::(handle@${H})` });
    // The nested struct's unmarked member is not a handle.
    expect(rows.some((r) => r.name === 'mTally_k')).toBe(false);
  });

  it('reads no near miss: a marker over a blank line, a commented-out member, a method, a two-line or two-member declaration, a trailing marker, an upper-case first word, an #if 0 region, a variable outside any class', () => {
    const names = handles(LANTERNWICK_H, H).map((r) => r.name);
    for (const miss of ['mStray_k', 'mOldWick_k', 'mDrift_k', 'flare', 'mTwoLine_k', 'mPairA_k', 'mPairB_k', 'mTrailing_k', 'mNoMarker_k', 'mSpare_k', 'mTallow_k', 'gLooseWick_k']) {
      expect(names).not.toContain(miss);
    }
  });

  it('never holds a value: not the number in the comment, an array bound, an initialiser or a registration key', () => {
    const text = JSON.stringify(handles(LANTERNWICK_H, H));
    expect(text).not.toMatch(/0x[0-9a-f]/i);
    expect(text).not.toContain('[3]');
    expect(text).not.toContain('{}');
    expect(text).not.toContain('FlickerRate"');
  });

  it('yields zero rows with the full column list for a header without handles and for a source (registration calls are not read)', () => {
    for (const [text, file] of [[QUILLMOOR_H, EMPTY_H], [LANTERNWICK_CPP, CPP]] as const) {
      const table = parseCppHandles(text, { file });
      expect(table).toEqual({ columns: [...CPP_HANDLE_COLUMNS], rows: [], malformed: [] });
    }
  });

  it('keys a handle apart from every cpp-decls record of the same file, by a synthetic segment naming the file', () => {
    const declKeys = new Set(parseCppDecls(LANTERNWICK_H, { file: H }).rows.map((r) => r.qualifiedName));
    const handleKeys = handles(LANTERNWICK_H, H).map((r) => r.qualifiedName);
    expect(handleKeys.every((k) => !declKeys.has(k) && k.endsWith(`::${cppHandleSegment(H)}`))).toBe(true);
    expect(new Set(handleKeys).size).toBe(handleKeys.length);
    expect(cppHandleSegment('')).toBe('(handle)');
    expect(parseCppHandles(LANTERNWICK_H).rows[1].qualifiedName).toBe('glade::nodes::Lanternwick::mFlickerRate_k::(handle)');
    // Strip the segment, then the member: the owner's class key.
    expect(handleKeys[1].replace(/::\([^)]*\)$/, '').replace(/::[^:]+$/, '')).toBe('glade::nodes::Lanternwick');
    expect(declKeys.has('glade::nodes::Lanternwick')).toBe(true);
  });

  it('decides a type kind from C++ keywords alone, and calls everything else named', () => {
    expect(cppTypeKind('long double')).toBe('real');
    expect(cppTypeKind('const volatile unsigned long long*')).toBe('integer');
    expect(cppTypeKind('unsigned char*')).toBe('integer');
    expect(cppTypeKind('const wchar_t*')).toBe('character');
    expect(cppTypeKind('static bool')).toBe('boolean');
    expect(cppTypeKind('glade::Triple*')).toBe('named');
    expect(cppTypeKind('const float* const')).toBe('real');
    expect(cppTypeKind('')).toBe('named');
  });

  it('is registered as a source-code technique beside cpp-decls, whose version does not move', () => {
    const technique = getTechnique('cpp-handles');
    expect(technique.assetKind).toBe('source-code');
    expect(techniqueLabel(technique)).toBe('cpp-handles@1');
    expect(techniqueLabel(getTechnique('cpp-decls'))).toBe('cpp-decls@4');
    expect(technique.read(LANTERNWICK_H, { file: 'x/y.h' }).rows[0].file).toBe('x/y.h');
  });

  it('refuses an oversized file as cpp-decls does', () => {
    expect(parseCppHandles(LANTERNWICK_H, { file: H }, { maxBytes: 16 }).refusal).toMatchObject({ limit: 'maxBytes', maximum: 16 });
    expect(parseCppHandles(LANTERNWICK_H, { file: H }, { maxRecords: 3 }).refusal).toMatchObject({ limit: 'maxRows', maximum: 3, observed: 11 });
  });
});
