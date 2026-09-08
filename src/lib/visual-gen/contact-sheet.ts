/**
 * Contact-sheet generation — one image call that returns a whole SET, sliced by index.
 *
 * PoF generates set art one call at a time: `scripts/gap-loop/batch-generate.mjs` loops
 * targets and posts one prompt per target. That costs N generations for N members and,
 * worse, gives no set coherence — `kit-coherence.ts` measured independently generated
 * assets at dE 8.0-21.5 apart while a re-render of the same asset sits at 0.0-1.8.
 * Style DNA narrows what is ASKED for; it cannot make two separate calls agree.
 *
 * A contact sheet inverts that: ONE model pass renders every member of the set into one
 * grid image, so shared lighting, brushwork and framing are structural rather than
 * requested, and the cost is one generation for the whole set.
 *
 * PoF was already half-way here and could not use it. Two entries in
 * `batch-generate.mjs` ask for a "glyph sheet" / "texture sheet", and the 2D provider
 * registry recommends Qwen-Image "for icon sheets, HUD mockups and labelled plates" —
 * but nothing slices. A returned sheet was one opaque file with no cell geometry and no
 * index -> identity mapping: art for N entities, structurally unaddressable, exactly the
 * defect `generated-icons.ts` describes for FILENAMES, one level up inside the image.
 *
 * ── The two halves must derive from ONE ordering ─────────────────────────────────
 * The prompt lists the cast row-by-row, left to right; {@link sheetCells} indexes
 * row-major. If those ever disagree the failure is silent and total — every icon lands
 * on the wrong entity while every file looks fine — so both are built here, from the
 * same array, and the mapping is asserted in one test.
 *
 * ── Slice the DELIVERED image, never the requested size ──────────────────────────
 * {@link buildContactSheetPrompt} takes the size to ASK for; {@link contactSheetCells}
 * takes the width/height actually read back from the returned bytes. A provider that
 * returns 1024 for a requested 1328 would otherwise shift every crop.
 *
 * The prompt's constraint set is not invented here. It reproduces the load-bearing
 * clauses of a hand-authored production sheet prompt that shipped 108 real portraits as
 * three 6x6 sheets (awesome-gpt-6-astra, `works/three-kingdoms/docs/portrait-prompts/`),
 * and `contact-sheet.test.ts` pins them against that ground truth.
 */
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';

/** Verified-live square size for Qwen-Image 3.0-pro (see `qwen-image-runner.ts`). */
export const DEFAULT_SHEET_PX = 1328;

/**
 * The clause that stops a text-strong generator from lettering the cells. Qwen-Image is
 * picked for sheets precisely because it renders readable text — which is why the cast
 * names have to be marked as instructions, or they arrive painted onto the portraits.
 */
export const SHEET_TEXT_BAN =
  'Text: NONE. The cast names below are only identity/order instructions and MUST NOT appear visually.';

export interface SheetSubject {
  /** Stable identity this cell belongs to — an entity id, a step slug, a glyph name. */
  id: string;
  /** The visual brief for this cell, e.g. 'rugged general with one eye patch'. */
  brief: string;
}

export interface ContactSheetSpec {
  cols: number;
  rows: number;
  /** The noun for one cell, e.g. 'game UI item icon', 'head-and-shoulders portrait'. */
  cellSubject: string;
  /** The shared medium/brushwork clause — the coherence lever every cell obeys. */
  style: string;
  /** What sits behind each subject. */
  background: string;
  /** Optional per-SET accent that makes one set read as a family (faction, tier, biome). */
  accent?: string;
  /** Row-major, left to right. Length must be exactly `cols * rows`. */
  cast: SheetSubject[];
  /** Size to ASK the provider for. Slicing uses the delivered size, not this. */
  width?: number;
  height?: number;
}

export interface SheetCell {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface IdentifiedCell extends SheetCell {
  id: string;
  brief: string;
}

/**
 * Integer cell rects that tile `width` x `height` EXACTLY — row-major.
 *
 * The remainder matters: 1328 / 6 is 221.33, and flooring every cell loses two pixel
 * columns off the right edge, which crops the last column's subject on every sheet.
 * The first `width % cols` columns take one extra pixel instead, so the union of the
 * rects is the whole image, once.
 */
export function sheetCells(cols: number, rows: number, width: number, height: number): SheetCell[] {
  const spans = (total: number, n: number): { start: number; size: number }[] => {
    const base = Math.floor(total / n);
    const extra = total % n;
    const out: { start: number; size: number }[] = [];
    let start = 0;
    for (let i = 0; i < n; i++) {
      const size = base + (i < extra ? 1 : 0);
      out.push({ start, size });
      start += size;
    }
    return out;
  };
  const xs = spans(width, cols);
  const ys = spans(height, rows);
  const cells: SheetCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        index: row * cols + col,
        row,
        col,
        x: xs[col].start,
        y: ys[row].start,
        w: xs[col].size,
        h: ys[row].size,
      });
    }
  }
  return cells;
}

/** Cells bound to the cast member the prompt listed at that position. */
export function contactSheetCells(
  spec: ContactSheetSpec,
  width: number,
  height: number,
): IdentifiedCell[] {
  return sheetCells(spec.cols, spec.rows, width, height).map((c) => ({
    ...c,
    id: spec.cast[c.index]?.id ?? '',
    brief: spec.cast[c.index]?.brief ?? '',
  }));
}

/** The row-by-row cast listing the slicer's row-major order corresponds to. */
function castLines(spec: ContactSheetSpec): string {
  const lines: string[] = [];
  for (let row = 0; row < spec.rows; row++) {
    const briefs = spec.cast.slice(row * spec.cols, (row + 1) * spec.cols).map((s) => s.brief);
    lines.push(`Row ${row + 1}: ${briefs.join('; ')}.`);
  }
  return lines.join('\n');
}

/**
 * The sheet prompt, or a refusal naming both numbers when the cast does not fill the
 * grid. A short cast is the one failure that must never reach a provider: the model
 * fills the empty cells with inventions and the slicer hands them stable entity ids.
 */
export function buildContactSheetPrompt(spec: ContactSheetSpec): Result<string, string> {
  const n = spec.cols * spec.rows;
  if (spec.cols < 1 || spec.rows < 1) return err('a contact sheet needs at least 1 column and 1 row');
  if (spec.cast.length !== n) {
    return err(
      `cast does not fill the grid: ${spec.cols}x${spec.rows} needs ${n} subjects, got ${spec.cast.length}`,
    );
  }
  const w = spec.width ?? DEFAULT_SHEET_PX;
  const h = spec.height ?? DEFAULT_SHEET_PX;
  const square = Math.round(w / spec.cols) === Math.round(h / spec.rows);
  const sizeWord = square ? 'equal square size' : 'equal size';

  return ok(
    [
      `Asset type: production-ready ${n}-cell contact sheet of ${spec.cellSubject}s for a game.`,
      `Primary request: Create ONE ${w}x${h} raster image consisting of an exactly regular ` +
        `${spec.cols} columns by ${spec.rows} rows contact sheet, exactly ${n} distinct ` +
        `${spec.cellSubject}s. All ${n} cells are ${sizeWord}, fill the canvas edge-to-edge, and ` +
        `are arranged as a strict Cartesian grid suitable for cropping at x,y multiples of ` +
        `1/${spec.cols} of the width and 1/${spec.rows} of the height: no outer margins, ` +
        `no gutters, no visible grid lines, no frames or boxes.`,
      `Style/medium: ${spec.style}. Consistent brushwork, lighting, framing and detail across all ${n} cells.`,
      `Backdrop: every cell has its own ${spec.background}.`,
      `Composition/framing: EXACTLY ONE subject per cell, centered in its own cell, the entire ` +
        `subject fitting inside its own cell with breathing room; never allow a subject or its ` +
        `adornments to spill into a neighbor's cell. Each subject large and legible at small ` +
        `size, with a distinct silhouette — no repeated subjects.`,
      ...(spec.accent ? [`Set accent: ${spec.accent}, shared by every cell.`] : []),
      SHEET_TEXT_BAN,
      `Constraints: original artwork, no logos, no lettering, no numbers, no labels, no ` +
        `watermarks, no inset vignettes. Maintain exactly ${spec.cols} equal columns and ` +
        `${spec.rows} equal rows, ${n} cells. Respect the following row-by-row left-to-right ` +
        `ordered cast precisely.`,
      castLines(spec),
    ].join('\n'),
  );
}
