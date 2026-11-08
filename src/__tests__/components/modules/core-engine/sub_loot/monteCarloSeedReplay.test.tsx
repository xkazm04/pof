// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { MonteCarloSim } from '@/components/modules/core-engine/sub_loot/simulation/MonteCarloSim';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const run = (container: HTMLElement, label: string) => {
  const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === label)!;
  act(() => { fireEvent.click(btn); });
  return container.querySelector('table')!.textContent;
};

describe('Monte Carlo seed replay', () => {
  it('a typed seed replays identical stats tables even when the clock moves', () => {
    let t = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => (t += 7919));
    const { container } = render(<MonteCarloSim />);
    const input = container.querySelector('#mc-seed') as HTMLInputElement;
    act(() => { fireEvent.change(input, { target: { value: '12345' } }); });
    const a = run(container, '1,000');
    const b = run(container, '1,000');
    expect(b).toBe(a);
    expect(container.textContent).toContain('seed 12345');
  });

  it('a blank seed still draws a fresh seed each run, and Use last seed fills the field', () => {
    let t = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => (t += 7919));
    const { container } = render(<MonteCarloSim />);
    const a = run(container, '1,000');
    const b = run(container, '1,000');
    expect(b).not.toBe(a);
    const use = [...container.querySelectorAll('button')].find((x) => x.textContent === 'Use last seed')!;
    act(() => { fireEvent.click(use); });
    expect((container.querySelector('#mc-seed') as HTMLInputElement).value).toMatch(/^\d+$/);
  });
});
