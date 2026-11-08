/**
 * The pacing report's filters announce their state and its Jump buttons name
 * their target: no unnamed control, stateful chips, unique Jump names.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { PacingReportPanel } from '@/components/modules/content/level-design/PacingReportPanel';
import { lintLevelPacing } from '@/lib/level-design/pacing-linter';
import type { LevelDesignDocument, RoomNode, RoomConnection } from '@/types/level-design';

afterEach(cleanup);

function room(id: string, over: Partial<RoomNode> = {}): RoomNode {
  return {
    id, name: id.toUpperCase(), type: 'exploration', description: '', encounterDesign: '',
    difficulty: 2, pacing: 'rest', x: 0, y: 0, linkedFiles: [], spawnEntries: [], tags: [], ...over,
  };
}
const link = (id: string, fromId: string, toId: string): RoomConnection =>
  ({ id, fromId, toId, bidirectional: false, condition: '' });

// a -> b is a difficulty cliff; c <-> d is an unreachable island: several findings, different rooms.
const rooms = [room('a', { difficulty: 1 }), room('b', { difficulty: 5 }), room('c', { difficulty: 5 }), room('d', { difficulty: 5 })];
const doc: LevelDesignDocument = {
  id: 1, name: 'Doc', description: '', designNarrative: '', rooms,
  connections: [link('1', 'a', 'b'), { ...link('3', 'c', 'd'), bidirectional: true }],
  difficultyArc: rooms.map((r) => r.id), pacingNotes: '', syncStatus: 'unlinked', syncReport: [],
  lastGeneratedAt: null, lastCodeHash: null, createdAt: '', updatedAt: '',
};

function view() {
  return render(<PacingReportPanel doc={doc} accentColor="var(--text)" onSelectRoom={vi.fn()} />);
}

describe('PacingReportPanel accessibility', () => {
  it('[fixture] produces several findings with Jump buttons', () => {
    expect(lintLevelPacing(doc).findings.length).toBeGreaterThan(1);
    expect(view().container.querySelectorAll('button[aria-label^="Jump to"]').length).toBeGreaterThan(1);
  });

  it('the rule select has an accessible name', () => {
    const select = view().container.querySelector('select')!;
    expect(select.getAttribute('aria-label')?.trim()).toBeTruthy();
  });

  it('every severity chip exposes aria-pressed and it follows the active filter', () => {
    const { getByRole, container } = view();
    const chips = [...container.querySelectorAll('button')].filter((b) => !b.getAttribute('aria-label'));
    expect(chips.length).toBeGreaterThan(1);
    expect(chips.filter((b) => b.getAttribute('aria-pressed') === null)).toEqual([]);
    expect(getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('true');
    const other = chips.find((b) => b.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(other);
    expect(other.getAttribute('aria-pressed')).toBe('true');
    expect(getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('Jump buttons name the room and finding, and no two share a name', () => {
    const names = [...view().container.querySelectorAll('button[aria-label^="Jump to"]')]
      .map((b) => b.getAttribute('aria-label')!);
    expect(names.length).toBeGreaterThan(1);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => /Jump to [A-D]: /.test(n))).toBe(true);
  });
});
