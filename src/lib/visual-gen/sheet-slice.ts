/**
 * Contact sheet -> N addressable per-entity icons, in one generation.
 *
 * This is the half that makes {@link buildContactSheetPrompt} worth anything. A sheet
 * PoF cannot cut is one opaque file; a sheet PoF cuts under `iconFileBase(catalog, step,
 * entity)` names becomes N icons the existing library already resolves, entity-first,
 * with the per-step icon as the fallback (`generated-icons.ts`).
 *
 * ── Order of operations, and why ─────────────────────────────────────────────────
 * generate -> read the DELIVERED dimensions -> lay the grid on those -> measure ->
 * {@link gradeSheet} -> cut only if the grade says the bytes can be cut. A sheet that
 * fails the grade is NOT discarded: its url comes back with the verdict, because the art
 * exists and a human can look at it. What must not happen is cutting anyway and filing
 * sixteen crops under sixteen real entity ids on a grid that was never there.
 *
 * Every I/O is injected — no test generates, measures or writes anything real.
 */
import {
  buildContactSheetPrompt,
  contactSheetCells,
  type ContactSheetSpec,
  type SheetCell,
} from './contact-sheet';
import { gradeSheet, type SheetGateVerdict } from './sheet-gate';
import { iconFileBase } from './generated-icons';

export interface SheetImageOps {
  dimensions(path: string): Promise<{ width: number; height: number }>;
  /** Per-cell luminance stdev, plus the interior-cut gradients the gate compares. */
  stats(
    path: string,
    cells: SheetCell[],
    seamXs: number[],
  ): Promise<{ cellStdev: number[]; seams: number[]; interior: number }>;
  cut(path: string, cell: SheetCell, outPath: string): Promise<void>;
}

export interface SheetRunDeps {
  /** Runs the prompt through a 2D provider and returns where the bytes landed. */
  generate(prompt: string): Promise<{ ok: boolean; error?: string; refused?: boolean; path?: string; url?: string; model?: string }>;
  image: SheetImageOps;
  /** Absolute, forward-slashed dir the cut icons land in (`<cwd>/generated/icons`). */
  iconDir: string;
}

export interface SheetRunRequest {
  spec: ContactSheetSpec;
  catalogId: string;
  step: string;
}

export interface CutIcon {
  entityId: string;
  file: string;
  url: string;
}

export type SheetRunResult =
  | { ok: false; refused?: boolean; error: string; sheetUrl?: string; verdict?: SheetGateVerdict }
  | { ok: true; sheetUrl: string; model?: string; verdict: SheetGateVerdict; icons: CutIcon[] };

export function iconUrl(name: string): string {
  return `/api/visual-gen/icon/${encodeURIComponent(name)}`;
}

export async function runContactSheet(
  req: SheetRunRequest,
  deps: SheetRunDeps,
): Promise<SheetRunResult> {
  const { spec, catalogId, step } = req;

  const prompt = buildContactSheetPrompt(spec);
  if (!prompt.ok) return { ok: false, refused: true, error: prompt.error };

  const gen = await deps.generate(prompt.data);
  if (!gen.ok || !gen.path) {
    return { ok: false, refused: gen.refused, error: gen.error ?? 'the provider failed without a reason' };
  }

  let width = 0;
  let height = 0;
  try {
    ({ width, height } = await deps.image.dimensions(gen.path));
  } catch {
    // Unreadable bytes are a real outcome, not a crash: the gate below refuses on
    // zero dimensions and says so, and the sheet url still comes back.
  }
  // The cast IS the identity list — a second parallel array of entity ids would be a
  // second source of truth for the one mapping that must never drift.
  const cells = width > 0 && height > 0 ? contactSheetCells(spec, width, height) : [];
  const seamXs = cells.filter((c) => c.row === 0 && c.col > 0).map((c) => c.x);
  const measured = cells.length
    ? await deps.image.stats(gen.path, cells, seamXs)
    : { cellStdev: [], seams: [], interior: 0 };

  const verdict = gradeSheet({
    cols: spec.cols,
    rows: spec.rows,
    deliveredWidth: width,
    deliveredHeight: height,
    cells: cells.map((c, i) => ({ index: c.index, id: c.id, stdev: measured.cellStdev[i] ?? 0 })),
    seamContrasts: measured.seams.length ? measured.seams : undefined,
    interiorContrast: measured.interior > 0 ? measured.interior : undefined,
  });

  if (!verdict.sliceable) {
    return {
      ok: false,
      error: `the sheet was generated but not cut: ${verdict.reasons.join('; ')}`,
      sheetUrl: gen.url,
      verdict,
    };
  }

  const icons: CutIcon[] = [];
  for (const cell of cells) {
    const file = `${iconFileBase(catalogId, step, cell.id)}.png`;
    await deps.image.cut(gen.path, cell, `${deps.iconDir}/${file}`);
    icons.push({ entityId: cell.id, file, url: iconUrl(file) });
  }

  return { ok: true, sheetUrl: gen.url ?? '', model: gen.model, verdict, icons };
}
