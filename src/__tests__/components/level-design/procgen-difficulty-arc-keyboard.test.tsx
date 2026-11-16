import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { RoomNode } from '@/types/level-design';

afterEach(cleanup);

const pacingRoom = (id: string, over: Partial<RoomNode> = {}): RoomNode => ({
  id, name: id, type: 'exploration', description: '', encounterDesign: '',
  difficulty: 2, pacing: 'rest', x: 0, y: 0, linkedFiles: [], spawnEntries: [], tags: [], ...over,
});

// ── Difficulty arc: a clickable point is reachable from the keyboard ──

import { DifficultyArcChart } from '@/components/modules/content/level-design/DifficultyArcChart';

describe('DifficultyArcChart points', () => {
  const arcRooms = [pacingRoom('a', { name: 'Gate', difficulty: 1 }), pacingRoom('b', { name: 'Vault', difficulty: 4 })];

  it('each point is a named button that Enter and Space activate', () => {
    const onSelect = vi.fn();
    const view = render(<DifficultyArcChart rooms={arcRooms} difficultyArc={[]} accentColor="var(--text)" onSelectRoom={onSelect} />);
    const point = view.getByRole('button', { name: /Vault/ });
    expect(point.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(point, { key: 'Enter' });
    fireEvent.keyDown(point, { key: ' ' });
    expect(onSelect.mock.calls).toEqual([['b'], ['b']]);
  });
});
