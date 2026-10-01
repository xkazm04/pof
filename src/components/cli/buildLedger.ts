/**
 * Build ledger — pure functions behind the terminal's build block.
 *
 * A build's errors are keyed by CONTENT (severity | file | code | message):
 * line and column move when code is edited above an error, and diagnostic ids
 * are Date.now-based (UE5BuildParser.nextDiagId), so neither can say whether
 * two builds share an error. The ledger diffs the previous build of the
 * session against the next one into fixed / remaining / introduced — always
 * from two parsed builds, never from what a CLI run claims it fixed.
 *
 * It also owns the two fix prompts: `buildFixPrompt` (one diagnostic — the
 * text ErrorCard has always sent) and `buildFixAllPrompt` (every distinct
 * error of a build in ONE run, grouped by file).
 */

import type { BuildDiagnostic, BuildParseResult } from '@/components/cli/UE5BuildParser';

const LINKER_CHECKLIST = [
  '- Missing #include directives',
  '- Missing module dependencies in Build.cs',
  '- Unimplemented declared functions',
  '- Incorrect UCLASS/UFUNCTION signatures',
].join('\n');

/** The last paragraph of every fix-all prompt. */
export const REBUILD_VERIFY_INSTRUCTION =
  'After fixing all of them, rebuild the project once and verify the build compiles with 0 errors. If the rebuild reports new errors, fix those too before you finish.';

/** Content identity of a diagnostic: ignores id, line and column. */
export function errorKey(d: BuildDiagnostic): string {
  return [d.severity, d.file ?? '', d.code ?? '', d.message].join('|');
}

export interface BuildErrorDelta {
  /** Errors of the previous build that the next build no longer reports. */
  fixed: BuildDiagnostic[];
  /** Errors of the next build that the previous build already reported. */
  remaining: BuildDiagnostic[];
  /** Errors of the next build that the previous build did not report. */
  introduced: BuildDiagnostic[];
}

/** Error-severity diagnostics, first occurrence per content key. */
function distinctErrors(diagnostics: BuildDiagnostic[]): Map<string, BuildDiagnostic> {
  const out = new Map<string, BuildDiagnostic>();
  for (const d of diagnostics) {
    if (d.severity !== 'error') continue;
    const k = errorKey(d);
    if (!out.has(k)) out.set(k, d);
  }
  return out;
}

/**
 * Diff two builds' errors. `prev === null` is the first build of the session:
 * there is no baseline, so every error is introduced and nothing is fixed.
 */
export function diffBuildErrors(prev: BuildDiagnostic[] | null, next: BuildDiagnostic[]): BuildErrorDelta {
  const nextErrors = distinctErrors(next);
  if (prev === null) return { fixed: [], remaining: [], introduced: [...nextErrors.values()] };
  const prevErrors = distinctErrors(prev);
  const fixed = [...prevErrors].filter(([k]) => !nextErrors.has(k)).map(([, d]) => d);
  const remaining: BuildDiagnostic[] = [];
  const introduced: BuildDiagnostic[] = [];
  for (const [k, d] of nextErrors) (prevErrors.has(k) ? remaining : introduced).push(d);
  return { fixed, remaining, introduced };
}

/**
 * The build parsed just before `logId` in the terminal's insertion-ordered
 * buildParseCache, or null when `logId` is the first build or not cached.
 */
export function previousBuild(cache: Map<string, BuildParseResult>, logId: string): BuildParseResult | null {
  let prev: BuildParseResult | null = null;
  for (const [id, parsed] of cache) {
    if (id === logId) return prev;
    if (parsed.isBuildOutput) prev = parsed;
  }
  return null;
}

/** The single-diagnostic fix prompt (ErrorCard's 'Fix' — unchanged text). */
export function buildFixPrompt(d: BuildDiagnostic): string {
  const fileRef = d.file
    ? `in file ${d.file}${d.line ? ` at line ${d.line}` : ''}`
    : '';
  const codeRef = d.code ? ` (${d.code})` : '';

  let prompt = `Fix this compilation ${d.severity}${codeRef} ${fileRef}:\n\n${d.message}`;
  if (d.file) {
    prompt += `\n\nStart by reading ${d.file} to understand the context around ${d.line ? `line ${d.line}` : 'the issue'}.`;
  }
  if (d.category === 'linker') {
    prompt += `\n\nThis is a linker error. Check for:\n${LINKER_CHECKLIST}`;
  }
  prompt += `\n\nAfter fixing, verify the build compiles successfully.`;
  return prompt;
}

const NO_FILE_HEADING = '(no file — build tool)';

/**
 * One prompt for every distinct error of a build: deduped by content key,
 * grouped under a heading per file (all lines of a duplicated error listed on
 * its one entry), the linker checklist only when a linker error is present,
 * ending with the rebuild-and-verify instruction. Null when there is nothing
 * to fix.
 */
export function buildFixAllPrompt(errors: BuildDiagnostic[]): string | null {
  const byKey = new Map<string, { d: BuildDiagnostic; lines: number[] }>();
  for (const d of errors) {
    if (d.severity !== 'error') continue;
    const k = errorKey(d);
    const entry = byKey.get(k) ?? { d, lines: [] };
    if (d.line != null && !entry.lines.includes(d.line)) entry.lines.push(d.line);
    byKey.set(k, entry);
  }
  if (byKey.size === 0) return null;

  const byFile = new Map<string, string[]>();
  for (const { d, lines } of byKey.values()) {
    const heading = d.file ?? NO_FILE_HEADING;
    const where = lines.length > 0 ? `line${lines.length > 1 ? 's' : ''} ${lines.join(', ')}` : '';
    const label = [where, d.code].filter(Boolean).join(' ');
    const bucket = byFile.get(heading) ?? [];
    bucket.push(`- ${label ? `${label}: ` : ''}${d.message}`);
    byFile.set(heading, bucket);
  }

  const n = byKey.size;
  const parts = [
    `Fix all ${n} build error${n === 1 ? '' : 's'} below in this one run. They come from the same UE build, so fix them together rather than one at a time.`,
    ...[...byFile].map(([file, items]) => `### ${file}\n${items.join('\n')}`),
    'Start by reading each file listed above around the cited lines.',
  ];
  if ([...byKey.values()].some(({ d }) => d.category === 'linker')) {
    parts.push(`Some of these are linker errors. Check for:\n${LINKER_CHECKLIST}`);
  }
  parts.push(REBUILD_VERIFY_INSTRUCTION);
  return parts.join('\n\n');
}
