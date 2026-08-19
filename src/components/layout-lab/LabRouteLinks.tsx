'use client';

/**
 * The lab header's cluster of links to OTHER top-level surfaces.
 *
 * The shell 100% of users land in used to hard-code two of them (`/status`, `/3d`) and
 * offer nothing else, so `/experiment` — five dedicated commits, last touched
 * 2026-08-19, 13 rows in `experiment_runs` — was reachable only from the legacy shell
 * that `LEGACY-SALVAGE.md` schedules for deletion. The list is now DERIVED from
 * `NAVIGABLE_SURFACES`, the same declaration `LabSearch` and `not-found` read, so a
 * surface is reachable or explicitly unlisted-with-a-reason and never merely forgotten.
 * (`/harness` is deliberately unlisted — operator controls are not advertised here.)
 *
 * These are FULL-PAGE jumps, not the in-place `setView` toggles beside them, so they
 * are drawn differently on purpose: a rule separates the cluster, the border is dashed,
 * the label is muted mono, and each carries a `↗`. The accessible name says "leaves the
 * lab" so the difference is not carried by pixels alone.
 *
 * Deliberately still `window.location.href` — this is about reachability, not
 * navigation performance.
 */

import { NAVIGABLE_SURFACES } from '@/lib/shell/surfaces';
import { Button } from './ui/Button';

/** Stable test id for one route button (`lab-route-3d`, `lab-route-experiment`, …). */
export const routeButtonTestId = (route: string) => `lab-route-${route.replace(/^\//, '')}`;

export function LabRouteLinks() {
  return (
    <>
      <span
        aria-hidden="true"
        style={{ width: 1, alignSelf: 'stretch', background: 'var(--lab-line)', margin: `0 var(--lab-s1)` }}
      />
      {NAVIGABLE_SURFACES.map((s) => (
        <Button
          key={s.route}
          mono
          data-testid={routeButtonTestId(s.route)}
          data-route={s.route}
          ariaLabel={`Open ${s.name} — leaves the lab`}
          title={s.detail}
          onClick={() => { window.location.href = s.route; }}
          style={{ borderStyle: 'dashed', color: 'var(--lab-muted)' }}
        >
          {s.name} <span aria-hidden="true">↗</span>
        </Button>
      ))}
    </>
  );
}
