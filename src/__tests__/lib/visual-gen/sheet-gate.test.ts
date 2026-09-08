import { describe, it, expect } from 'vitest';
import {
  gradeSheet,
  SHEET_SEAM_REFERENCE,
  SHEET_FLATNESS_NOT_SEPARABLE,
  type SheetGateInput,
} from '@/lib/visual-gen/sheet-gate';

/**
 * Every number below is MEASURED, not invented — from the first real contact sheet PoF
 * generated (`generated/images/qwen-image_1788892296725.png`, qwen-image-3.0-pro,
 * 1328x1328, 4x4, 16 bestiary portraits, one call). Captured 2026-09-08.
 */
const REAL_CELL_STDEV = [
  20.79, 24.05, 25.78, 31.1, 33.6, 17.21, 20.09, 28.25,
  22.83, 19.14, 23.89, 28.25, 22.4, 24.72, 10.66, 22.87,
];
const REAL_SEAMS = [4.254, 3.977, 3.705];
const REAL_INTERIOR = 4.98;

const realSheet = (over: Partial<SheetGateInput> = {}): SheetGateInput => ({
  cols: 4,
  rows: 4,
  deliveredWidth: 1328,
  deliveredHeight: 1328,
  cells: REAL_CELL_STDEV.map((stdev, index) => ({ index, id: `bestiary-${index}`, stdev })),
  seamContrasts: REAL_SEAMS,
  interiorContrast: REAL_INTERIOR,
  ...over,
});

describe('gradeSheet — geometry, which needs no calibration', () => {
  it('accepts the real delivered sheet and reports its exact cell size', () => {
    const g = gradeSheet(realSheet());
    expect(g.sliceable).toBe(true);
    expect(g.cellPx).toEqual({ w: 332, h: 332 });
    expect(g.squareCells).toBe(true);
    expect(g.reasons).toEqual([]);
  });

  it('refuses when the cell stats do not cover the grid — the cast/grid mismatch that mislabels every icon', () => {
    const g = gradeSheet(realSheet({ cells: realSheet().cells.slice(0, 12) }));
    expect(g.sliceable).toBe(false);
    expect(g.reasons.join(' ')).toMatch(/16.*12|12.*16/);
  });

  it('refuses a delivered image too small to cut the grid from', () => {
    const g = gradeSheet(realSheet({ deliveredWidth: 3, deliveredHeight: 1328 }));
    expect(g.sliceable).toBe(false);
    expect(g.reasons.join(' ')).toMatch(/3 px wide/);
  });

  it('stays sliceable but reports non-square cells when the provider changed the aspect', () => {
    // asked for 1328x1328, got 1024x768 — cells are 256x192, still cuttable, but stretched
    const g = gradeSheet(realSheet({ deliveredWidth: 1024, deliveredHeight: 768 }));
    expect(g.sliceable).toBe(true);
    expect(g.squareCells).toBe(false);
    expect(g.cellPx).toEqual({ w: 256, h: 192 });
  });
});

describe('gradeSheet — seam contrast, reported against a measured reference', () => {
  it('reports the real sheet ratio below 1 and cites the reference band', () => {
    const g = gradeSheet(realSheet());
    // max seam 4.254 / interior 4.98
    expect(g.seamRatio).toBeCloseTo(0.854, 3);
    expect(g.seamRatio!).toBeLessThan(1);
    expect(g.seamNote).toContain(String(SHEET_SEAM_REFERENCE.ratio));
  });

  it('names BOTH readings of a high ratio instead of picking one', () => {
    const g = gradeSheet(realSheet({ seamContrasts: [14.2, 3.9, 3.7] }));
    expect(g.seamRatio!).toBeGreaterThan(1);
    // drawn gridlines and subjects straddling the cut both raise it; saying which would be a guess
    expect(g.seamNote).toMatch(/grid line/i);
    expect(g.seamNote).toMatch(/spill|straddl/i);
  });

  it('returns null — never 0 — when seam contrast was not measured', () => {
    const g = gradeSheet(realSheet({ seamContrasts: undefined, interiorContrast: undefined }));
    expect(g.seamRatio).toBeNull();
    expect(g.seamNote).toMatch(/not measured/i);
  });
});

describe('gradeSheet — flatness is reported, never thresholded', () => {
  it('names the flattest cell with its number', () => {
    const g = gradeSheet(realSheet());
    expect(g.flattestCell).toEqual({ index: 14, id: 'bestiary-14', stdev: 10.66 });
  });

  it('carries the measured reason a blank-cell threshold is not offered', () => {
    // Measured on the same sheet: a backdrop-only 90x90 crop stdev 11.41, ABOVE the
    // flattest full cell at 10.66 — so luminance variance cannot separate the two.
    const g = gradeSheet(realSheet());
    expect(g.flatnessNote).toBe(SHEET_FLATNESS_NOT_SEPARABLE);
    expect(g.flatnessNote).toContain('11.41');
    expect(g.flatnessNote).toContain('10.66');
    expect(Object.keys(g)).not.toContain('blankCells');
  });
});
