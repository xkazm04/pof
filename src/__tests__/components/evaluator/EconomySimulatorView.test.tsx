import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Drive the viewport width per test (hoisted so the mock factory can see it).
const { widthRef } = vi.hoisted(() => ({ widthRef: { current: 1440 } }));
vi.mock('@/hooks/useViewportWidth', () => ({
  useViewportWidth: () => widthRef.current,
  useViewportAtLeast: (bp: number) => widthRef.current >= bp,
  WIDE_FALLBACK_WIDTH: 1440,
}));

import {
  ConfigField,
  runBlockReason,
  wealthGridClass,
  WealthDistributionChart,
} from '@/components/modules/evaluator/EconomySimulatorView';
import type { EconomyMetrics, PlayerSnapshot } from '@/types/economy-simulator';

afterEach(cleanup);

/* ── runBlockReason: pure Run-button gate ──────────────────────────────── */

describe('runBlockReason', () => {
  it('returns null when nothing blocks the run', () => {
    expect(runBlockReason({ isSimulating: false, hasConfig: true, invalidLabels: [] })).toBeNull();
  });

  it('blocks while a simulation is already running', () => {
    expect(runBlockReason({ isSimulating: true, hasConfig: true, invalidLabels: [] }))
      .toMatch(/already running/i);
  });

  it('blocks until the config has loaded', () => {
    expect(runBlockReason({ isSimulating: false, hasConfig: false, invalidLabels: [] }))
      .toMatch(/loading/i);
  });

  it('names the out-of-range fields that must be fixed', () => {
    const reason = runBlockReason({
      isSimulating: false,
      hasConfig: true,
      invalidLabels: ['Virtual Players', 'Seed'],
    });
    expect(reason).toContain('Virtual Players');
    expect(reason).toContain('Seed');
    expect(reason).toMatch(/values/i); // plural for >1 field
  });

  it('prioritizes an in-flight run over field errors', () => {
    expect(runBlockReason({ isSimulating: true, hasConfig: true, invalidLabels: ['Seed'] }))
      .toMatch(/already running/i);
  });
});

/* ── ConfigField: inline validation feedback ───────────────────────────── */

function FieldHarness({ initial = 100 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <ConfigField
        label="Virtual Players"
        value={value}
        min={10}
        max={500}
        onChange={setValue}
        onValidity={(_label, e) => setErr(e)}
      />
      <span data-testid="committed">{value}</span>
      <span data-testid="validity">{err ?? 'ok'}</span>
    </div>
  );
}

const field = () => screen.getByLabelText('Virtual Players') as HTMLInputElement;
const committed = () => screen.getByTestId('committed').textContent;
const validity = () => screen.getByTestId('validity').textContent;

describe('ConfigField', () => {
  it('shows the allowed range as a static hint and is valid on first render', () => {
    render(<FieldHarness />);
    expect(screen.getByText('Range 10–500')).toBeTruthy();
    expect(field().getAttribute('aria-invalid')).toBeNull();
    // The input is described by its range hint for assistive tech.
    expect(field().getAttribute('aria-describedby')).toContain(
      screen.getByText('Range 10–500').id,
    );
  });

  it('flags an above-max draft without committing it, blocking via onValidity', () => {
    render(<FieldHarness />);
    fireEvent.change(field(), { target: { value: '9999' } });

    expect(field().getAttribute('aria-invalid')).toBe('true');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/max is 500/i);
    // Out-of-range value is NOT pushed into the config…
    expect(committed()).toBe('100');
    // …and the parent is told the field is invalid (for the Run gate).
    expect(validity()).toMatch(/max is 500/i);
    // aria-describedby now also points at the error.
    expect(field().getAttribute('aria-describedby')).toContain(alert.id);
  });

  it('flags a below-min draft', () => {
    render(<FieldHarness />);
    fireEvent.change(field(), { target: { value: '3' } });
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toMatch(/min is 10/i);
    expect(committed()).toBe('100');
  });

  it('clamps on blur and explains the snap with a brief note', () => {
    render(<FieldHarness />);
    fireEvent.change(field(), { target: { value: '9999' } });
    fireEvent.blur(field());

    expect(committed()).toBe('500'); // clamped to max and committed
    expect(field().value).toBe('500');
    expect(screen.getByRole('status').textContent).toMatch(/clamped to max 500/i);
    expect(field().getAttribute('aria-invalid')).toBeNull(); // valid again
    expect(validity()).toBe('ok');
  });

  it('commits valid in-range values immediately with no error', () => {
    render(<FieldHarness />);
    fireEvent.change(field(), { target: { value: '250' } });
    expect(committed()).toBe('250');
    expect(field().getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(validity()).toBe('ok');
  });

  it('treats a cleared field as invalid, then restores the last value on blur', () => {
    render(<FieldHarness />);
    fireEvent.change(field(), { target: { value: '' } });
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toMatch(/enter 10–500/i);
    expect(committed()).toBe('100'); // unchanged while empty

    fireEvent.blur(field());
    expect(field().value).toBe('100');
    expect(field().getAttribute('aria-invalid')).toBeNull();
    expect(validity()).toBe('ok');
  });
});

/* ── Responsive reflow: wealth Gini/histogram pair ─────────────────────── */

describe('wealthGridClass', () => {
  it('stacks into one column below the 900px breakpoint', () => {
    expect(wealthGridClass(800)).toBe('grid-cols-1');
    expect(wealthGridClass(640)).toBe('grid-cols-1');
  });

  it('keeps the two-up layout at and above the breakpoint', () => {
    expect(wealthGridClass(900)).toBe('grid-cols-2'); // boundary is inclusive of two-up
    expect(wealthGridClass(1440)).toBe('grid-cols-2');
  });
});

describe('WealthDistributionChart reflow', () => {
  const metric = (over: Partial<EconomyMetrics> = {}): EconomyMetrics => ({
    level: 1, hour: 1, avgGold: 100, medianGold: 90, minGold: 10, maxGold: 200,
    totalGold: 1000, giniCoefficient: 0.3, inflowPerHour: 50, outflowPerHour: 40,
    netFlowPerHour: 10, velocity: 0.5, ...over,
  });
  const snapshot = (gold: number): PlayerSnapshot => ({
    level: 10, gold, totalGoldEarned: gold, totalGoldSpent: 0, inventory: {}, playTimeHours: 5,
  });
  const renderChart = () =>
    render(
      <WealthDistributionChart
        metrics={[metric({ hour: 0 }), metric({ hour: 10, giniCoefficient: 0.5 })]}
        snapshots={[snapshot(50), snapshot(500)]}
      />,
    );

  it('renders the Gini/histogram pair side-by-side on a wide viewport', () => {
    widthRef.current = 1440;
    const { container } = renderChart();
    expect(container.querySelector('.grid-cols-2')).toBeTruthy();
    expect(container.querySelector('.grid-cols-1')).toBeNull();
  });

  it('stacks the pair into one column on a narrow/zoomed viewport', () => {
    widthRef.current = 800;
    const { container } = renderChart();
    expect(container.querySelector('.grid-cols-1')).toBeTruthy();
    expect(container.querySelector('.grid-cols-2')).toBeNull();
  });
});
