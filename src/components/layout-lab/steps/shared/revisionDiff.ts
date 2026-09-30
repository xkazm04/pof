import { GEN_HISTORY_KEY, readHistory } from './genHistory';

/**
 * Field-level diff between the step output on screen (`current`) and an archived revision
 * (`archived`) — what a restore would change, read before anything is written.
 *
 * Direction is always "restore": `added` = the archived version carries a key the current
 * output lacks, `removed` = restoring drops a key the current output has, `changed` shows
 * `from` (current) → `to` (archived). Values are short display strings, never payload dumps:
 * `genHistory` (a gallery's every re-roll batch) collapses to batch count + selected id.
 *
 * Pure + framework-free so the compare surface is unit-testable without the route.
 */
export type RevisionDiffKind = 'added' | 'removed' | 'changed';

export interface RevisionDiffRow {
  key: string;
  kind: RevisionDiffKind;
  /** Current display value (changed rows only). */
  from?: string;
  /** Archived display value (changed rows only). */
  to?: string;
  /** One-line summary replacing from/to where a raw value would be unreadable. */
  summary?: string;
}

/** Longest display value before truncation — a row is a line, not a document. */
const MAX_DISPLAY = 80;

/** Key-order-independent JSON, so a re-serialised object never reads as a change. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'undefined';
}

function clip(s: string): string {
  return s.length > MAX_DISPLAY ? `${s.slice(0, MAX_DISPLAY - 1)}…` : s;
}

/** Short human display of one value. */
export function displayValue(v: unknown): string {
  if (typeof v === 'string') return clip(v);
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`;
  if (v && typeof v === 'object') return clip(stable(v));
  return String(v);
}

/** "x → y" when the two differ, just "x" when they don't. */
function arrow(label: string, a: string, b: string): string {
  return a === b ? `${label} ${a}` : `${label} ${a} → ${b}`;
}

function genHistorySummary(current: unknown, archived: unknown): string {
  const a = readHistory({ [GEN_HISTORY_KEY]: current });
  const b = readHistory({ [GEN_HISTORY_KEY]: archived });
  const summary = [
    arrow('batches', String(a.batches.length), String(b.batches.length)),
    arrow('selected', a.selectedId ?? '—', b.selectedId ?? '—'),
  ].join(' · ');
  // Same count and selection but different contents (a re-rolled batch) — say so, briefly.
  return a.batches.length === b.batches.length && a.selectedId === b.selectedId
    ? `${summary} · candidates differ`
    : summary;
}

/** Diff two artifact `data` objects, rows sorted by key; unchanged keys are omitted. */
export function diffArtifactData(
  current: Record<string, unknown> | undefined,
  archived: Record<string, unknown> | undefined,
): RevisionDiffRow[] {
  const cur = current ?? {};
  const arc = archived ?? {};
  const keys = [...new Set([...Object.keys(cur), ...Object.keys(arc)])].sort();
  const rows: RevisionDiffRow[] = [];
  for (const key of keys) {
    const inCur = key in cur;
    const inArc = key in arc;
    if (!inCur) { rows.push({ key, kind: 'added' }); continue; }
    if (!inArc) { rows.push({ key, kind: 'removed' }); continue; }
    if (stable(cur[key]) === stable(arc[key])) continue;
    rows.push(
      key === GEN_HISTORY_KEY
        ? { key, kind: 'changed', summary: genHistorySummary(cur[key], arc[key]) }
        : { key, kind: 'changed', from: displayValue(cur[key]), to: displayValue(arc[key]) },
    );
  }
  return rows;
}

/** The content a revision carries — the same two fields `contentChanged` compares. */
export interface RevisionContent {
  data?: Record<string, unknown>;
  ueAssets?: string[];
}

/** Diff `data` plus `ueAssets` (UE asset paths are content, exactly as `contentChanged` treats them). */
export function diffRevision(current: RevisionContent, archived: RevisionContent): RevisionDiffRow[] {
  const rows = diffArtifactData(current.data, archived.data);
  const a = current.ueAssets ?? [];
  const b = archived.ueAssets ?? [];
  if (stable(a) !== stable(b)) {
    const adds = b.filter((p) => !a.includes(p));
    const drops = a.filter((p) => !b.includes(p));
    const parts = [
      adds.length ? `adds ${adds.join(', ')}` : '',
      drops.length ? `drops ${drops.join(', ')}` : '',
    ].filter(Boolean);
    rows.push({ key: 'ueAssets', kind: 'changed', summary: clip(parts.join(' · ') || 'order differs') });
  }
  return rows;
}
