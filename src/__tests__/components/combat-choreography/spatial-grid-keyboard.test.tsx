import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SpatialGrid } from '@/components/modules/core-engine/sub_combat/choreography/SpatialGrid';
import type { PlacedEnemy } from '@/lib/combat/choreography-sim';
import { GRID_COLS, GRID_ROWS } from '@/components/modules/core-engine/sub_combat/choreography/types';

afterEach(cleanup);

const enemy: PlacedEnemy = { id: 'e1', archetypeId: 'melee-grunt', gridX: 0, gridY: 0, waveIndex: 0, level: 3 } as PlacedEnemy;

function setup(enemies: PlacedEnemy[] = []) {
  const onPlace = vi.fn();
  const onRemove = vi.fn();
  const onMove = vi.fn();
  const utils = render(
    <SpatialGrid enemies={enemies} selectedWave={0} totalWaves={1} onPlace={onPlace} onRemove={onRemove} onMove={onMove} />,
  );
  const cells = () => [...utils.container.querySelectorAll<HTMLElement>('[role="gridcell"]')];
  return { ...utils, cells, onPlace, onRemove, onMove };
}

describe('SpatialGrid is keyboard operable', () => {
  it('exposes every cell as a gridcell with a single roving tab stop', () => {
    const { cells } = setup([enemy]);
    expect(cells()).toHaveLength(GRID_COLS * GRID_ROWS);
    expect(cells().filter((c) => c.tabIndex === 0)).toHaveLength(1);
    expect(cells().filter((c) => c.tabIndex === -1)).toHaveLength(GRID_COLS * GRID_ROWS - 1);
  });

  it('ArrowRight and ArrowDown move focus', () => {
    const { cells } = setup();
    const first = cells()[0];
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cells()[1]);
    expect(cells()[1].tabIndex).toBe(0);
    fireEvent.keyDown(cells()[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cells()[1 + GRID_COLS]);
  });

  it('Enter on an empty cell places, Enter on an enemy removes', () => {
    const { cells, onPlace, onRemove } = setup([enemy]);
    fireEvent.keyDown(cells()[1], { key: 'Enter' });
    expect(onPlace).toHaveBeenCalledWith(1, 0);
    fireEvent.keyDown(cells()[0], { key: ' ' });
    expect(onRemove).toHaveBeenCalledWith('e1');
  });

  it('Alt+Arrow moves an enemy to the adjacent free cell', () => {
    const { cells, onMove } = setup([enemy]);
    fireEvent.keyDown(cells()[0], { key: 'ArrowRight', altKey: true });
    expect(onMove).toHaveBeenCalledWith('e1', 1, 0);
  });
});
