import { describe, it, expect } from 'vitest';
import { parseBuildOutput } from '@/components/cli/UE5BuildParser';

// scan-sweep night 2026-11-08 cli-terminal-shell — MSVC prints its fatal diagnostics
// as "fatal error C1083" / "fatal error LNK1120"; the parser only matched a bare
// "error", so the most common UE include failure never became a diagnostic (no
// ErrorCard, no Fix, absent from Fix-all and the build ledger).

const BUILD = [
  'Building 3 actions with 8 processes...',
  "C:\\Proj\\Source\\PoF\\Foo.cpp(12): fatal error C1083: Cannot open include file: 'Bar.h': No such file or directory",
  "C:\\Proj\\Source\\PoF\\Foo.cpp(20): error C2065: 'x': undeclared identifier",
  'Module.PoF.cpp.obj : error LNK2019: unresolved external symbol "void Baz(void)"',
  'UnrealEditor-PoF.dll : fatal error LNK1120: 1 unresolved externals',
  'Build FAILED.',
].join('\n');

describe('UE5BuildParser — fatal MSVC diagnostics', () => {
  it('parses every error line, fatal ones included', () => {
    const { diagnostics, summary } = parseBuildOutput(BUILD);
    expect(diagnostics.map((d) => [d.severity, d.code, d.category])).toEqual([
      ['error', 'C1083', 'compile'],
      ['error', 'C2065', 'compile'],
      ['error', 'LNK2019', 'linker'],
      ['error', 'LNK1120', 'linker'],
    ]);
    expect(diagnostics[0].file).toBe('Source\\PoF\\Foo.cpp');
    expect(diagnostics[0].line).toBe(12);
    expect(diagnostics[0].message).toBe("Cannot open include file: 'Bar.h': No such file or directory");
    expect(diagnostics[3].file).toBe('UnrealEditor-PoF.dll');
    expect(summary?.success).toBe(false);
  });

  it('keeps the plain (non-fatal) forms unchanged', () => {
    const { diagnostics } = parseBuildOutput([
      'Compiling Foo.cpp',
      'Foo.cpp(5,3): warning C4996: deprecated',
      'Module.PoF.cpp.obj : error LNK2001: unresolved external symbol',
    ].join('\n'));
    expect(diagnostics.map((d) => [d.severity, d.code, d.column])).toEqual([
      ['warning', 'C4996', 3],
      ['error', 'LNK2001', null],
    ]);
  });
});
