import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useRovingFocus } from '@/components/layout-lab/hooks/useRovingFocus';

afterEach(cleanup);

function List({ onSelect }: { onSelect: (i: number) => void }) {
  const items = ['a', 'b', 'c'];
  const roving = useRovingFocus(items.length, 0, onSelect);
  return (
    <div role="listbox" {...roving.containerProps} data-testid="lb">
      {items.map((it, i) => (
        <div key={it} role="option" {...roving.itemProps(i)} data-testid={`opt-${i}`}>{it}</div>
      ))}
    </div>
  );
}

describe('useRovingFocus', () => {
  it('ArrowDown moves the active index; Enter selects', () => {
    const onSelect = vi.fn();
    render(<List onSelect={onSelect} />);
    const lb = screen.getByTestId('lb');
    fireEvent.keyDown(lb, { key: 'ArrowDown' });
    fireEvent.keyDown(lb, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(1);
  });
  it('only the active item is tabbable (roving tabindex)', () => {
    render(<List onSelect={() => {}} />);
    expect(screen.getByTestId('opt-0').getAttribute('tabindex')).toBe('0');
    expect(screen.getByTestId('opt-1').getAttribute('tabindex')).toBe('-1');
  });
  it('j/k also move; Home/End jump to ends', () => {
    const onSelect = vi.fn();
    render(<List onSelect={onSelect} />);
    const lb = screen.getByTestId('lb');
    fireEvent.keyDown(lb, { key: 'End' });
    fireEvent.keyDown(lb, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(2);
    fireEvent.keyDown(lb, { key: 'k' }); // up from 2 -> 1
    fireEvent.keyDown(lb, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
