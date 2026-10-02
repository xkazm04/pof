/**
 * runIconSet — the ONE paid step of the forge's icon-set mode.
 *
 * Posts the planned sheets to `POST /api/visual-gen/contact-sheet` one after another, in plan
 * order, and classifies each answer from the route's envelope:
 *  - `cut`     — the sheet was graded sliceable and its cells were filed through the icon
 *                library door (the route commits them; nothing is written here);
 *  - `uncut`   — the sheet generated (the credit is spent) but the gate refused to cut it: the
 *                route's 502 `details` carries the sheet url and the gate's reasons, kept here;
 *  - `refused` — a 400: nothing reached a provider;
 *  - `failed`  — anything else, including a network throw.
 * One sheet's failure never stops the next. Raw `fetch`, not `apiFetch`: the 502 `details` are
 * the whole point of the uncut branch and `apiFetch` would throw them away. No client deadline:
 * the server's own provider clock is the only one.
 *
 * Style DNA: the forge switch is forwarded as `applyStyleDna` in EVERY body, with the sheet's
 * canon profile, and the SERVER resolves the style (`style-apply.ts`) — a canon entity gets its
 * canon's own style, never the project's.
 */
import type { IconSetPlan, PlannedSheet } from '@/lib/visual-gen/icon-set-plan';
import type { CutIcon } from '@/lib/visual-gen/sheet-slice';
import type { StyleOutcome } from '@/lib/visual-gen/style-apply';

export const CONTACT_SHEET_URL = '/api/visual-gen/contact-sheet';

export type IconSheetOutcome =
  | ({ kind: 'cut'; sheetUrl: string; icons: CutIcon[] } & Partial<StyleOutcome>)
  | { kind: 'uncut'; sheetUrl: string; reasons: string[]; error: string }
  | { kind: 'refused'; error: string }
  | { kind: 'failed'; error: string };

export interface IconSetRunOptions {
  /** The forge store's "apply project style" switch. */
  applyStyleDna?: boolean;
  /** Called as each sheet's outcome lands, with its plan index. */
  onSheet?: (outcome: IconSheetOutcome, index: number) => void;
}

/** The request body for one planned sheet. */
export function iconSheetBody(plan: IconSetPlan, sheet: PlannedSheet, applyStyleDna: boolean) {
  return {
    catalogId: plan.catalogId,
    step: plan.step,
    cols: sheet.cols,
    rows: sheet.rows,
    cast: sheet.cast,
    applyStyleDna,
    ...(sheet.canonProfile ? { canonProfile: sheet.canonProfile } : {}),
  };
}

interface Envelope {
  success?: boolean;
  data?: { sheetUrl?: string; icons?: CutIcon[] } & Partial<StyleOutcome>;
  error?: string;
  details?: { sheetUrl?: unknown; verdict?: { reasons?: unknown } };
}

async function postSheet(fetchFn: typeof fetch, body: unknown): Promise<IconSheetOutcome> {
  let res: Response;
  try {
    res = await fetchFn(CONTACT_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { kind: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
  let env: Envelope;
  try {
    env = (await res.json()) as Envelope;
  } catch {
    return { kind: 'failed', error: `the route answered ${res.status} without a JSON envelope` };
  }
  if (res.ok && env.success && env.data) {
    const { sheetUrl = '', icons = [], styleDnaApplied, styleDnaWithheld, styleDnaDropped } = env.data;
    return { kind: 'cut', sheetUrl, icons, styleDnaApplied, styleDnaWithheld, styleDnaDropped };
  }
  const error = env.error ?? `the route answered ${res.status}`;
  if (res.status === 400) return { kind: 'refused', error };
  const sheetUrl = env.details?.sheetUrl;
  if (res.status === 502 && typeof sheetUrl === 'string' && sheetUrl) {
    const raw = env.details?.verdict?.reasons;
    const reasons = Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string') : [];
    return { kind: 'uncut', sheetUrl, reasons, error };
  }
  return { kind: 'failed', error };
}

/** Run every planned sheet, sequentially. Returns one outcome per sheet, in plan order. */
export async function runIconSet(
  plan: IconSetPlan,
  fetchFn: typeof fetch,
  opts: IconSetRunOptions = {},
): Promise<IconSheetOutcome[]> {
  const out: IconSheetOutcome[] = [];
  for (const [i, sheet] of plan.sheets.entries()) {
    const outcome = await postSheet(fetchFn, iconSheetBody(plan, sheet, opts.applyStyleDna === true));
    out.push(outcome);
    opts.onSheet?.(outcome, i);
  }
  return out;
}
