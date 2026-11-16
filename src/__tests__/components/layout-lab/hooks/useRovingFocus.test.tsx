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

  // The list can SHRINK under the cursor (a tree group collapses, the rail switches to an
  // entity with a shorter pipeline). The active index must stay inside the list, or no item
  // is the tab-stop and the whole list drops out of the Tab order.
  it('keeps exactly one tab-stop when the list shrinks below the active index', () => {
    const onSelect = vi.fn();
    function Sized({ n }: { n: number }) {
      const roving = useRovingFocus(n, 0, onSelect);
      return (
        <div role="listbox" {...roving.containerProps} data-testid="lb">
          {Array.from({ length: n }, (_, i) => (
            <div key={i} role="option" {...roving.itemProps(i)} data-testid={`opt-${i}`}>{i}</div>
          ))}
        </div>
      );
    }
    const { rerender } = render(<Sized n={5} />);
    fireEvent.keyDown(screen.getByTestId('lb'), { key: 'End' }); // active = 4
    rerender(<Sized n={2} />);
    const stops = screen.getAllByRole('option').filter((o) => o.getAttribute('tabindex') === '0');
    expect(stops.map((o) => o.getAttribute('data-testid'))).toEqual(['opt-1']);
    fireEvent.keyDown(screen.getByTestId('lb'), { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(1);
  });
});
