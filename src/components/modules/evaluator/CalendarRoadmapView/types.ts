/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DeadlineMap {
  [milestoneId: string]: { targetDate: string; label: string };
}

export interface DragState {
  milestoneId: string;
  startX: number;
  originalDate: string;
  /** Latest dragged target (local-noon ISO) — read on mouseup to persist. */
  currentDate: string;
}
