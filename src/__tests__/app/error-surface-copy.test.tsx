/**
 * `src/app/error.tsx` is the app's ONLY error boundary (no `global-error.tsx`, no
 * per-route `error.tsx`), so App Router hands it every crash on `/3d`, `/experiment`,
 * `/harness` and `/status` as well as the lab. It used to greet all of them with "The
 * lab shell crashed … the catalog tree, the pipeline rail" and reassure them that
 * "your produced artifacts are on the server" — a surface the user was not on, and a
 * guarantee about state that was not in play.
 *
 * These assertions pin: the subject is derived from the pathname, the lab's artifact
 * reassurance is emitted ONLY on lab surfaces, an unrecognised path guesses nothing,
 * and the boundary still never auto-retries.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const pathname = { current: '/' };
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

import AppError from '@/app/error';
import NotFound from '@/app/not-found';
import { LAB_RETURN, NAVIGABLE_SURFACES, SHELL_SURFACES, UNKNOWN_SURFACE, resolveSurface } from '@/lib/shell/surfaces';

const boom = Object.assign(new Error('rows.map is not a function'), { name: 'TypeError' });

/** Render the boundary at a path and return its full text + the reset spy. */
function renderAt(path: string) {
  pathname.current = path;
  const reset = vi.fn();
  const { container } = render(<AppError error={boom} reset={reset} />);
  return { text: container.textContent ?? '', reset, container };
}

// The lab's artifact reassurance — the sentence that must not travel off the lab.
const ARTIFACT_CLAIM = 'produced artifacts are on the server';

describe('app/error.tsx names the surface it is actually on', () => {
  afterEach(() => { cleanup(); pathname.current = '/'; vi.restoreAllMocks(); });

  it('names the 3D Studio on /3d — not the lab shell, and with no artifact guarantee', () => {
    const { text, container } = renderAt('/3d');
    expect(container.querySelector('h1')?.textContent).toBe('The 3D Studio crashed');
    expect(text).not.toContain('lab shell crashed');
    expect(text).not.toContain('catalog tree');
    expect(text).not.toContain('pipeline rail');
    expect(text).not.toContain(ARTIFACT_CLAIM);
  });

  it('names the UE Experiment Lab on /experiment and claims only what is true there', () => {
    const { text, container } = renderAt('/experiment');
    expect(container.querySelector('h1')?.textContent).toBe('The UE Experiment Lab crashed');
    expect(text).toContain('A run already dispatched keeps going on the server');
    expect(text).not.toContain(ARTIFACT_CLAIM);
  });

  it('names the status map on /status (and on a nested /status path)', () => {
    expect(renderAt('/status').container.querySelector('h1')?.textContent).toBe('The pipeline status map crashed');
    cleanup();
    expect(renderAt('/status/fixtures').container.querySelector('h1')?.textContent).toBe('The pipeline status map crashed');
  });

  it('names the harness console on /harness', () => {
    const { container, text } = renderAt('/harness');
    expect(container.querySelector('h1')?.textContent).toBe('The harness console crashed');
    expect(text).not.toContain(ARTIFACT_CLAIM);
  });

  it('PRESERVED: the lab surfaces keep the lab copy and the artifact reassurance', () => {
    for (const path of ['/', '/layout']) {
      const { text, container } = renderAt(path);
      expect(container.querySelector('h1')?.textContent).toBe('The lab shell crashed');
      expect(text).toContain('catalog tree');
      expect(text).toContain(ARTIFACT_CLAIM);
      cleanup();
    }
  });

  it('guesses nothing on an undeclared path — no subject, no state claim', () => {
    const { text, container } = renderAt('/does-not-exist');
    expect(container.querySelector('h1')?.textContent).toBe('This page crashed');
    expect(text).toContain('could not match this URL');
    expect(text).not.toContain(ARTIFACT_CLAIM);
    expect(text).not.toContain('lab shell');
  });

  it('offers a route home from a secondary surface, and never points the lab at itself', () => {
    const off = renderAt('/3d');
    const home = off.container.querySelector(`a[aria-label="${LAB_RETURN.ariaLabel}"]`);
    expect(home?.getAttribute('href')).toBe(LAB_RETURN.href);
    cleanup();
    const lab = renderAt('/');
    expect(lab.container.querySelector(`a[aria-label="${LAB_RETURN.ariaLabel}"]`)).toBeNull();
  });

  it('PRESERVED: still reports the error identity and both manual recovery affordances', () => {
    const { text } = renderAt('/');
    expect(text).toContain('TypeError: rows.map is not a function');
    expect(screen.getByText('Try rendering again')).toBeTruthy();
    expect(screen.getByText('Reload the page')).toBeTruthy();
  });
});

describe('app/error.tsx never auto-retries', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); cleanup(); pathname.current = '/'; });

  it('does not call reset on mount, on re-render, or on any timer', () => {
    pathname.current = '/3d';
    const reset = vi.fn();
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, writable: true });
    const { rerender } = render(<AppError error={boom} reset={reset} />);
    rerender(<AppError error={boom} reset={reset} />);
    vi.advanceTimersByTime(60_000);
    expect(reset).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('app/not-found.tsx gives a mistyped URL a route home', () => {
  afterEach(() => { cleanup(); pathname.current = '/'; });

  it('names the missing path and links back to the lab with the shared accessible name', () => {
    pathname.current = '/layuot';
    const { container } = render(<NotFound />);
    expect(container.textContent).toContain('/layuot');
    const home = container.querySelector(`a[aria-label="${LAB_RETURN.ariaLabel}"]`);
    expect(home?.getAttribute('href')).toBe(LAB_RETURN.href);
    expect(home?.textContent).toBe(LAB_RETURN.label);
  });

  it('lists exactly the surfaces the lab lists — never the deliberately-unlisted /harness', () => {
    pathname.current = '/nope';
    const { container } = render(<NotFound />);
    const hrefs = Array.from(container.querySelectorAll('li a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(NAVIGABLE_SURFACES.map((s) => s.route));
    expect(hrefs).not.toContain('/harness');
  });
});

describe('the surface map itself', () => {
  it('requires a stated reason for every route it does not list', () => {
    for (const s of SHELL_SURFACES) {
      if (!s.navigable) expect(s.unlistedReason, `${s.route} is unlisted without a reason`).toBeTruthy();
    }
  });

  it('resolves the LONGEST matching route, and an unknown path to the guessing-nothing surface', () => {
    expect(resolveSurface('/status/fixtures').route).toBe('/status');
    expect(resolveSurface('/3d/').route).toBe('/3d');
    expect(resolveSurface('/nope')).toBe(UNKNOWN_SURFACE);
    expect(resolveSurface(null)).toBe(UNKNOWN_SURFACE);
    // "/" must never win by prefix — that is how every surface inherited the lab's copy.
    expect(resolveSurface('/experiment').isLab).toBe(false);
  });

  it('lets only lab surfaces make the artifact promise', () => {
    for (const s of SHELL_SURFACES) {
      if (!s.isLab) expect(s.crash.stateClaim ?? '').not.toContain(ARTIFACT_CLAIM);
    }
    expect(UNKNOWN_SURFACE.crash.stateClaim).toBeNull();
  });
});
