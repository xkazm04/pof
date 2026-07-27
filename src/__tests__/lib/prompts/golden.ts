/**
 * A diff-aware golden-file rail for composed prompts.
 *
 * Why not `toMatchSnapshot()`: a snapshot mismatch reports "snapshot mismatched"
 * plus a wall of text. Prompts are 200+ lines of markdown assembled from a dozen
 * independently-owned sections, and concurrent fleet sessions edit them
 * constantly — the useful signal is **which section drifted**, not the whole
 * blob. This helper stores each golden as a reviewable `.md` file and, on
 * mismatch, names the drifted `##` / `###` sections first, then shows the
 * line-level diff (via the shared `lib/text-diff.ts` LCS engine).
 *
 * Re-record intentionally with:
 *   POF_UPDATE_GOLDEN=1 npx vitest run src/__tests__/lib/prompts
 */

import fs from 'node:fs';
import path from 'node:path';
import { diffPrompts, rowText } from '@/lib/text-diff';

const GOLDEN_DIR = path.join(process.cwd(), 'src', '__tests__', 'lib', 'prompts', '__golden__');

/** Split a composed prompt into `heading → body` chunks on markdown `##`/`###` lines. */
function sections(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let heading = '(preamble)';
  let buf: string[] = [];
  const flush = () => {
    // Duplicate headings (a prompt can repeat `## Task`) get a numeric suffix so
    // one section can never silently swallow another.
    let key = heading;
    let n = 2;
    while (out.has(key)) key = `${heading} #${n++}`;
    out.set(key, buf.join('\n').trim());
  };
  for (const line of text.split('\n')) {
    if (/^#{2,3} /.test(line)) {
      flush();
      heading = line.trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

/** Human summary of which sections were added / removed / changed. */
function describeSectionDrift(expected: string, actual: string): string[] {
  const a = sections(expected);
  const b = sections(actual);
  const lines: string[] = [];
  for (const key of a.keys()) {
    if (!b.has(key)) lines.push(`  REMOVED section: ${key}`);
    else if (a.get(key) !== b.get(key)) lines.push(`  CHANGED section: ${key}`);
  }
  for (const key of b.keys()) {
    if (!a.has(key)) lines.push(`  ADDED   section: ${key}`);
  }
  return lines;
}

/** First N changed lines, rendered `- old` / `+ new`. */
function changedLines(expected: string, actual: string, limit = 40): string[] {
  const diff = diffPrompts(expected, actual);
  return diff.unified
    .filter((r) => r.type !== 'eq')
    .slice(0, limit)
    .map((r) => `  ${r.type === 'del' ? '-' : '+'} ${rowText(r)}`);
}

/**
 * Assert `actual` matches the recorded golden for `name`.
 *
 * Writes (and passes) when the golden is missing or `POF_UPDATE_GOLDEN` is set —
 * a NEW pin is always recorded on first run, an EXISTING pin only ever changes
 * deliberately.
 */
export function expectGolden(name: string, actual: string): void {
  const file = path.join(GOLDEN_DIR, `${name}.md`);
  const normalized = actual.replace(/\r\n/g, '\n');

  if (process.env.POF_UPDATE_GOLDEN || !fs.existsSync(file)) {
    fs.mkdirSync(GOLDEN_DIR, { recursive: true });
    fs.writeFileSync(file, normalized, 'utf8');
    return;
  }

  const expected = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (expected === normalized) return;

  const drift = describeSectionDrift(expected, normalized);
  throw new Error(
    [
      `Golden prompt drift: ${name}`,
      `  file: ${path.relative(process.cwd(), file)}`,
      '',
      'Drifted sections:',
      ...(drift.length > 0 ? drift : ['  (no section boundary changed — whitespace or preamble only)']),
      '',
      'Changed lines:',
      ...changedLines(expected, normalized),
      '',
      'If this change is intended, re-record with:',
      '  POF_UPDATE_GOLDEN=1 npx vitest run src/__tests__/lib/prompts',
    ].join('\n'),
  );
}
