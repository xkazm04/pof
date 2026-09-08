/**
 * Sheet gate — is a delivered contact sheet actually safe to cut into per-entity art?
 *
 * A sheet is different from every other generated image PoF grades: one bad sheet does
 * not produce one bad asset, it produces N assets each filed under a real entity id.
 * The cheap failures are structural — a provider that ignored the grid, a cast that did
 * not fill it, cells the model drew a frame around — and they are invisible once the
 * crops are on disk under confident names.
 *
 * ── What this grades, and what it deliberately refuses to grade ──────────────────
 * GEOMETRY is decided, because it needs no calibration: the delivered bytes either
 * divide into `cols x rows` cells or they do not, and the stat list either covers every
 * cell or it does not. Those are the two failures that mislabel art.
 *
 * SEAM CONTRAST is reported as a number against a measured reference, never as a
 * verdict. A high ratio has two opposite causes — the model drew visible grid lines, or
 * subjects straddle the cut — and this instrument cannot tell them apart, so it says
 * both rather than guessing one.
 *
 * BLANK-CELL DETECTION IS NOT OFFERED, and that is a measured result, not an omission.
 * The obvious gate is "a cell with near-zero luminance variance holds no subject". On
 * the first real sheet that threshold cannot exist: the flattest FULL cell (a masked
 * assassin on a dark ground) measured stdev 10.66, while a 90x90 backdrop-only crop of
 * the same sheet measured 11.41. Atmospheric backdrops are textured and dark subjects
 * are low-contrast, so the two populations overlap. Any threshold here would pass its
 * own tests and never fire correctly on real art. See {@link SHEET_FLATNESS_NOT_SEPARABLE}.
 * The flattest cell is NAMED with its number instead, so a reader can look at one cell.
 *
 * Reference numbers come from `generated/images/qwen-image_1788892296725.png` —
 * qwen-image-3.0-pro, 1328x1328, 4x4, 16 bestiary portraits, one call, 2026-09-08.
 */

/**
 * Seam-to-interior contrast measured on the first clean sheet: max interior grid-line
 * gradient 4.254 against a mean in-cell gradient of 4.98. Below 1 means the cuts are
 * quieter than the art around them, which is what an unframed, non-spilling grid looks
 * like. One sheet is a reference point, not a calibration set.
 */
export const SHEET_SEAM_REFERENCE = {
  ratio: 0.85,
  cols: 4,
  rows: 4,
  px: 1328,
  source: 'qwen-image_1788892296725.png (qwen-image-3.0-pro, one call, 2026-09-08)',
} as const;

export const SHEET_FLATNESS_NOT_SEPARABLE =
  'no blank-cell threshold is offered: on the reference sheet the flattest full cell measured ' +
  'stdev 10.66 while a backdrop-only crop of the same sheet measured 11.41, so luminance ' +
  'variance does not separate an empty cell from bare backdrop on this art — read the named cell';

export interface SheetCellStat {
  index: number;
  /** The identity this cell will be filed under if the sheet is cut. */
  id: string;
  /** Luminance standard deviation over the cell, 0-255. */
  stdev: number;
}

export interface SheetGateInput {
  cols: number;
  rows: number;
  /** Dimensions read back from the DELIVERED bytes — never the requested size. */
  deliveredWidth: number;
  deliveredHeight: number;
  cells: SheetCellStat[];
  /** Mean |luminance gradient| across each interior cut. Absent = not measured. */
  seamContrasts?: number[];
  /** Mean |luminance gradient| across the columns that are not cuts. */
  interiorContrast?: number;
}

export interface SheetGateVerdict {
  /** Can N cells be cut from these bytes and filed under the given ids at all. */
  sliceable: boolean;
  /** Why not, when not. Empty when sliceable. */
  reasons: string[];
  cellPx: { w: number; h: number } | null;
  squareCells: boolean;
  /** max(seam) / interior, or null when it was not measured. Never 0 as a stand-in. */
  seamRatio: number | null;
  seamNote: string;
  /** The cell a reader should look at first. */
  flattestCell: SheetCellStat | null;
  flatnessNote: string;
  /** Always true: numbers to read, not a pipeline gate. */
  advisory: true;
}

/** Grade a delivered contact sheet. Pure. */
export function gradeSheet(input: SheetGateInput): SheetGateVerdict {
  const { cols, rows, deliveredWidth: w, deliveredHeight: h } = input;
  const expected = cols * rows;
  const reasons: string[] = [];

  if (cols < 1 || rows < 1) reasons.push(`a grid needs at least 1 column and 1 row, got ${cols}x${rows}`);
  if (!(w > 0) || !(h > 0)) reasons.push('the delivered image reported no dimensions, so nothing can be cut from it');
  if (w > 0 && w < cols) reasons.push(`the delivered image is ${w} px wide, narrower than its ${cols} columns`);
  if (h > 0 && h < rows) reasons.push(`the delivered image is ${h} px tall, shorter than its ${rows} rows`);
  if (input.cells.length !== expected) {
    reasons.push(
      `the grid has ${expected} cells but ${input.cells.length} cell stats were measured — ` +
        'cutting on a mismatch files art under the wrong identities',
    );
  }

  const cellPx =
    w >= cols && h >= rows ? { w: Math.floor(w / cols), h: Math.floor(h / rows) } : null;

  const seams = input.seamContrasts ?? [];
  const interior = input.interiorContrast;
  const measured = seams.length > 0 && typeof interior === 'number' && interior > 0;
  const seamRatio = measured ? Math.max(...seams) / interior! : null;
  const seamNote = !measured
    ? 'seam contrast was not measured for this sheet'
    : `max seam / interior = ${seamRatio!.toFixed(3)} (reference ${SHEET_SEAM_REFERENCE.ratio} on ` +
      `${SHEET_SEAM_REFERENCE.source}). ` +
      (seamRatio! > 1
        ? 'Above 1 the cuts carry more contrast than the art around them, which means either the ' +
          'model drew visible grid lines or frames, or subjects spill across and straddle the cut — ' +
          'this measurement cannot tell those apart, so look at one seam before deciding'
        : 'Below 1 the cuts are quieter than the surrounding art — no drawn grid lines, no obvious spill');

  const flattestCell =
    input.cells.length > 0
      ? input.cells.reduce((min, c) => (c.stdev < min.stdev ? c : min))
      : null;

  return {
    sliceable: reasons.length === 0,
    reasons,
    cellPx,
    squareCells: cellPx !== null && cellPx.w === cellPx.h,
    seamRatio,
    seamNote,
    flattestCell,
    flatnessNote: SHEET_FLATNESS_NOT_SEPARABLE,
    advisory: true,
  };
}
