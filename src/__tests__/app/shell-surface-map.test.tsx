/**
 * Reachability guard for the app's top-level surfaces.
 *
 * The shell 100% of users land in linked to `/status` and `/3d` and to nothing else, so
 * `/experiment` — five dedicated commits, last touched 2026-08-19, 13 rows in
 * `experiment_runs` — had ZERO entry points outside the legacy shell scheduled for
 * deletion, and `/3d` was a full-page jump with no way back.
 *
 * This suite enumerates `src/app/<route>/page.tsx` from disk (so a route added later is
 * covered without editing a list) and requires each one to be either a navigable target
 * in the lab — a header route button AND a `LabSearch` hit — or explicitly unlisted with
 * a stated reason. `/harness` is the deliberate exclusion: operator controls are not
 * advertised in the lab.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
// The studio's panels are not under test — only its return affordance is.
vi.mock('@/components/studio-3d/AssetGallery', () => ({ AssetGallery: () => <div data-testid="gallery" /> }));
vi.mock('@/components/studio-3d/StudioToolbar', () => ({ StudioToolbar: () => <div data-testid="toolbar" /> }));
vi.mock('@/components/studio-3d/StudioInspector', () => ({ StudioInspector: () => <div data-testid="inspector" /> }));
vi.mock('@/components/modules/visual-gen/asset-viewer/SceneViewer', () => ({ SceneViewer: () => <div data-testid="scene" /> }));
vi.mock('@/components/experiment-lab/ExperimentLab', () => ({ ExperimentLab: () => <div data-testid="experiment-lab" /> }));

import { LabSearch } from '@/components/layout-lab/LabSearch';
import { LabRouteLinks, routeButtonTestId } from '@/components/layout-lab/LabRouteLinks';
import { Studio3D } from '@/components/studio-3d/Studio3D';
import ExperimentPage from '@/app/experiment/page';
import { LAB_RETURN, NAVIGABLE_SURFACES, SHELL_SURFACES } from '@/lib/shell/surfaces';

const APP_DIR = join(process.cwd(), 'src', 'app');
const LAYOUT_LAB = join(process.cwd(), 'src', 'components', 'layout-lab', 'LayoutLab.tsx');
const STATUS_DASHBOARD = join(process.cwd(), 'src', 'components', 'status', 'StatusDashboard.tsx');

/** Every `/x` route with a `src/app/x/page.tsx`, read from disk (never a hand-kept list). */
function routesOnDisk(): string[] {
  return readdirSync(APP_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && d.name !== 'api')
    .filter((d) => existsSync(join(APP_DIR, d.name, 'page.tsx')))
    .map((d) => `/${d.name}`);
}

/** Stub `window.location` so a jump is observable (jsdom will not navigate). */
function captureNavigation() {
  const real = window.location;
  const stub = { ...real, href: '' } as unknown as Location;
  Object.defineProperty(window, 'location', { value: stub, writable: true, configurable: true });
  return {
    href: () => stub.href,
    restore: () => Object.defineProperty(window, 'location', { value: real, writable: true, configurable: true }),
  };
}

const searchOptions = () => screen.queryAllByTestId('lab-search-option');
const typeSearch = (v: string) => fireEvent.change(screen.getByTestId('lab-search-input'), { target: { value: v } });

describe('every route that exists is reachable — or unlisted for a stated reason', () => {
  afterEach(cleanup);

  it('declares every src/app/<route>/page.tsx in the surface map', () => {
    const declared = new Set(SHELL_SURFACES.map((s) => s.route));
    const undeclared = routesOnDisk().filter((r) => !declared.has(r));
    expect(undeclared, `routes with a page.tsx but no surface declaration: ${undeclared.join(', ')}`).toEqual([]);
  });

  it('offers every navigable route as a header button AND a search hit', () => {
    render(<LabRouteLinks />);
    for (const s of NAVIGABLE_SURFACES) {
      expect(screen.getByTestId(routeButtonTestId(s.route)).getAttribute('data-route')).toBe(s.route);
    }
    cleanup();

    render(<LabSearch open onClose={() => {}} currentEntityId={null} onSelectCatalog={() => {}} onNavigate={() => {}} />);
    for (const s of NAVIGABLE_SURFACES) {
      typeSearch(s.name.toLowerCase());
      const hit = searchOptions().find((o) => within(o).queryByText(s.route));
      expect(hit, `no LabSearch hit for ${s.route}`).toBeTruthy();
    }
  });

  it('closes the named gap: /experiment is reachable from the lab palette by name and by path', () => {
    render(<LabSearch open onClose={() => {}} currentEntityId={null} onSelectCatalog={() => {}} onNavigate={() => {}} />);
    for (const needle of ['experiment', '/experiment', 'ue 5.8']) {
      typeSearch(needle);
      const hit = searchOptions().find((o) => within(o).queryByText('/experiment'));
      expect(hit, `"${needle}" found no /experiment hit`).toBeTruthy();
    }
  });

  it('states a reason for every route it does NOT offer (and keeps /harness among them)', () => {
    for (const s of SHELL_SURFACES) {
      if (!s.navigable) expect(s.unlistedReason, `${s.route} unlisted with no reason`).toBeTruthy();
    }
    const harness = SHELL_SURFACES.find((s) => s.route === '/harness');
    expect(harness?.navigable).toBe(false);
    expect(harness?.unlistedReason).toContain('operator');
  });
});

describe('selecting a route hit leaves the lab (and says so)', () => {
  let nav: ReturnType<typeof captureNavigation>;
  beforeEach(() => { nav = captureNavigation(); });
  afterEach(() => { nav.restore(); cleanup(); });

  it('navigates to the route and closes the palette, without touching the in-lab nav callbacks', () => {
    const onClose = vi.fn();
    const onSelectCatalog = vi.fn();
    const onNavigate = vi.fn();
    render(<LabSearch open onClose={onClose} currentEntityId={null} onSelectCatalog={onSelectCatalog} onNavigate={onNavigate} />);
    typeSearch('experiment lab');
    const hit = searchOptions().find((o) => within(o).queryByText('/experiment'));
    expect(hit).toBeTruthy();
    // The badge marks it as a different page, not an in-lab view.
    expect(within(hit!).queryByText('page')).toBeTruthy();
    fireEvent.click(hit!);
    expect(nav.href()).toBe('/experiment');
    expect(onClose).toHaveBeenCalled();
    expect(onSelectCatalog).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('a header route button jumps too', () => {
    render(<LabRouteLinks />);
    fireEvent.click(screen.getByTestId(routeButtonTestId('/3d')));
    expect(nav.href()).toBe('/3d');
  });
});

describe('a full-page jump does not look like a tab', () => {
  afterEach(cleanup);

  it('marks route buttons distinctly — dashed border, ↗, and an accessible name that says it leaves', () => {
    const { container } = render(<LabRouteLinks />);
    for (const s of NAVIGABLE_SURFACES) {
      const btn = screen.getByTestId(routeButtonTestId(s.route));
      expect(btn.getAttribute('aria-label')).toBe(`Open ${s.name} — leaves the lab`);
      expect((btn as HTMLElement).style.borderStyle).toBe('dashed');
      expect(btn.textContent).toContain('↗');
      // A view toggle is a pressed-state control; a jump is not.
      expect(btn.getAttribute('aria-pressed')).toBeNull();
    }
    // The cluster is separated from the in-place view toggles by a rule.
    expect(container.querySelector('span[aria-hidden="true"]')).toBeTruthy();
  });

  it('the lab header renders the derived cluster instead of hard-coded jumps', () => {
    const src = readFileSync(LAYOUT_LAB, 'utf8');
    expect(src).toContain('<LabRouteLinks />');
    // The old header hard-coded exactly two of six surfaces; nothing may re-add that.
    // (Scoped to route literals only — the in-place view toggles are another lot's file
    // region and this guard has no business pinning their shape.)
    expect(src).not.toMatch(/window\.location\.href = '\/(3d|status|experiment|harness)'/);
  });
});

describe('every secondary surface has the same way back', () => {
  afterEach(cleanup);

  it('/3d renders the return link', () => {
    const { container } = render(<Studio3D />);
    const back = container.querySelector(`a[aria-label="${LAB_RETURN.ariaLabel}"]`);
    expect(back?.getAttribute('href')).toBe(LAB_RETURN.href);
    expect(back?.textContent).toBe(LAB_RETURN.label);
  });

  it('/experiment renders the return link', () => {
    const { container } = render(<ExperimentPage />);
    const back = container.querySelector(`a[aria-label="${LAB_RETURN.ariaLabel}"]`);
    expect(back?.getAttribute('href')).toBe(LAB_RETURN.href);
    expect(back?.textContent).toBe(LAB_RETURN.label);
    expect(screen.getByTestId('experiment-lab')).toBeTruthy();
  });

  it('PRESERVED: /status keeps the accessible name the other two now copy', () => {
    const src = readFileSync(STATUS_DASHBOARD, 'utf8');
    expect(src).toContain(LAB_RETURN.ariaLabel);
    expect(src).toContain(LAB_RETURN.label);
  });
});
