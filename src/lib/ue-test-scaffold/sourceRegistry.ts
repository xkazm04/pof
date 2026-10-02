/**
 * Which UE automation tests the project's C++ Source REGISTERS — read from disk, never from a
 * CLI callback, so a waiting test can be sorted into "author it" vs "run it" before any editor
 * round-trip is spent learning `not_found`.
 *
 * Pure core: `registeredTestNames(cppText)` extracts the registered name string of every live
 * `IMPLEMENT_[CUSTOM_]SIMPLE|COMPLEX_AUTOMATION_TEST` and `BEGIN_DEFINE_SPEC` / `DEFINE_SPEC`
 * (commented-out registrations do not count), and `testPresence(requested, names)` decides with
 * the rule `Automation RunTests <name>` uses — a registered name CONTAINS the requested one —
 * resolved through the shared `attributeUniquely` (ue-automation/abslog.ts), so a leaf two
 * registrations contain is named `ambiguous` instead of guessed.
 *
 * Bounded I/O: `scanRegisteredTests(projectPath)` walks `<project>/Source` (.cpp/.h only).
 *
 * Blind spot, by construction: a map-placed functional test (an `AFunctionalTest` actor in a
 * level) registers no C++ name, so `not-in-source` means "no C++ registration", never "cannot
 * run" — the UI keeps Run on every row.
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import { attributeUniquely } from '@/lib/ue-automation/abslog';
import { ok, err, type Result } from '@/types/result';

/** Presence of a requested test name among the registered names of the scanned Source tree. */
export type TestPresence = 'in-source' | 'not-in-source' | 'ambiguous';

/** Blank out `//` and block comments (newlines kept), leaving string/char literals intact. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '"' || c === "'") {
      // A literal runs to its unescaped closing quote (or end of line for a malformed one).
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const REGISTRATION_RE =
  /\b(?:IMPLEMENT_(?:CUSTOM_)?(?:SIMPLE|COMPLEX)_AUTOMATION_TEST|BEGIN_DEFINE_SPEC|DEFINE_SPEC)\s*\(\s*\w+\s*,\s*"((?:[^"\\\n]|\\.)*)"/g;

/** The registered automation-test names in one C++ source text, in file order. Pure. */
export function registeredTestNames(cppText: string): string[] {
  const code = stripComments(cppText ?? '');
  return [...code.matchAll(REGISTRATION_RE)].map((m) => m[1].replace(/\\(.)/g, '$1'));
}

/**
 * Is `requested` registered? Substring rule of `Automation RunTests`, uniqueness by the shared
 * `attributeUniquely`: one registered name → in-source; none → not-in-source; several → ambiguous.
 */
export function testPresence(requested: string, registeredNames: readonly string[]): TestPresence {
  const want = requested.trim();
  const attribution = attributeUniquely(want ? registeredNames.filter((n) => n.includes(want)) : []);
  if (attribution.kind === 'unique') return 'in-source';
  return attribution.kind === 'none' ? 'not-in-source' : 'ambiguous';
}

/** Annotate each planned test with its presence among `registeredNames`. Pure + additive. */
export function annotatePresence<T extends { testName: string }>(
  planned: readonly T[],
  registeredNames: readonly string[],
): Array<T & { presence: TestPresence }> {
  return planned.map((p) => ({ ...p, presence: testPresence(p.testName, registeredNames) }));
}

// ── Bounded walk of <project>/Source ──────────────────────────────────────────────────────────

/** Past this many source files the scan refuses rather than report a partial "not in source". */
export const MAX_SOURCE_FILES = 20_000;
const MAX_DEPTH = 16;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const SOURCE_EXT = /\.(cpp|h|hpp|inl)$/i;
/** Cheap pre-filter: only files mentioning a registration macro are parsed. */
const MACRO_HINT = /AUTOMATION_TEST|DEFINE_SPEC/;

export interface SourceRegistryScan {
  /** Every registered automation name found under Source (duplicates kept once). */
  names: string[];
  /** Source files read. */
  files: number;
}

/**
 * Walk `<projectPath>/Source` and collect every registered automation name. Fails (never a
 * partial answer) when Source is missing or larger than {@link MAX_SOURCE_FILES} — a truncated
 * scan would misreport real tests as `not-in-source`.
 */
export async function scanRegisteredTests(projectPath: string): Promise<Result<SourceRegistryScan, string>> {
  const root = join(projectPath, 'Source');
  try {
    if (!(await fs.stat(root)).isDirectory()) return err(`${root} is not a directory`);
  } catch {
    return err(`no Source directory under ${projectPath}`);
  }
  const names = new Set<string>();
  let files = 0;
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop()!;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (depth < MAX_DEPTH) stack.push({ dir: full, depth: depth + 1 });
        continue;
      }
      if (!e.isFile() || !SOURCE_EXT.test(e.name)) continue;
      if (++files > MAX_SOURCE_FILES) {
        return err(`Source tree exceeds ${MAX_SOURCE_FILES} files — presence not derived`);
      }
      const size = (await fs.stat(full).catch(() => null))?.size ?? 0;
      if (size > MAX_FILE_BYTES) continue;
      const text = await fs.readFile(full, 'utf8').catch(() => '');
      if (!MACRO_HINT.test(text)) continue;
      for (const n of registeredTestNames(text)) names.add(n);
    }
  }
  return ok({ names: [...names], files });
}
