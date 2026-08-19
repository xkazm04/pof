/**
 * The app's top-level surfaces, in one place.
 *
 * Two problems shared a root cause: nothing in the codebase said WHICH page you were
 * on, so
 *
 *  1. `src/app/error.tsx` — the app's ONLY error boundary, which App Router uses for
 *     every route — told a user who had crashed the 3D Studio that "the lab shell
 *     crashed … the catalog tree, the pipeline rail" and reassured them about produced
 *     artifacts that were not in play; and
 *  2. the lab shell (where 100% of users land) linked to `/status` and `/3d` and to
 *     nothing else, so `/experiment` — five dedicated commits, last touched
 *     2026-08-19, 13 rows in `experiment_runs` — was reachable only from the legacy
 *     shell scheduled for deletion.
 *
 * A surface therefore declares BOTH: the copy a crash on it may truthfully use, and
 * whether the lab lists it as a jump target. `navigable: false` REQUIRES an
 * `unlistedReason` — an unreachable route has to be a stated choice, not an oversight.
 *
 * `stateClaim` is deliberately nullable. A crash boundary may only promise what is
 * actually true of that surface's state; when nothing can be promised it says nothing
 * rather than borrowing the lab's sentence.
 */

export interface SurfaceCrashCopy {
  /** Heading — names the surface the user is actually on. */
  headline: string;
  /** What threw, in that surface's own vocabulary. */
  body: string;
  /** What can honestly be said about state here, or `null` for "nothing can". */
  stateClaim: string | null;
}

export interface ShellSurface {
  /** Route path as mounted under `src/app` (`/` is the root shell). */
  route: string;
  /** Short name — used in crash headings and search hits. */
  name: string;
  /** One line describing what the surface is for (search hit detail). */
  detail: string;
  /** True when this surface IS the lab shell (catalog tree + pipeline rail + canvas). */
  isLab: boolean;
  /** Listed as a jump target in the lab header and in `LabSearch`. */
  navigable: boolean;
  /** REQUIRED when `navigable` is false — why this route is not offered. */
  unlistedReason?: string;
  crash: SurfaceCrashCopy;
}

/** The reassurance the lab surfaces — and only they — may make. */
const LAB_STATE_CLAIM =
  'Nothing was written or deleted. Your produced artifacts are on the server and in this browser exactly as they were.';

const LAB_CRASH: SurfaceCrashCopy = {
  headline: 'The lab shell crashed',
  body:
    'Something above the step canvas threw while rendering — the catalog tree, the pipeline rail, the header, or the data they derive from. A crash inside a single step is contained to that panel; this one was not, so the page could not be drawn.',
  stateClaim: LAB_STATE_CLAIM,
};

export const SHELL_SURFACES: readonly ShellSurface[] = [
  {
    route: '/',
    name: 'Blueprint lab',
    detail: 'catalog pipelines, entities and steps',
    isLab: true,
    navigable: false,
    unlistedReason: 'this IS the lab shell — the surface the jump targets are listed on',
    crash: LAB_CRASH,
  },
  {
    route: '/layout',
    name: 'Blueprint lab',
    detail: 'catalog pipelines, entities and steps',
    isLab: true,
    navigable: false,
    unlistedReason: 'the lab shell under its own path — the surface the jump targets are listed on',
    crash: LAB_CRASH,
  },
  {
    route: '/status',
    name: 'Pipeline status',
    detail: 'health map — step readiness across every catalog pipeline',
    isLab: false,
    navigable: true,
    crash: {
      headline: 'The pipeline status map crashed',
      body:
        'Something in the health map threw while rendering — a swimlane, a tier bar, or the readiness data they derive from.',
      stateClaim: 'Nothing was written or deleted: the status map only reads pipeline state.',
    },
  },
  {
    route: '/3d',
    name: '3D Studio',
    detail: 'preview, rotate and inspect generated 3D assets',
    isLab: false,
    navigable: true,
    crash: {
      headline: 'The 3D Studio crashed',
      body:
        'Something in the studio threw while rendering — the asset gallery, the viewport, or the inspector. A WebGL or model-loading failure surfaces here too.',
      stateClaim: 'Nothing was written or deleted: the studio only reads the generated assets already on disk.',
    },
  },
  {
    route: '/experiment',
    name: 'UE Experiment Lab',
    detail: 'run a concept on the connected UE 5.8 project and see the output',
    isLab: false,
    navigable: true,
    crash: {
      headline: 'The UE Experiment Lab crashed',
      body:
        'Something in the experiment lab threw while rendering — the run form, a result panel, or the run history.',
      stateClaim:
        'A run already dispatched keeps going on the server; this crash only ended the page watching it. Finished runs are recorded in Run history.',
    },
  },
  {
    route: '/harness',
    name: 'Harness',
    detail: 'operator run controls, gate drain, visual gallery and run history',
    isLab: false,
    navigable: false,
    unlistedReason: 'operator controls are deliberately not advertised in the lab shell (standing operator taste)',
    crash: {
      headline: 'The harness console crashed',
      body:
        'Something in the harness console threw while rendering — the run controls, the drain worker, the gallery, the guide, or the history.',
      stateClaim:
        'A harness run or drain worker already started is server-side and is unaffected; this crash only ended the page watching it.',
    },
  },
];

/**
 * Fallback for a path no surface claims (a mistyped URL, or a route added without
 * being declared here). It guesses NOTHING about what was on screen — inventing a
 * subject is the exact failure this module exists to remove.
 */
export const UNKNOWN_SURFACE: ShellSurface = {
  route: '',
  name: 'This page',
  detail: 'an undeclared route',
  isLab: false,
  navigable: false,
  unlistedReason: 'not a declared surface',
  crash: {
    headline: 'This page crashed',
    body:
      'Something threw while rendering. PoF could not match this URL to one of its surfaces, so it will not guess what was on screen or what it was doing.',
    stateClaim: null,
  },
};

/** The surfaces the lab offers as jump targets (header buttons + search hits). */
export const NAVIGABLE_SURFACES: readonly ShellSurface[] = SHELL_SURFACES.filter((s) => s.navigable);

/**
 * Which surface a pathname is on. Longest declared route wins, so `/status/fixtures`
 * resolves to `/status` and never to `/`. An unmatched path gets
 * {@link UNKNOWN_SURFACE} — never the lab's copy by default.
 */
export function resolveSurface(pathname: string | null | undefined): ShellSurface {
  if (!pathname) return UNKNOWN_SURFACE;
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  let best: ShellSurface | null = null;
  for (const s of SHELL_SURFACES) {
    const hit = s.route === '/' ? path === '/' : path === s.route || path.startsWith(`${s.route}/`);
    if (hit && (!best || s.route.length > best.route.length)) best = s;
  }
  return best ?? UNKNOWN_SURFACE;
}

/**
 * The one return-to-the-lab affordance. `/status` shipped this pattern first
 * (`StatusDashboard`); `/3d` and `/experiment` now reuse the SAME accessible name
 * instead of inventing a second wording for the same act.
 */
export const LAB_RETURN = {
  href: '/layout',
  label: '← Blueprint lab',
  ariaLabel: 'Back to the Blueprint layout lab',
} as const;
