/**
 * Build ledger (cli-terminal-shell/B): the pure half of "fix all of a build's
 * errors in one run, see fixed / new / remaining".
 *
 * - errorKey / diffBuildErrors key a diagnostic by content (severity, file,
 *   code, message), never by line, column or the unstable Date.now-based id.
 * - previousBuild walks the terminal's insertion-ordered buildParseCache.
 * - buildFixAllPrompt is ONE prompt for every distinct error of a build.
 * - buildFixPrompt is the single-diagnostic prompt ErrorCard has always sent
 *   (frozen here byte for byte), and UE5BuildParser.buildFixPromptFromError
 *   now delegates to it.
 */

import { describe, it, expect } from 'vitest';
import {
  errorKey, diffBuildErrors, previousBuild, buildFixAllPrompt, buildFixPrompt,
  REBUILD_VERIFY_INSTRUCTION,
} from '@/components/cli/buildLedger';
import {
  parseBuildOutput, buildFixPromptFromError,
  type BuildDiagnostic, type BuildParseResult,
} from '@/components/cli/UE5BuildParser';

let seq = 0;
function diag(over: Partial<BuildDiagnostic>): BuildDiagnostic {
  return {
    id: `t-${seq++}`,
    severity: 'error',
    file: null,
    line: null,
    column: null,
    code: null,
    message: 'msg',
    rawText: 'raw',
    category: 'compile',
    ...over,
  };
}

const A = diag({ file: 'Source/X/Foo.cpp', line: 10, column: 5, code: 'C2065', message: "'Bar': undeclared identifier" });
const B = diag({ file: 'Foo.obj', code: 'LNK2019', message: 'unresolved external symbol Baz', category: 'linker' });
const B2 = { ...B, id: 'other-id', line: 77, column: 3 };
const C = diag({ file: 'Source/X/Qux.h', line: 4, code: 'C2143', message: "syntax error: missing ';' before '*'" });

describe('errorKey', () => {
  it('ignores id, line and column', () => {
    expect(errorKey(B)).toBe(errorKey(B2));
    expect(errorKey(A)).not.toBe(errorKey(C));
  });
});

describe('diffBuildErrors', () => {
  it('splits prev/next into fixed, remaining and introduced by content key', () => {
    const d = diffBuildErrors([A, B], [B2, C]);
    expect(d.fixed).toEqual([A]);
    expect(d.remaining).toEqual([B2]);
    expect(d.introduced).toEqual([C]);
  });

  it('the first build of the session has no baseline: every error is introduced', () => {
    const next = [A, B, C];
    expect(diffBuildErrors(null, next)).toEqual({ fixed: [], remaining: [], introduced: next });
  });

  it('parsing the same build text twice diffs to all-remaining (ids are not the key)', () => {
    const text = [
      'Building 3 actions with 8 processes...',
      'D:\\Game\\Source\\X\\Foo.cpp(10): error C2065: \'Bar\': undeclared identifier',
      'D:\\Game\\Source\\X\\Qux.h(4,9): error C2143: syntax error: missing \';\' before \'*\'',
      'Foo.obj : error LNK2019: unresolved external symbol Baz',
      'Build FAILED',
    ].join('\n');
    const first = parseBuildOutput(text).diagnostics;
    const second = parseBuildOutput(text).diagnostics;
    expect(second.map((d) => d.id)).not.toEqual(first.map((d) => d.id));
    const d = diffBuildErrors(first, second);
    expect(d.fixed).toEqual([]);
    expect(d.introduced).toEqual([]);
    expect(d.remaining).toEqual(second.filter((x) => x.severity === 'error'));
    expect(d.remaining).toHaveLength(3);
  });
});

describe('previousBuild', () => {
  const build = (n: number): BuildParseResult => ({
    diagnostics: [diag({ message: `e${n}` })], summary: null, isBuildOutput: true,
  });
  const cache = new Map<string, BuildParseResult>();
  cache.set('r1', build(1));
  cache.set('r2', build(2));
  cache.set('r3', build(3));

  it('returns the build inserted just before, by insertion order', () => {
    expect(previousBuild(cache, 'r3')).toBe(cache.get('r2'));
  });
  it('returns null for the first build and for an unknown id', () => {
    expect(previousBuild(cache, 'r1')).toBeNull();
    expect(previousBuild(cache, 'unknown-id')).toBeNull();
  });
});

describe('buildFixAllPrompt', () => {
  const A2 = { ...A, id: 'dup', line: 42 }; // same key as A, other line

  it('names each distinct error once under its file heading, with the linker checklist, ending with rebuild-and-verify', () => {
    const p = buildFixAllPrompt([A, B, A2]);
    expect(p).not.toBeNull();
    const prompt = p as string;
    expect(prompt.split("'Bar': undeclared identifier").length - 1).toBe(1);
    expect(prompt.split('unresolved external symbol Baz').length - 1).toBe(1);
    expect(prompt).toContain('### Source/X/Foo.cpp');
    expect(prompt).toContain('### Foo.obj');
    expect(prompt.indexOf('### Source/X/Foo.cpp')).toBeLessThan(prompt.indexOf("'Bar': undeclared identifier"));
    expect(prompt.indexOf('### Foo.obj')).toBeLessThan(prompt.indexOf('unresolved external symbol Baz'));
    expect(prompt).toContain('Missing module dependencies in Build.cs');
    expect(prompt.endsWith(REBUILD_VERIFY_INSTRUCTION)).toBe(true);
  });

  it('omits the linker checklist when no linker error is present', () => {
    const prompt = buildFixAllPrompt([A, C]) as string;
    expect(prompt).not.toContain('Missing module dependencies in Build.cs');
    expect(prompt.endsWith(REBUILD_VERIFY_INSTRUCTION)).toBe(true);
  });

  it('returns null for no errors', () => {
    expect(buildFixAllPrompt([])).toBeNull();
  });
});

describe('[guard] buildFixPrompt is the exact single-diagnostic prompt ErrorCard sends today', () => {
  const compile = diag({ file: 'Source/X/Foo.cpp', line: 10, code: 'C2065', message: "'Bar': undeclared identifier" });
  const linker = diag({ file: 'Foo.obj', code: 'LNK2019', message: 'unresolved external symbol Baz', category: 'linker' });

  const COMPILE_EXPECTED = "Fix this compilation error (C2065) in file Source/X/Foo.cpp at line 10:\n\n'Bar': undeclared identifier"
    + '\n\nStart by reading Source/X/Foo.cpp to understand the context around line 10.'
    + '\n\nAfter fixing, verify the build compiles successfully.';
  const LINKER_EXPECTED = 'Fix this compilation error (LNK2019) in file Foo.obj:\n\nunresolved external symbol Baz'
    + '\n\nStart by reading Foo.obj to understand the context around the issue.'
    + '\n\nThis is a linker error. Check for:\n- Missing #include directives\n- Missing module dependencies in Build.cs\n- Unimplemented declared functions\n- Incorrect UCLASS/UFUNCTION signatures'
    + '\n\nAfter fixing, verify the build compiles successfully.';

  it('compile diagnostic', () => {
    expect(buildFixPrompt(compile)).toBe(COMPILE_EXPECTED);
    expect(buildFixPromptFromError(compile)).toBe(COMPILE_EXPECTED);
  });
  it('linker diagnostic', () => {
    expect(buildFixPrompt(linker)).toBe(LINKER_EXPECTED);
    expect(buildFixPromptFromError(linker)).toBe(LINKER_EXPECTED);
  });
});
