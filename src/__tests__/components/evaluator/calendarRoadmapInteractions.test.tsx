/**
 * Deadline writes and the Gantt's drawing rules, driven through the real view.
 * Each case was watched red against the code it replaced.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { addWeeks, startOfWeek } from '@/components/modules/evaluator/CalendarRoadmapView/helpers';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const state = vi.hoisted(() => ({
  milestones: [{
    id: 'ms-1',
    name: 'Combat',
    targetCompletion: 100,
    predictedDate: new Date(Date.now() + 10 * 7 * 24 * 60 * 60 * 1000).toISOString(),
    predictedWeeks: 10,
    currentProgress: 50,
    color: 'var(--color-module-core)',
  }],
  summary: { overallCompletion: 50 } as { overallCompletion: number } | null,
  fetchHealth: vi.fn(),
  error: null as string | null,
}));

vi.mock('@/stores/projectHealthStore', () => ({
  useProjectHealthStore: (sel: (s: unknown) => unknown) => sel(state),
}));
vi.mock('@/stores/moduleStore', () => ({
  useModuleStore: (sel: (s: unknown) => unknown) => sel({ checklistProgress: {} }),
}));
vi.mock('@/stores/evaluatorStore', () => ({
  useEvaluatorStore: (sel: (s: unknown) => unknown) => sel({ scanHistory: [], lastScan: null }),
}));

import { __resetMilestoneDeadlineCache } from '@/hooks/useMilestoneDeadlines';
import { CalendarRoadmapView } from '@/components/modules/evaluator/CalendarRoadmapView';

const DEADLINE = new Date(Date.now() + 5 * WEEK).toISOString();
const respond = (body: unknown, status = 200) => ({
  ok: status < 300, status, json: () => Promise.resolve(body),
});
const okBody = { success: true, data: { ok: true } };

function installFetch(opts: { get?: unknown; put?: () => unknown } = {}) {
  const mock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return Promise.resolve(opts.put ? opts.put() : respond(okBody));
    return Promise.resolve(opts.get ?? respond({ success: true, data: { 'ms-1': { targetDate: DEADLINE, label: '' } } }));
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}
const puts = (mock: ReturnType<typeof installFetch>) =>
  mock.mock.calls.filter((c) => c[1]?.method === 'PUT').map((c) => JSON.parse(String(c[1]?.body)));

function placeSvg(container: HTMLElement, left: number, scrollLeft: number) {
  const svg = container.querySelector('svg.select-none') as SVGSVGElement;
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left } as DOMRect);
  Object.defineProperty(svg.parentElement, 'scrollLeft', { value: scrollLeft, configurable: true });
}
function drag(marker: Element, clientX: number) {
  fireEvent.mouseDown(marker, { clientX });
  fireEvent.mouseMove(window, { clientX });
  fireEvent.mouseUp(window);
}
const cardDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { state.error = null; __resetMilestoneDeadlineCache(); });

describe('dragging a deadline', () => {
  it('reads the pointer once when the timeline is scrolled sideways', async () => {
    const mock = installFetch();
    const { container, findByTestId } = render(<CalendarRoadmapView />);
    const marker = await findByTestId('deadline-marker-ms-1');
    // Scrolled 560px: the svg's own rect has already moved left by that much.
    placeSvg(container, -560, 560);
    drag(marker, 300);
    await waitFor(() => expect(puts(mock).length).toBe(1));
    const start = addWeeks(startOfWeek(new Date()), -4);
    const days = (new Date(puts(mock)[0].targetDate).getTime() - start.getTime()) / 86400000;
    // x = 300 + 560 = 860 -> (860 - 200) / 56 weeks = 82.5 days into the timeline.
    expect(Math.abs(days - 82.5)).toBeLessThanOrEqual(1.5);
  });
});

describe('a press that does not move the deadline', () => {
  it('writes nothing', async () => {
    const mock = installFetch();
    const { findByTestId } = render(<CalendarRoadmapView />);
    const marker = await findByTestId('deadline-marker-ms-1');
    fireEvent.mouseDown(marker, { clientX: 300 });
    fireEvent.mouseUp(window);
    await act(async () => { await Promise.resolve(); });
    expect(puts(mock)).toEqual([]);
  });
});

describe('a deadline write the server refuses', () => {
  it('puts the saved date back and says why', async () => {
    installFetch({ put: () => respond({ success: false, error: 'disk full' }, 500) });
    const { container, findByTestId, findByRole } = render(<CalendarRoadmapView />);
    const marker = await findByTestId('deadline-marker-ms-1');
    placeSvg(container, 0, 0);
    drag(marker, 300);
    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('disk full');
    expect(container.textContent).toContain(cardDate(DEADLINE));
  });

  it('does not undo a newer edit when the older write fails', async () => {
    const pending: Array<(v: unknown) => void> = [];
    const mock = installFetch({ put: () => new Promise((r) => pending.push(r)) });
    const { container, findByTestId } = render(<CalendarRoadmapView />);
    const marker = await findByTestId('deadline-marker-ms-1');
    placeSvg(container, 0, 0);
    drag(marker, 300);
    drag(await findByTestId('deadline-marker-ms-1'), 340);
    await waitFor(() => expect(pending.length).toBe(2));
    const newer = puts(mock)[1].targetDate as string;
    await act(async () => { pending[0](respond({ success: false, error: 'late refusal' }, 500)); });
    expect(container.textContent).toContain(cardDate(newer));
  });
});

describe('deadlines that could not be loaded', () => {
  it('says so instead of offering every milestone as unset', async () => {
    installFetch({ get: respond({ success: false, error: 'db locked' }, 500) });
    const { findByRole } = render(<CalendarRoadmapView />);
    expect((await findByRole('alert')).textContent).toContain('db locked');
  });
});

describe('project health that could not be computed', () => {
  it('reports the store error rather than an empty chart', async () => {
    state.error = 'health engine down';
    installFetch();
    const { findByRole } = render(<CalendarRoadmapView />);
    expect((await findByRole('alert')).textContent).toContain('health engine down');
  });
});

describe('marks dated before the visible window', () => {
  it('are clipped to the plot so they cannot paint over the label gutter', async () => {
    installFetch();
    const { container, findByTestId } = render(<CalendarRoadmapView />);
    const marker = await findByTestId('deadline-marker-ms-1');
    const clipped = marker.closest('g[clip-path]');
    expect(clipped?.getAttribute('clip-path')).toBe('url(#roadmap-plot-clip)');
    expect(container.querySelector('#roadmap-plot-clip rect')?.getAttribute('x')).toBe('200');
  });
});

describe('a forecast past a deadline that has not arrived', () => {
  it('is called late, not overdue', async () => {
    installFetch();
    const { container, findByTestId } = render(<CalendarRoadmapView />);
    await findByTestId('deadline-marker-ms-1');
    expect(container.textContent).toMatch(/predicted \d+d late/);
    expect(container.textContent).not.toContain('overdue');
  });
});

describe('icon-only roadmap controls', () => {
  it('have accessible names', async () => {
    installFetch();
    const { findByTestId } = render(<CalendarRoadmapView />);
    await findByTestId('deadline-marker-ms-1');
    screen.getByRole('button', { name: 'Show earlier weeks' });
    screen.getByRole('button', { name: 'Show later weeks' });
    screen.getByRole('button', { name: 'Clear deadline for Combat' });
    fireEvent.click(screen.getByRole('button', { name: cardDate(DEADLINE) }));
    screen.getByLabelText('Deadline for Combat');
    screen.getByRole('button', { name: 'Save deadline for Combat' });
    screen.getByRole('button', { name: 'Cancel editing deadline for Combat' });
  });
});

describe('the legend', () => {
  it('draws the deadline as the diamond the chart draws, and no fixed colour for predicted', async () => {
    installFetch();
    const { container, findByTestId } = render(<CalendarRoadmapView />);
    await findByTestId('deadline-marker-ms-1');
    expect(container.querySelector('.border-dashed')).toBeNull();
    expect(container.querySelector('[data-testid="legend-deadline"]')?.className).toContain('rotate-45');
    expect(container.querySelector('[data-testid="legend-predicted"]')?.getAttribute('style') ?? '').not.toContain('gradient');
  });
});
