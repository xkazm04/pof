import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import { DRCodeGenerator } from '@/components/modules/core-engine/sub_progression/_internals/DRCodeGenerator';
import {
  DR_CONFIGS, DR_CURVE_TABLE_NAME,
} from '@/components/modules/core-engine/sub_progression/_shared/diminishingReturns';

afterEach(cleanup);

const noop = () => {};

function strengthCard() {
  // The first 'Strength' label is the config card; the chart legend repeats it.
  return screen.getAllByText('Strength', { selector: 'span' })[0].closest('div.p-3') as HTMLElement;
}

describe('DRCodeGenerator', () => {
  it('case 1: the Strength card shows the kernel value "DR: 153.7"', () => {
    render(<DRCodeGenerator configs={DR_CONFIGS} onConfigsChange={noop} />);
    const card = strengthCard();
    expect(card).toBeTruthy();
    expect(within(card).getByText(/^DR:/).textContent).toBe('DR: 153.7');
  });

  it('case 1: no inline falloff sum is left in the component', () => {
    const src = readFileSync(
      resolve(__dirname, '../../../components/modules/core-engine/sub_progression/_internals/DRCodeGenerator/index.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/1\.0 - \(1\.0 - config\.postCapMultiplier\)/);
    expect(src).not.toMatch(/postCap \+=/);
    expect(src).toContain('drEffectiveBonus');
  });

  it('case 6: editing the Strength soft cap leaves the generator through onConfigsChange', () => {
    const spy = vi.fn();
    render(<DRCodeGenerator configs={DR_CONFIGS} onConfigsChange={spy} />);
    const softCapInput = within(strengthCard()).getAllByRole('spinbutton')[0] as HTMLInputElement;
    expect(softCapInput.value).toBe('60');
    fireEvent.change(softCapInput, { target: { value: '45' } });
    expect(spy).toHaveBeenCalledTimes(1);
    const next = spy.mock.calls[0][0] as typeof DR_CONFIGS;
    expect(next[0].softCap).toBe(45);
    expect(next[1]).toBe(DR_CONFIGS[1]);
  });

  it('case 3: the CSV tab copies one importable curve table, no comment lines', () => {
    const { container } = render(<DRCodeGenerator configs={DR_CONFIGS} onConfigsChange={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Curve Table/ }));
    const text = container.querySelector('pre')?.textContent ?? '';
    const lines = text.split('\n');
    expect(lines[0].startsWith('Name,0,5,')).toBe(true);
    expect(lines.some(l => l.startsWith('//'))).toBe(false);
    expect(screen.getByText(`Data/CurveTables/${DR_CURVE_TABLE_NAME}.csv`)).toBeTruthy();
  });
});
