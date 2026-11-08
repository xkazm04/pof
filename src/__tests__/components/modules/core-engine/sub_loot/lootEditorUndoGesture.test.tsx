import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { LootTableEditor } from '@/components/modules/core-engine/sub_loot/affix/LootTableEditor';

afterEach(() => cleanup());

function setup() {
  const { container } = render(<LootTableEditor />);
  const slider = () => container.querySelector('input[type="range"]') as HTMLInputElement;
  const undo = within(container).getByText('Undo') as HTMLButtonElement;
  return { slider, undo };
}

describe('loot editor undo is one step per slider gesture', () => {
  it('two separate drags on the same row take two undos', () => {
    const { slider, undo } = setup();
    const w0 = Number(slider().value);
    fireEvent.change(slider(), { target: { value: String(w0 + 1) } });
    fireEvent.change(slider(), { target: { value: String(w0 + 2) } });
    fireEvent.pointerUp(slider());
    fireEvent.change(slider(), { target: { value: String(w0 + 5) } });
    fireEvent.change(slider(), { target: { value: String(w0 + 6) } });
    fireEvent.pointerUp(slider());
    fireEvent.click(undo);
    expect(Number(slider().value)).toBe(w0 + 2);
    fireEvent.click(undo);
    expect(Number(slider().value)).toBe(w0);
  });

  it('a continuous drag with no release is still one undo step', () => {
    const { slider, undo } = setup();
    const w0 = Number(slider().value);
    for (const d of [1, 2, 3, 4]) fireEvent.change(slider(), { target: { value: String(w0 + d) } });
    fireEvent.click(undo);
    expect(Number(slider().value)).toBe(w0);
  });
});
