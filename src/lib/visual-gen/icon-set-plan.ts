/**
 * Icon set planning — which entities of a (catalog, step) lack art of their OWN, and the
 * contact sheets that would fill exactly those. Pure and client-safe: no request, no spend.
 *
 * The app already held all three inputs and joined none of them: coverage lives in the icon
 * library listing (`GET /api/visual-gen/icons`, read through the library door), the cast lives in
 * `GET /api/catalog/entities`, and the grid-fill rule lives in {@link buildContactSheetPrompt}.
 * A caller of `/api/visual-gen/contact-sheet` had to hand-pick cols x rows equal to its cast or be
 * refused. This module is that join, and the free gate in front of the paid sheet.
 *
 * ── Coverage is ENTITY art only ───────────────────────────────────────────────────
 * An entity is covered only by an icon filed under its own `(catalog, entity, step)` identity
 * (`iconsForEntityStep`). The per-step icon is a fallback for display; counting it would mark
 * every entity of the step as "has art" off one shared picture.
 *
 * ── Grids ───────────────────────────────────────────────────────────────────────
 * Every sheet is an exact-fill grid from {@link SHEET_GRIDS}: at most 16 cells, cols >= rows, and
 * cells no taller than 2:1 on the square sheet. N entities are split into the FEWEST sheets
 * (ties: the larger sheet first), so 18 -> 16 + 2 and 15 -> 9 + 6 rather than 12 + 2 + 1.
 * Entities of different canon profiles never share a sheet: a sheet has one Style line, and
 * the route resolves that line per profile.
 */
import { ok, err, type Result } from '@/types/result';
import { buildContactSheetPrompt, DEFAULT_SHEET_PX, type ContactSheetSpec } from '@/lib/visual-gen/contact-sheet';
import { iconsForEntityStep, type GeneratedIcon } from '@/lib/visual-gen/generated-icons';

/** The 2D provider the contact-sheet route calls by default — the one the panel checks capability for. */
export const SHEET_PROVIDER_ID = 'qwen-image';

/** The sheet prompt's defaults — the route's AND the preview's, so the previewed prompt is the sent one. */
export const SHEET_DEFAULTS = {
  cellSubject: 'game entity icon',
  style: 'painterly dark-fantasy ARPG art',
  background: 'subtle deep charcoal atmospheric background',
} as const;

/** The exact-fill grids a sheet may use, largest first. */
export const SHEET_GRIDS: readonly { cells: number; cols: number; rows: number }[] = [
  { cells: 16, cols: 4, rows: 4 },
  { cells: 12, cols: 4, rows: 3 },
  { cells: 9, cols: 3, rows: 3 },
  { cells: 8, cols: 4, rows: 2 },
  { cells: 6, cols: 3, rows: 2 },
  { cells: 4, cols: 2, rows: 2 },
  { cells: 2, cols: 2, rows: 1 },
  { cells: 1, cols: 1, rows: 1 },
];

export interface IconSetEntity {
  id: string;
  name: string;
  /** The entity's canon profile (`canonProfileOf`); absent = the project's own. */
  canonProfile?: string;
}

export interface IconSetCastMember {
  entityId: string;
  brief: string;
}

export interface PlannedSheet {
  cols: number;
  rows: number;
  /** Row-major, left to right — exactly `cols * rows` members. */
  cast: IconSetCastMember[];
  squareCells: boolean;
  /** The canon profile every cast member shares, when the entities declare one. */
  canonProfile?: string;
}

export interface IconSetPlan {
  catalogId: string;
  step: string;
  covered: string[];
  missing: string[];
  sheets: PlannedSheet[];
  /** Paid generations the plan costs — one per sheet. */
  generations: number;
  /** What the same cast costs one prompt per entity. */
  perEntityCalls: number;
}

export interface IconSetPlanInput {
  catalogId: string;
  step: string;
  entities: IconSetEntity[];
  icons: GeneratedIcon[];
  /** Edited briefs by entity id; an absent key means the entity's name. */
  briefs?: Record<string, string>;
  /** Re-draw entities that already have their own art too. */
  reroll?: boolean;
}

/** Which entities have art of their own at this step, and which do not. Pure. */
export function iconCoverage(
  catalogId: string,
  step: string,
  entities: IconSetEntity[],
  icons: GeneratedIcon[],
): { covered: string[]; missing: string[] } {
  const covered: string[] = [];
  const missing: string[] = [];
  for (const e of entities) {
    (iconsForEntityStep(icons, catalogId, step, e.id).length > 0 ? covered : missing).push(e.id);
  }
  return { covered, missing };
}

const lexGreater = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

/** Sheet sizes for `n` cast members: fewest sheets, larger sheet first. Pure. */
export function sheetSizes(n: number): number[] {
  const best: number[][] = [[]];
  for (let k = 1; k <= n; k++) {
    let pick: number[] | null = null;
    for (const g of SHEET_GRIDS) {
      if (g.cells > k) continue;
      const cand = [g.cells, ...best[k - g.cells]].sort((x, y) => y - x);
      if (!pick || cand.length < pick.length || (cand.length === pick.length && lexGreater(cand, pick))) pick = cand;
    }
    best.push(pick ?? []);
  }
  return best[n] ?? [];
}

/** The plan, or a refusal naming the entity whose brief is blank. Pure. */
export function planIconSet(input: IconSetPlanInput): Result<IconSetPlan, string> {
  const { catalogId, step, entities, icons, briefs = {}, reroll = false } = input;
  const { covered, missing } = iconCoverage(catalogId, step, entities, icons);
  const wanted = new Set(reroll ? [...covered, ...missing] : missing);
  const castEntities = entities.filter((e) => wanted.has(e.id));

  const groups = new Map<string, IconSetCastMember[]>();
  for (const e of castEntities) {
    const brief = (Object.prototype.hasOwnProperty.call(briefs, e.id) ? briefs[e.id] : e.name).trim();
    if (!brief) return err(`entity "${e.id}" has a blank brief — a blank brief buys a random cell`);
    const key = e.canonProfile ?? '';
    groups.set(key, [...(groups.get(key) ?? []), { entityId: e.id, brief }]);
  }

  const sheets: PlannedSheet[] = [];
  for (const [profile, cast] of groups) {
    let at = 0;
    for (const size of sheetSizes(cast.length)) {
      const grid = SHEET_GRIDS.find((g) => g.cells === size)!;
      sheets.push({
        cols: grid.cols,
        rows: grid.rows,
        cast: cast.slice(at, at + size),
        squareCells: grid.cols === grid.rows,
        ...(profile ? { canonProfile: profile } : {}),
      });
      at += size;
    }
  }
  return ok({ catalogId, step, covered, missing, sheets, generations: sheets.length, perEntityCalls: castEntities.length });
}

/** The spec the route builds for this sheet from the same defaults. */
export function sheetSpec(sheet: PlannedSheet): ContactSheetSpec {
  return {
    cols: sheet.cols,
    rows: sheet.rows,
    ...SHEET_DEFAULTS,
    cast: sheet.cast.map((c) => ({ id: c.entityId, brief: c.brief })),
    width: DEFAULT_SHEET_PX,
    height: DEFAULT_SHEET_PX,
  };
}

/** The exact prompt the route would send for this sheet (default Style line) — free to preview. */
export function sheetPrompt(sheet: PlannedSheet): Result<string, string> {
  return buildContactSheetPrompt(sheetSpec(sheet));
}
