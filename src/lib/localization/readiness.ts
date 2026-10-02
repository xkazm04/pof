/* ------------------------------------------------------------------ */
/*  Localization Pipeline — Pseudo-locale readiness (pure)             */
/* ------------------------------------------------------------------ */
/*                                                                     */
/*  Per scanned string: will it clip its surface under banded          */
/*  expansion, does it bypass the localization catalog, is it a        */
/*  concatenated fragment? Reads the same strings/hazards the scan     */
/*  produced — no second extraction and no second concatenation rule.  */
/* ------------------------------------------------------------------ */

import type {
  LocalizableString,
  LocalizationHazard,
  StringContext,
  StringLocation,
} from '@/types/localization-pipeline';
import { DEFAULT_PSEUDO_KNOBS, projectedLength, pseudoLocalize } from './pseudo-locale';
import type { PseudoKnobs } from './pseudo-locale';

type BudgetedContext = Exclude<StringContext, 'unknown'>;

/**
 * DECLARED absolute character budgets for fixed-width surfaces (a project default, not a
 * measured widget width); `null` = the surface reflows (wraps / auto-sizes), so length
 * cannot clip it. `unknown` has no entry: an unclassified string gets no verdict it
 * has not earned.
 */
export const SURFACE_BUDGETS: Readonly<Record<BudgetedContext, number | null>> = {
  ui_button: 16,
  stat_label: 16,
  ui_label: 24,
  menu_title: 24,
  ability_name: 24,
  item_name: 32,
  quest_title: 40,
  notification: 48,
  ability_description: null,
  item_tooltip: null,
  quest_description: null,
  dialogue_line: null,
  tutorial: null,
};

/** Warn on the SOURCE when it already uses this share of its budget. */
export const NEAR_BUDGET_RATIO = 0.85;

export type ReadinessVerdict = 'fits' | 'overflow' | 'reflow' | 'unbudgeted';

export interface SurfaceBudget {
  surface: StringContext;
  chars: number;
}

export interface ReadinessRow {
  stringId: string;
  source: string;
  context: StringContext;
  pseudo: string;
  /** Banded projected length — knob-independent, so verdicts never move with a display toggle. */
  projected: number;
  budget: SurfaceBudget | null;
  verdict: ReadinessVerdict;
  /** The source alone is >= 85% of its budget: shorten it or widen the widget, once, not per locale. */
  sourceNearBudget: boolean;
  /** Not gathered into the catalog (FText::FromString / raw FString) — a pseudo build shows it unaccented. */
  bypassesCatalog: boolean;
  /** A text_concatenation hazard sits at this string's location. */
  fragment: boolean;
  location: StringLocation | null;
}

export interface ReadinessSummary {
  total: number;
  fits: number;
  overflow: number;
  reflow: number;
  unbudgeted: number;
  nearBudget: number;
  bypassesCatalog: number;
  fragments: number;
}

export interface ReadinessResult {
  rows: ReadinessRow[];
  summary: ReadinessSummary;
}

const CATALOG_USAGES: ReadonlySet<LocalizableString['currentUsage']> = new Set(['nsloctext', 'loctext', 'string_table']);

const locKey = (l: Pick<StringLocation, 'filePath' | 'lineNumber'>) => `${l.filePath}:${l.lineNumber}`;

function assessOne(s: LocalizableString, knobs: PseudoKnobs, fragmentAt: Set<string>): ReadinessRow {
  const projected = projectedLength(s.sourceText.length);
  const declared = s.context === 'unknown' ? undefined : SURFACE_BUDGETS[s.context];
  const budget = typeof declared === 'number' ? { surface: s.context, chars: declared } : null;
  const verdict: ReadinessVerdict = budget
    ? projected > budget.chars ? 'overflow' : 'fits'
    : declared === null ? 'reflow' : 'unbudgeted';
  return {
    stringId: s.id,
    source: s.sourceText,
    context: s.context,
    pseudo: pseudoLocalize(s.sourceText, knobs),
    projected,
    budget,
    verdict,
    sourceNearBudget: budget !== null && s.sourceText.length >= NEAR_BUDGET_RATIO * budget.chars,
    bypassesCatalog: !CATALOG_USAGES.has(s.currentUsage),
    fragment: s.locations.some((l) => fragmentAt.has(locKey(l))),
    location: s.locations[0] ?? null,
  };
}

/** Rows in input order, plus summary counts. */
export function assessReadiness(
  strings: LocalizableString[],
  hazards: LocalizationHazard[],
  knobs: PseudoKnobs = DEFAULT_PSEUDO_KNOBS,
): ReadinessResult {
  const fragmentAt = new Set(hazards.filter((h) => h.type === 'text_concatenation').map((h) => locKey(h.location)));
  const rows = strings.map((s) => assessOne(s, knobs, fragmentAt));
  const summary: ReadinessSummary = {
    total: rows.length, fits: 0, overflow: 0, reflow: 0, unbudgeted: 0, nearBudget: 0, bypassesCatalog: 0, fragments: 0,
  };
  for (const r of rows) {
    summary[r.verdict] += 1;
    if (r.sourceNearBudget) summary.nearBudget += 1;
    if (r.bypassesCatalog) summary.bypassesCatalog += 1;
    if (r.fragment) summary.fragments += 1;
  }
  return { rows, summary };
}

const TRIAGE_ORDER: Record<ReadinessVerdict, number> = { overflow: 0, unbudgeted: 1, fits: 2, reflow: 3 };

/** Triage order for the view: overflow first (source-near-budget first within it), stable otherwise. */
export function orderForTriage(rows: ReadinessRow[]): ReadinessRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) =>
      TRIAGE_ORDER[a.r.verdict] - TRIAGE_ORDER[b.r.verdict]
      || Number(b.r.sourceNearBudget) - Number(a.r.sourceNearBudget)
      || a.i - b.i)
    .map(({ r }) => r);
}
