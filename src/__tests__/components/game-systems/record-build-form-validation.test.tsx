/**
 * The manual Record form may not write a number nobody typed.
 *
 * `Math.round(parseFloat('abc') * GiB)` is NaN, which JSON.stringify sends as null and
 * the route stores as "size unknown" without a word; '-2' was stored as a negative size.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { RecordBuildForm } from '@/components/modules/game-systems/BuildHistoryDashboard/RecordBuildForm';

afterEach(cleanup);

function setup() {
  const onSubmit = vi.fn();
  const { container } = render(<RecordBuildForm onSubmit={onSubmit} nextVersion="0.1.1" />);
  const size = screen.getByPlaceholderText('0.0') as HTMLInputElement;
  const dur = screen.getByPlaceholderText('0') as HTMLInputElement;
  const submit = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Record Build')) as HTMLButtonElement;
  return { onSubmit, size, dur, submit, container };
}

describe('RecordBuildForm numeric inputs', () => {
  it.each(['abc', '-2', '1..5'])('refuses size %s instead of recording a guess', (bad) => {
    const { onSubmit, size, submit } = setup();
    fireEvent.change(size, { target: { value: bad } });
    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent ?? '').toMatch(/size/i);
  });

  it('refuses a non-numeric duration', () => {
    const { onSubmit, dur, submit } = setup();
    fireEvent.change(dur, { target: { value: 'ten' } });
    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent ?? '').toMatch(/duration/i);
  });

  it('records valid and blank values', () => {
    const { onSubmit, size, submit } = setup();
    fireEvent.change(size, { target: { value: '1.5' } });
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.sizeBytes).toBe(Math.round(1.5 * 1024 ** 3));
    expect(arg.durationMs).toBeUndefined();
  });
});
