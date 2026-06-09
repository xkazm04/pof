import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// CookProgress now renders a CountUp percent label. Mock useReducedMotion so the
// count-up resolves to its target instantly (no animation timers / matchMedia).
const motionState = vi.hoisted(() => ({ reduced: true as boolean | null }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => motionState.reduced };
});

// react-window virtualizes — only on-screen rows mount, which jsdom (no layout)
// can't measure. Mock List to render every row flatly so the parsed log lines
// are queryable, and expose a scroll spy for the auto-tail / jump-to-error paths.
const rw = vi.hoisted(() => ({ scrollToRow: vi.fn() }));
vi.mock('react-window', () => ({
  List: (props: {
    rowComponent: React.ComponentType<Record<string, unknown>>;
    rowCount: number;
    rowProps: object;
    listRef?: { current: unknown };
  }) => {
    const { rowComponent: Row, rowCount, rowProps, listRef } = props;
    if (listRef && typeof listRef === 'object') {
      listRef.current = { element: null, scrollToRow: rw.scrollToRow };
    }
    return (
      <div>
        {Array.from({ length: rowCount }).map((_, i) => (
          <Row
            key={i}
            index={i}
            style={{}}
            ariaAttributes={{ role: 'listitem', 'aria-posinset': i + 1, 'aria-setsize': rowCount }}
            {...rowProps}
          />
        ))}
      </div>
    );
  },
}));

import {
  CookProgress,
  classifyCookLogLine,
  appendCookLog,
  formatCookTimestamp,
  type CookLogLine,
} from '@/components/modules/game-systems/CookProgress';

const REQUEST = { profileId: 'p1', projectPath: 'C:\\PoF', projectName: 'PoF', ueVersion: '5.7.0' };

/** Build a fetch mock whose response body streams the given cook events as SSE. */
function streamingFetch(events: object[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const ev of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      }
      controller.close();
    },
  });
  return vi.fn().mockResolvedValue({ ok: true, status: 200, body: stream });
}

beforeEach(() => {
  rw.scrollToRow.mockClear();
});

describe('CookProgress — accessibility', () => {
  it('exposes a progressbar with min/max and reflects progress events in aria-valuenow', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'progress', percent: 45 },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    const bar = await screen.findByRole('progressbar');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');

    await waitFor(() =>
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('45'),
    );
  });

  it('announces phase changes and the final success via a polite live region', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'progress', percent: 100 },
      { type: 'done', exePath: 'C:\\out\\PoF.exe' },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    const live = await screen.findByTestId('pof-cook-progress-live');
    expect(live.getAttribute('aria-live')).toBe('polite');

    await waitFor(() => expect(live.textContent).toContain('Cook succeeded'));
  });

  it('pairs a failure with an icon + text and announces it', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'error', message: 'cook crashed' },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    const live = await screen.findByTestId('pof-cook-progress-live');
    await waitFor(() => expect(live.textContent).toContain('Cook failed'));

    const result = await screen.findByTestId('pof-cook-progress-result');
    expect(result.textContent).toContain('cook crashed'); // text, not color alone
    expect(result.querySelector('svg')).toBeTruthy(); // shape paired with color
  });
});

describe('classifyCookLogLine', () => {
  it('flags errors over warnings over plain info', () => {
    expect(classifyCookLogLine('LogCook: Error: cook failed for asset')).toBe('error');
    expect(classifyCookLogLine('Build FAILED with exit code 1')).toBe('error');
    expect(classifyCookLogLine('LogCook: Warning: deprecated material node')).toBe('warning');
    expect(classifyCookLogLine('LogInit: Display: starting cook commandlet')).toBe('info');
    expect(classifyCookLogLine('')).toBe('info');
  });
});

describe('appendCookLog', () => {
  const mk = (i: number): CookLogLine => ({ id: i, line: `line ${i}`, t: i * 1000, phase: null, severity: 'info' });

  it('caps the buffer at max, keeping the newest entries', () => {
    let buf: CookLogLine[] = [];
    for (let i = 0; i < 6; i++) buf = appendCookLog(buf, mk(i), 3);
    expect(buf.length).toBe(3);
    expect(buf.map((l) => l.line)).toEqual(['line 3', 'line 4', 'line 5']);
  });

  it('keeps every entry while under the cap', () => {
    let buf: CookLogLine[] = [];
    for (let i = 0; i < 3; i++) buf = appendCookLog(buf, mk(i), 10);
    expect(buf.length).toBe(3);
  });
});

describe('formatCookTimestamp', () => {
  it('zero-pads MM:SS and keeps minutes counting past an hour', () => {
    expect(formatCookTimestamp(0)).toBe('00:00');
    expect(formatCookTimestamp(5000)).toBe('00:05');
    expect(formatCookTimestamp(65_000)).toBe('01:05');
    expect(formatCookTimestamp(60 * 60 * 1000 + 30_000)).toBe('60:30');
    expect(formatCookTimestamp(-1000)).toBe('00:00');
  });
});

describe('CookProgress — structured console', () => {
  it('renders each line with a severity-colored left border + timestamp prefix', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'log', line: 'LogCook: Display: cooking package A', t: 5000 },
      { type: 'log', line: 'LogCook: Warning: missing reference', t: 6000 },
      { type: 'log', line: 'LogCook: Error: cook failed for asset', t: 7000 },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    const logEl = await screen.findByTestId('pof-cook-progress-log');
    await waitFor(() => expect(logEl.querySelectorAll('[data-severity]').length).toBe(3));

    const lines = Array.from(logEl.querySelectorAll<HTMLElement>('[data-severity]'));
    expect(lines.map((l) => l.getAttribute('data-severity'))).toEqual(['info', 'warning', 'error']);

    // Every severity (incl. info=blue) carries a colored left border.
    lines.forEach((l) => expect(l.style.borderLeftColor).not.toBe(''));

    // Monospaced elapsed timestamp prefix is rendered per line.
    expect(logEl.textContent).toContain('00:05');
    expect(logEl.textContent).toContain('00:07');
  });

  it('filters to errors only when the Errors facet is selected', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'log', line: 'LogCook: Display: cooking package A', t: 1000 },
      { type: 'log', line: 'LogCook: Warning: missing reference', t: 2000 },
      { type: 'log', line: 'LogCook: Error: cook failed for asset', t: 3000 },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    const logEl = await screen.findByTestId('pof-cook-progress-log');
    await waitFor(() => expect(logEl.querySelectorAll('[data-severity]').length).toBe(3));

    fireEvent.click(screen.getByTestId('pof-cook-log-filter-error'));

    await waitFor(() => expect(logEl.querySelectorAll('[data-severity]').length).toBe(1));
    expect(logEl.querySelector('[data-severity]')?.getAttribute('data-severity')).toBe('error');
  });

  it('filters by phase via the Stage facet', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'log', line: 'LogCook: Display: cooking package A', t: 1000 },
      { type: 'phase', phase: 'stage' },
      { type: 'log', line: 'LogStage: Display: staging files', t: 2000 },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    const logEl = await screen.findByTestId('pof-cook-progress-log');
    await waitFor(() => expect(logEl.querySelectorAll('[data-severity]').length).toBe(2));

    fireEvent.click(screen.getByTestId('pof-cook-log-filter-stage'));

    await waitFor(() => {
      const rows = logEl.querySelectorAll('[data-phase]');
      expect(rows.length).toBe(1);
      expect(rows[0].getAttribute('data-phase')).toBe('stage');
    });
  });

  it('shows a sticky jump-to-error button only when errors exist, and scrolls on click', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'log', line: 'LogCook: Display: cooking package A', t: 1000 },
      { type: 'log', line: 'LogCook: Error: cook failed for asset', t: 2000 },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    const jump = await screen.findByTestId('pof-cook-log-jump-error');
    rw.scrollToRow.mockClear();
    fireEvent.click(jump);
    expect(rw.scrollToRow).toHaveBeenCalledWith(expect.objectContaining({ align: 'center' }));
  });

  it('hides the jump-to-error button when there are no errors', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'log', line: 'LogCook: Display: cooking package A', t: 1000 },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    await screen.findByTestId('pof-cook-progress-log');
    await waitFor(() =>
      expect(screen.getByTestId('pof-cook-progress-log').querySelectorAll('[data-severity]').length).toBe(1),
    );
    expect(screen.queryByTestId('pof-cook-log-jump-error')).toBeNull();
  });

  it('copies all lines with timestamps to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'log', line: 'LogCook: Display: cooking package A', t: 5000 },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    fireEvent.click(await screen.findByTestId('pof-cook-log-copy'));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('[00:05]');
    expect(copied).toContain('cooking package A');
  });

  it('toggles the auto-scroll (tail) lock', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'log', line: 'LogCook: Display: cooking package A', t: 1000 },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    const toggle = await screen.findByTestId('pof-cook-log-autoscroll');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders the percent as a count-up label', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'progress', percent: 73 },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    await waitFor(() => expect(screen.getByText('73%')).toBeTruthy());
  });

  it('shows an elapsed timer and an ETA while running, then freezes to a total', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'progress', percent: 45 },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    const elapsed = await screen.findByTestId('pof-cook-progress-elapsed');
    await waitFor(() => expect(elapsed.textContent).toContain('Elapsed'));
    expect(screen.getByTestId('pof-cook-progress-eta').textContent).toContain('ETA');
  });

  it('drops the ETA and switches elapsed to a total when the cook finishes', async () => {
    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'progress', percent: 100 },
      { type: 'done', exePath: 'C:\\out\\PoF.exe' },
    ]) as unknown as typeof fetch;

    render(<CookProgress request={REQUEST} />);

    await screen.findByTestId('pof-cook-progress-result');
    expect(screen.getByTestId('pof-cook-progress-elapsed').textContent).toContain('Total');
    expect(screen.queryByTestId('pof-cook-progress-eta')).toBeNull();
  });

  it('shimmers the active phase label while running and stops once finished', async () => {
    globalThis.fetch = streamingFetch([{ type: 'phase', phase: 'cook' }]) as unknown as typeof fetch;
    const { unmount } = render(<CookProgress request={REQUEST} />);

    const phaseEl = await screen.findByTestId('pof-cook-progress-phase');
    await waitFor(() => expect(phaseEl.className).toContain('cook-phase-shimmer'));
    unmount();

    globalThis.fetch = streamingFetch([
      { type: 'phase', phase: 'cook' },
      { type: 'done', exePath: 'C:\\out\\PoF.exe' },
    ]) as unknown as typeof fetch;
    render(<CookProgress request={REQUEST} />);

    await screen.findByTestId('pof-cook-progress-result');
    expect(screen.getByTestId('pof-cook-progress-phase').className).not.toContain('cook-phase-shimmer');
  });
});
