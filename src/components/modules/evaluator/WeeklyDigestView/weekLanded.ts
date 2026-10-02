import { SUB_MODULES } from '@/lib/module-registry';
import { addDaysToKey, zoneDayStart } from '@/lib/analytics/report-window';
import type { ChecklistProgress, CompletionLedger } from '@/lib/roadmap/completion-ledger';
import type { WeeklyDigest } from '@/types/weekly-digest';

// ── What landed in a week ─────────────────────────────────────────────────────
//
// Reads the dated completion ledger (moduleStore.checklistCompletedAt, adopted from the
// project_progress row owned by src/lib/project-progress-db.ts). A done item with no
// stamp is UNDATED: disclosed as a count, never placed in any week. A delta with no
// dated sample on either side is null — unmeasured is not "no change".

/** Half-open [start, end) window in epoch ms. */
export interface EpochWindow {
  start: number;
  end: number;
}

export interface LandedItem {
  moduleId: string;
  moduleLabel: string;
  itemId: string;
  label: string;
  /** Epoch ms of the first completion. */
  at: number;
}

export interface WeekLanded {
  /** Done items stamped inside the window, oldest first. */
  items: LandedItem[];
  count: number;
  /** Done items stamped inside the previous window. */
  prevCount: number;
  /** count - prevCount; null when neither week has a dated stamp but undated completions exist. */
  delta: number | null;
  /** Done items dated before the window's end (the checklist as it stood then). */
  doneByEnd: number;
  /** Done items with no stamp — counted apart, never bucketed. */
  undated: number;
}

interface ItemMeta {
  moduleLabel: string;
  label: string;
}

/** moduleId -> itemId -> labels, for every registry checklist item (static). */
const ITEM_META: Record<string, Record<string, ItemMeta>> = Object.fromEntries(
  SUB_MODULES.filter((m) => m.checklist && m.checklist.length > 0).map((m) => [
    m.id,
    Object.fromEntries(m.checklist!.map((c) => [c.id, { moduleLabel: m.label, label: c.label }])),
  ]),
);

const inWindow = (at: number, w: EpochWindow) => at >= w.start && at < w.end;

/**
 * Pure: bucket the DONE registry items of `progress` by their ledger stamp. `prevWindow`
 * defaults to the equal-length span immediately before `window`.
 */
export function weekLanded(
  progress: ChecklistProgress,
  ledger: CompletionLedger,
  window: EpochWindow,
  prevWindow: EpochWindow = { start: window.start - (window.end - window.start), end: window.start },
): WeekLanded {
  const items: LandedItem[] = [];
  let prevCount = 0;
  let doneByEnd = 0;
  let undated = 0;

  for (const [moduleId, meta] of Object.entries(ITEM_META)) {
    const done = progress[moduleId];
    if (!done) continue;
    const stamps = ledger[moduleId] ?? {};
    for (const [itemId, m] of Object.entries(meta)) {
      if (done[itemId] !== true) continue;
      const at = stamps[itemId];
      if (typeof at !== 'number' || !Number.isFinite(at)) {
        undated += 1;
        continue;
      }
      if (at < window.end) doneByEnd += 1;
      if (inWindow(at, window)) items.push({ moduleId, moduleLabel: m.moduleLabel, itemId, label: m.label, at });
      else if (inWindow(at, prevWindow)) prevCount += 1;
    }
  }

  items.sort((a, b) => a.at - b.at);
  const count = items.length;
  const unmeasured = count === 0 && prevCount === 0 && undated > 0;
  return { items, count, prevCount, delta: unmeasured ? null : count - prevCount, doneByEnd, undated };
}

/** The digest's week and the week before, cut in the digest's zone (the server's edges). */
export function digestWindows(
  d: Pick<WeeklyDigest, 'periodStart' | 'periodEnd' | 'zone'>,
): { window: EpochWindow; prevWindow: EpochWindow } {
  const start = Date.parse(zoneDayStart(d.periodStart, d.zone));
  return {
    window: { start, end: Date.parse(zoneDayStart(d.periodEnd, d.zone)) },
    prevWindow: { start: Date.parse(zoneDayStart(addDaysToKey(d.periodStart, -7), d.zone)), end: start },
  };
}
