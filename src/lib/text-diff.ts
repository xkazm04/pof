/** ── Line + word text diff ───────────────────────────────────────────────── *
 * A small, dependency-free diff engine used by the Prompt Optimizer to turn two
 * raw prompt blobs into a legible before/after story instead of two <pre> walls.
 *
 * It runs an LCS twice: once over lines (to align the two texts) and once over
 * the words of each *changed* line (so the specific edited words light up
 * inline). The result feeds both a unified column and a side-by-side split view.
 *
 * The line-level half mirrors the proven LCS in `sub_ability/forge/ability-diff`
 * but adds inline word segments + paired split rows, and stays domain-free so
 * any before/after text can reuse it.
 * ────────────────────────────────────────────────────────────────────────── */

export type DiffChangeType = 'eq' | 'add' | 'del';

/** A word-level (or whitespace) run within a line, tagged for inline highlight. */
export interface DiffWordSegment {
  type: DiffChangeType;
  text: string;
}

/**
 * One rendered line. `segments` carry word-level highlights: a `del` row holds
 * only `eq`+`del` segments (so it reconstructs the original line), an `add` row
 * only `eq`+`add` (the optimized line), and an `eq` row a single `eq` segment.
 */
export interface DiffRow {
  type: DiffChangeType;
  /** 1-based line number on the original side; null for pure insertions. */
  beforeNo: number | null;
  /** 1-based line number on the optimized side; null for pure deletions. */
  afterNo: number | null;
  segments: DiffWordSegment[];
}

/** A split-view row: original on the left, optimized on the right. */
export interface DiffSplitRow {
  left: DiffRow | null;
  right: DiffRow | null;
}

export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
}

export interface PromptDiff {
  /** Rows in document order — deletions before insertions within each hunk. */
  unified: DiffRow[];
  /** Same content paired left/right for a side-by-side view. */
  split: DiffSplitRow[];
  summary: DiffSummary;
}

/** Flatten a row's segments back to its plain line text. */
export function rowText(row: DiffRow): string {
  return row.segments.map((s) => s.text).join('');
}

// ── LCS core ──────────────────────────────────────────────────────────────

interface LcsOp<T> {
  type: DiffChangeType;
  a: T | null;
  b: T | null;
}

/** Classic LCS backtrace over two arrays, yielding eq/del/add ops in order. */
function lcsOps<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): LcsOp<T>[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i:] and b[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: LcsOp<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      out.push({ type: 'eq', a: a[i], b: b[j] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', a: a[i], b: null });
      i++;
    } else {
      out.push({ type: 'add', a: null, b: b[j] });
      j++;
    }
  }
  while (i < n) { out.push({ type: 'del', a: a[i], b: null }); i++; }
  while (j < m) { out.push({ type: 'add', a: null, b: b[j] }); j++; }
  return out;
}

// ── Word-level diff ─────────────────────────────────────────────────────────

/** Split a line into word + whitespace tokens, preserving the whitespace runs. */
function tokenizeWords(line: string): string[] {
  return line.split(/(\s+)/).filter((t) => t.length > 0);
}

/** Coalesce neighbouring segments of the same type into one span. */
function mergeSegments(segs: DiffWordSegment[]): DiffWordSegment[] {
  const out: DiffWordSegment[] = [];
  for (const seg of segs) {
    const last = out[out.length - 1];
    if (last && last.type === seg.type) last.text += seg.text;
    else out.push({ type: seg.type, text: seg.text });
  }
  return out;
}

/** Word-level diff of two lines → eq/del/add segments in reading order. */
function wordSegments(before: string, after: string): DiffWordSegment[] {
  const ops = lcsOps(tokenizeWords(before), tokenizeWords(after), (x, y) => x === y);
  const segs: DiffWordSegment[] = ops.map((op) => ({
    type: op.type,
    text: (op.type === 'add' ? op.b : op.a) ?? '',
  }));
  return mergeSegments(segs);
}

/** Drop segments of `omit`, then re-merge so a side reads as one clean span set. */
function sideSegments(pairSegs: DiffWordSegment[], omit: DiffChangeType): DiffWordSegment[] {
  return mergeSegments(pairSegs.filter((s) => s.type !== omit));
}

function ensureSegs(segs: DiffWordSegment[], type: DiffChangeType): DiffWordSegment[] {
  return segs.length ? segs : [{ type, text: '' }];
}

// ── Public entry point ──────────────────────────────────────────────────────

function splitLines(s: string): string[] {
  return s.length ? s.split('\n') : [];
}

/**
 * Diff two prompt blobs into unified + split rows with inline word highlights.
 * Within a changed hunk, the k-th deleted line is paired with the k-th inserted
 * line for word-level alignment; leftover lines on either side render whole-line.
 */
export function diffPrompts(before: string, after: string): PromptDiff {
  const lineOps = lcsOps(splitLines(before), splitLines(after), (x, y) => x === y);

  const unified: DiffRow[] = [];
  const split: DiffSplitRow[] = [];
  let beforeNo = 0;
  let afterNo = 0;

  let dels: string[] = [];
  let adds: string[] = [];

  const flush = (): void => {
    if (dels.length === 0 && adds.length === 0) return;
    const paired = Math.min(dels.length, adds.length);
    const pairSegs = Array.from({ length: paired }, (_, k) => wordSegments(dels[k], adds[k]));

    const delRows: DiffRow[] = dels.map((text, k) => ({
      type: 'del',
      beforeNo: ++beforeNo,
      afterNo: null,
      segments: ensureSegs(k < paired ? sideSegments(pairSegs[k], 'add') : [{ type: 'del', text }], 'del'),
    }));
    const addRows: DiffRow[] = adds.map((text, k) => ({
      type: 'add',
      beforeNo: null,
      afterNo: ++afterNo,
      segments: ensureSegs(k < paired ? sideSegments(pairSegs[k], 'del') : [{ type: 'add', text }], 'add'),
    }));

    unified.push(...delRows, ...addRows);
    const span = Math.max(delRows.length, addRows.length);
    for (let k = 0; k < span; k++) {
      split.push({ left: delRows[k] ?? null, right: addRows[k] ?? null });
    }

    dels = [];
    adds = [];
  };

  for (const op of lineOps) {
    if (op.type === 'eq') {
      flush();
      const row: DiffRow = {
        type: 'eq',
        beforeNo: ++beforeNo,
        afterNo: ++afterNo,
        segments: [{ type: 'eq', text: op.a ?? '' }],
      };
      unified.push(row);
      split.push({ left: row, right: row });
    } else if (op.type === 'del') {
      dels.push(op.a ?? '');
    } else {
      adds.push(op.b ?? '');
    }
  }
  flush();

  const summary: DiffSummary = { added: 0, removed: 0, unchanged: 0 };
  for (const r of unified) {
    if (r.type === 'add') summary.added++;
    else if (r.type === 'del') summary.removed++;
    else summary.unchanged++;
  }

  return { unified, split, summary };
}
