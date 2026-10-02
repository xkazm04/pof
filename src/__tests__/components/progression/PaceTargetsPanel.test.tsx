import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import { PaceTargetsPanel } from '@/components/modules/core-engine/sub_progression/curves/PaceTargetsPanel';
import { MainChartArea } from '@/components/modules/core-engine/sub_progression/curves/MainChartArea';
import { generateChartData } from '@/components/modules/core-engine/sub_progression/_shared/data';
import type { CurveParams } from '@/components/modules/core-engine/sub_progression/_shared/curveModel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const LIVE = { baseXp: 100, curveExp: 1.5 };

function renderPanel(previewing = false) {
  const onPreview = vi.fn<(p: CurveParams) => void>();
  const onApply = vi.fn();
  const onRevert = vi.fn();
  const utils = render(
    <PaceTargetsPanel live={LIVE} previewing={previewing} onPreview={onPreview} onApply={onApply} onRevert={onRevert} />,
  );
  return { ...utils, onPreview, onApply, onRevert };
}

const setRow = (i: number, level: string, hours: string) => {
  fireEvent.change(screen.getByLabelText(`Target ${i} level`), { target: { value: level } });
  fireEvent.change(screen.getByLabelText(`Target ${i} hours`), { target: { value: hours } });
};

describe('PaceTargetsPanel — fit the curve to milestone hours', () => {
  it('case 8a: L10 = 1h, L50 = 20h -> Fit previews 130 / 1.9 and lists 0.99h / 19.64h achieved', () => {
    const { onPreview, onApply, onRevert } = renderPanel();
    // default rows are L10 and the cap, prefilled with the current curve's hours
    expect((screen.getByLabelText('Target 1 level') as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText('Target 2 level') as HTMLInputElement).value).toBe('50');
    expect((screen.getByLabelText('Target 2 hours') as HTMLInputElement).value).toBe('3.98');

    setRow(1, '10', '1');
    setRow(2, '50', '20');
    fireEvent.click(screen.getByRole('button', { name: /^fit$/i }));

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith({ baseXp: 130, curveExp: 1.9 });
    const result = screen.getByTestId('pace-fit-result');
    expect(result.textContent).toContain('0.99h');
    expect(result.textContent).toContain('19.64h');
    expect(within(result).getByTestId('pace-verdict').dataset.verdict).toBe('fit');
    // the fit never applies or reverts on its own
    expect(onApply).not.toHaveBeenCalled();
    expect(onRevert).not.toHaveBeenCalled();
  });

  it('case 8b: case-4 targets report the shape verdict and name L25 as the worst miss', () => {
    const { onPreview } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /add target/i }));
    setRow(1, '10', '1');
    setRow(2, '50', '20');
    setRow(3, '25', '2');
    fireEvent.click(screen.getByRole('button', { name: /^fit$/i }));

    const verdict = screen.getByTestId('pace-verdict');
    expect(verdict.dataset.verdict).toBe('shape');
    expect(verdict.textContent).toMatch(/L25/);
    expect(verdict.textContent).toMatch(/\+98%/);
    expect(verdict.textContent).not.toMatch(/within/i);
    expect(onPreview).toHaveBeenCalledWith({ baseXp: 110, curveExp: 1.85 });
  });

  it('invalid targets explain the problem and do not preview', () => {
    const { onPreview } = renderPanel();
    setRow(1, '10', '0');
    fireEvent.click(screen.getByRole('button', { name: /^fit$/i }));
    expect(onPreview).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/hours/i);
  });

  it('Apply / Revert appear only while a fit is previewed and fire only on click', () => {
    const idle = renderPanel(false);
    expect(screen.queryByRole('button', { name: /apply fit/i })).toBeNull();
    idle.unmount();
    const { onApply, onRevert } = renderPanel(true);
    fireEvent.click(screen.getByRole('button', { name: /apply fit/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /revert/i }));
    expect(onRevert).toHaveBeenCalledTimes(1);
  });
});

describe('MainChartArea — Current / Fitted labels while a fit is previewed', () => {
  const props = {
    chartData: generateChartData(130, 1.9), maxXp: 1, sharedMaxXp: 1, compareMode: true,
    baseXp: 130, curveExp: 1.9,
    snapshotChartData: generateChartData(100, 1.5), snapshotBaseXp: 100, snapshotCurveExp: 1.5,
  };

  it('labels the split pane Current / Fitted when previewing, Snapshot / Live otherwise', () => {
    const { rerender } = render(<MainChartArea {...props} previewing />);
    expect(screen.getByText('Current')).toBeTruthy();
    expect(screen.getByText('Fitted')).toBeTruthy();
    rerender(<MainChartArea {...props} previewing={false} />);
    expect(screen.getByText('Snapshot')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
  });
});
