/**
 * Next-up worklist - the ranked, linkable answer to "which cell do I open first?".
 *
 * DISPLAY-ONLY. Everything here reads cells the map already derived; nothing feeds a grade,
 * an acceptance or a count back. The route of every cell is `routeOf` (the one classifier the
 * readiness CLI also uses) - there is no second rule. Model-blocked cells are listed PARKED,
 * last: the 2026-10-07 operator boundary says they are recorded, never attempted, so the queue
 * shows them without ever ranking them as work.
 *
 * Also owns the `/status` address format (`parseStatusSearch` / `serializeStatusSearch`) so the
 * `?route=` param is testable without rendering the dashboard shell.
 *
 * Pure.
 */
import { readinessOf, rank, type ReadinessLevel, type ReadinessState } from '@/lib/status/readiness';
import { isReadinessRoute, routeOf, summarizeRoutes, type ReadinessRoute, type RouteSummary } from '@/lib/status/readinessRoute';
import type { StepCell, Swimlane } from '@/lib/status/statusModel';

/** The route of one cell, exactly as the CLI inventory computes it. */
export function cellRoute(cell: StepCell): ReadinessRoute {
  const r = readinessOf(cell);
  return routeOf({ engine: cell.engine, judge: cell.judge, level: r.level, state: r.state });
}

/** `readiness` picks out a rung (only cells that REACHED it); `state` picks out the two
 *  off-ladder states; `engine` an engine; `route` a way of working the cell. */
export type Highlight = { kind: 'readiness' | 'state' | 'engine' | 'route'; value: string } | null;

export function cellMatches(cell: StepCell, hl: Highlight): boolean {
  if (!hl) return true;
  if (hl.kind === 'engine') return cell.engine === hl.value;
  if (hl.kind === 'route') return cellRoute(cell) === hl.value;
  const r = readinessOf(cell);
  if (hl.kind === 'state') return r.state === hl.value;
  return r.state === 'reached' && r.level === hl.value;
}

export interface WorkItem {
  catalogId: string;
  step: string;
  cell: StepCell;
  route: ReadinessRoute;
  level: ReadinessLevel;
  state: ReadinessState;
  because: string;
  /** Model-blocked: recorded, never attempted. Sorts after every actionable item. */
  parked: boolean;
  /** The lane's production-ready percentage - a tie-break only. */
  readyPct: number;
}

const STATE_ORDER: Record<ReadinessState, number> = { blocked: 0, waiting: 1, reached: 2 };

/** Every cell below R3 (or not reached), ranked. Lanes that never built (failed reads)
 *  are simply absent from `lanes`, so they contribute no work. */
export function buildWorkQueue(lanes: readonly Swimlane[] | null | undefined): WorkItem[] {
  const items: WorkItem[] = [];
  for (const lane of lanes ?? []) {
    for (const cell of lane.cells) {
      const r = readinessOf(cell);
      const route = routeOf({ engine: cell.engine, judge: cell.judge, level: r.level, state: r.state });
      if (route === 'at-r3') continue;
      items.push({
        catalogId: lane.catalogId,
        step: cell.label,
        cell,
        route,
        level: r.level,
        state: r.state,
        because: r.because,
        parked: route === 'model-blocked',
        readyPct: lane.readyPct,
      });
    }
  }
  return items.sort(
    (a, b) =>
      Number(a.parked) - Number(b.parked) ||
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      b.readyPct - a.readyPct ||
      rank(b.level) - rank(a.level) ||
      a.catalogId.localeCompare(b.catalogId) ||
      a.step.localeCompare(b.step),
  );
}

/** Per-route cell counts over every cell of the lanes (at-r3 included). */
export function queueSummary(lanes: readonly Swimlane[] | null | undefined): RouteSummary {
  return summarizeRoutes((lanes ?? []).flatMap((l) => l.cells.map((c) => ({ route: cellRoute(c) }))));
}

// ---- /status address ------------------------------------------------------------------

export type StatusTabName = 'capability' | 'pipelines' | 'category' | 'item' | 'models';

export interface StatusSearch {
  tab: StatusTabName;
  focus: { catalogId: string; entityId: string } | null;
  catalog: string | null;
  filterClass: string | null;
  route: ReadinessRoute | null;
}

export function parseStatusSearch(search: string): StatusSearch {
  const p = new URLSearchParams(search);
  const entityRaw = p.get('entity');
  let focus: StatusSearch['focus'] = null;
  if (entityRaw) {
    const i = entityRaw.indexOf(':');
    if (i > 0) focus = { catalogId: entityRaw.slice(0, i), entityId: entityRaw.slice(i + 1) };
  }
  const catalogParam = p.get('catalog');
  const tabParam = p.get('tab');
  const classParam = p.get('class');
  const routeParam = p.get('route');
  const route = isReadinessRoute(routeParam) ? routeParam : null;
  let tab: StatusTabName;
  if (focus || tabParam === 'item') tab = 'item';
  else if (catalogParam || tabParam === 'category') tab = 'category';
  else if (tabParam === 'models') tab = 'models';
  else if (tabParam === 'pipelines' || classParam || route) tab = 'pipelines';
  else tab = 'capability';
  return { tab, focus, catalog: catalogParam || null, filterClass: classParam || null, route };
}

/** The query string (no leading `?`) that `parseStatusSearch` reads back to the same state. */
export function serializeStatusSearch(s: StatusSearch): string {
  if (s.tab === 'item') return s.focus ? `entity=${s.focus.catalogId}:${s.focus.entityId}` : 'tab=item';
  if (s.tab === 'category') return s.catalog ? `catalog=${s.catalog}` : 'tab=category';
  if (s.tab === 'models') return 'tab=models';
  if (s.tab === 'pipelines') {
    const parts = ['tab=pipelines'];
    if (s.filterClass) parts.push(`class=${encodeURIComponent(s.filterClass)}`);
    if (s.route) parts.push(`route=${s.route}`);
    return parts.join('&');
  }
  return '';
}
