/**
 * Room detail: disclosure toggles state their expansion, room-type buttons
 * state their selection without colour, and the generate button keeps a
 * focus indicator.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { RoomDetailPanel } from '@/components/modules/content/level-design/RoomDetailPanel';
import type { RoomNode } from '@/types/level-design';

afterEach(cleanup);

const room: RoomNode = {
  id: 'r1', name: 'Crypt', type: 'combat', description: '', encounterDesign: '', difficulty: 3, pacing: 'rest',
  x: 0, y: 0, linkedFiles: [], tags: [],
  spawnEntries: [{ id: 's1', enemyClass: 'BP_Skel', count: 3, spawnDelay: 0, wave: 1 }],
};

function view() {
  return render(
    <RoomDetailPanel room={room} onUpdate={vi.fn()} onGenerateCode={vi.fn()} accentColor="var(--text)" isGenerating={false} />,
  );
}

const byText = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;

describe('RoomDetailPanel state and focus', () => {
  it('both disclosure toggles carry aria-expanded and it follows the click', () => {
    const { container } = view();
    for (const label of ['SPAWN_VECTORS', 'LINKED_ASSETS']) {
      const toggle = byText(container, label);
      const before = toggle.getAttribute('aria-expanded');
      expect(before === 'true' || before === 'false').toBe(true);
      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe(before === 'true' ? 'false' : 'true');
    }
  });

  it('every room-type button exposes aria-pressed and exactly one is pressed', () => {
    const { container } = view();
    const grid = container.querySelector('.grid-cols-4')!;
    const buttons = [...grid.querySelectorAll('button')];
    expect(buttons.length).toBeGreaterThanOrEqual(8);
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === null)).toEqual([]);
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });

  it('the generate button does not suppress its focus outline', () => {
    const { container } = view();
    const classes = byText(container, 'EXECUTE SPAWN SEQUENCE').className.split(/\s+/);
    expect(classes).not.toContain('outline-none');
    expect(classes).toContain('focus-ring');
  });
});
