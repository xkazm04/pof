import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PlaytimeBudgetTargeter } from '@/components/modules/core-engine/sub_world/playtime/PlaytimeBudgetTargeter';
import { STATIC_WORLD } from '@/components/modules/core-engine/sub_world/_shared/data';

afterEach(cleanup);

const setup = () => {
  render(<PlaytimeBudgetTargeter mode="critical" world={STATIC_WORLD} baseline={STATIC_WORLD} applied={[]} dispatch={vi.fn()} />);
  return screen.getByLabelText('Target minutes') as HTMLInputElement;
};

describe('PlaytimeBudgetTargeter typing a target', () => {
  it('keeps a partial value while typing instead of clamping each keystroke', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: '1' } });
    expect(input.value).toBe('1');
    fireEvent.change(input, { target: { value: '12' } });
    expect(input.value).toBe('12');
    fireEvent.change(input, { target: { value: '120' } });
    expect(input.value).toBe('120');
    fireEvent.blur(input);
    expect(input.value).toBe('120');
  });

  it('clamps only when the entry is finished', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);
    expect(input.value).toBe('30');
  });

  it('an emptied field restores the last valid target on blur', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: '90' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    fireEvent.blur(input);
    expect(input.value).toBe('90');
  });
});
