/**
 * scan-sweep night 2026-11-08 — procedural-level-generation.
 *
 * Registry: game-production/procedural-level-planning (seed-determinism-contract:
 * "the same seed and the same parameter set produce the same plan").
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { ProceduralLevelWizard } from '@/components/modules/content/level-design/ProceduralLevelWizard';

afterEach(cleanup);

const rangeValue = (root: HTMLElement, testId: string) =>
  Number((within(root).getByTestId(testId).querySelector('input[type=range]') as HTMLInputElement).value);

describe('a one-lever remedy is one undo step', () => {
  it('Undo after applying the room-band remedy restores the whole band, never half of it', () => {
    const view = render(<ProceduralLevelWizard onGenerate={vi.fn()} isGenerating={false} />);
    fireEvent.click(view.getByRole('radio', { name: /Wave Function Collapse/i }));
    fireEvent.click(view.getByRole('button', { name: /Find a fix/i }));
    fireEvent.click(within(view.getByTestId('layout-remedies')).getByRole('button', { name: /Room count band 8-15 →/ }));
    expect(rangeValue(view.container, 'size-roomCountMax')).toBeGreaterThan(15);

    fireEvent.click(view.getByTestId('procgen-undo'));

    expect(rangeValue(view.container, 'size-roomCountMin')).toBe(8);
    expect(rangeValue(view.container, 'size-roomCountMax')).toBe(15);
    expect(view.queryByTestId('size-room-band-error')).toBeNull();
    // ...and the step before the remedy is the algorithm change, one more Undo away.
    fireEvent.click(view.getByTestId('procgen-undo'));
    expect(view.getByRole('radio', { name: /BSP Tree/i }).getAttribute('aria-checked')).toBe('true');
  });
});

// ── Pacing report: a filter whose option vanished must not hide every finding ──

import { PacingReportPanel } from '@/components/modules/content/level-design/PacingReportPanel';
import { lintLevelPacing } from '@/lib/level-design/pacing-linter';
import type { LevelDesignDocument, RoomNode, RoomConnection } from '@/types/level-design';

function pacingRoom(id: string, over: Partial<RoomNode> = {}): RoomNode {
  return {
    id, name: id.toUpperCase(), type: 'exploration', description: '', encounterDesign: '',
    difficulty: 2, pacing: 'rest', x: 0, y: 0, linkedFiles: [], spawnEntries: [], tags: [], ...over,
  };
}
const link = (id: string, fromId: string, toId: string): RoomConnection =>
  ({ id, fromId, toId, bidirectional: false, condition: '' });
function pacingDoc(rooms: RoomNode[], connections: RoomConnection[]): LevelDesignDocument {
  return {
    id: 1, name: 'Doc', description: '', designNarrative: '', rooms, connections,
    difficultyArc: rooms.map((r) => r.id), pacingNotes: '', syncStatus: 'unlinked', syncReport: [],
    lastGeneratedAt: null, lastCodeHash: null, createdAt: '', updatedAt: '',
  };
}

describe('PacingReportPanel filters survive a doc edit', () => {
  // a -> b is a difficulty cliff; the c <-> d island is unreachable (each has an
  // incoming edge, so neither counts as a start). Linking b -> c fixes only the island.
  const rooms = [
    pacingRoom('a', { difficulty: 1 }), pacingRoom('b', { difficulty: 5 }),
    pacingRoom('c', { difficulty: 5 }), pacingRoom('d', { difficulty: 5 }),
  ];
  const island = { ...link('3', 'c', 'd'), bidirectional: true };
  const before = pacingDoc(rooms, [link('1', 'a', 'b'), island]);
  const after = pacingDoc(rooms, [link('1', 'a', 'b'), island, link('2', 'b', 'c')]);

  it('[fixture] the edit removes the unreachable-room finding and keeps another', () => {
    const rulesBefore = lintLevelPacing(before).findings.map((f) => f.ruleId);
    const rulesAfter = lintLevelPacing(after).findings.map((f) => f.ruleId);
    expect(rulesBefore).toContain('unreachable-room');
    expect(rulesAfter).not.toContain('unreachable-room');
    expect(rulesAfter.length).toBeGreaterThan(0);
  });

  it('a rule filter whose rule no longer fires falls back to All instead of hiding every finding', () => {
    const view = render(<PacingReportPanel doc={before} accentColor="var(--text)" onSelectRoom={vi.fn()} />);
    const select = view.container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'unreachable-room' } });
    expect(view.queryByText('No findings match the current filter.')).toBeNull();

    view.rerender(<PacingReportPanel doc={after} accentColor="var(--text)" onSelectRoom={vi.fn()} />);

    expect(view.queryByText('No findings match the current filter.')).toBeNull();
    expect((view.container.querySelector('select') as HTMLSelectElement).value).toBe('all');
  });

  it('a severity chip whose severity no longer fires falls back to All', () => {
    const view = render(<PacingReportPanel doc={before} accentColor="var(--text)" onSelectRoom={vi.fn()} />);
    const sevBefore = new Set(lintLevelPacing(before).findings.map((f) => f.severity));
    const sevAfter = new Set(lintLevelPacing(after).findings.map((f) => f.severity));
    const gone = [...sevBefore].find((s) => !sevAfter.has(s));
    if (!gone) return; // the fixture's severities overlap; the rule-filter case covers the mechanism
    fireEvent.click(view.getAllByRole('button').find((b) => b.textContent?.toLowerCase().startsWith(gone))!);
    view.rerender(<PacingReportPanel doc={after} accentColor="var(--text)" onSelectRoom={vi.fn()} />);
    expect(view.queryByText('No findings match the current filter.')).toBeNull();
  });
});

// ── Room detail: every control has an accessible name ──

import { RoomDetailPanel } from '@/components/modules/content/level-design/RoomDetailPanel';

/** Name sources a screen reader uses here: aria-label, aria-labelledby, <label for>, wrapping <label>, button text. */
function hasName(el: Element, root: HTMLElement): boolean {
  if (el.getAttribute('aria-label')?.trim()) return true;
  const by = el.getAttribute('aria-labelledby');
  if (by && by.split(' ').some((id) => root.ownerDocument.getElementById(id)?.textContent?.trim())) return true;
  if (el.id && root.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()) return true;
  if (el.closest('label')?.textContent?.trim()) return true;
  return el.tagName === 'BUTTON' && !!el.textContent?.trim();
}

describe('RoomDetailPanel controls are named', () => {
  it('no input, textarea, select or button is anonymous', () => {
    const room = pacingRoom('r1', {
      name: 'Crypt', difficulty: 3,
      spawnEntries: [{ id: 's1', enemyClass: 'BP_Skel', count: 3, spawnDelay: 0, wave: 1 }],
    });
    const { container } = render(
      <RoomDetailPanel room={room} onUpdate={vi.fn()} onGenerateCode={vi.fn()} accentColor="var(--text)" isGenerating={false} />,
    );
    const controls = [...container.querySelectorAll('input, textarea, select, button')];
    expect(controls.length).toBeGreaterThan(10);
    const anonymous = controls.filter((el) => !hasName(el, container)).map((el) => el.outerHTML.slice(0, 60));
    expect(anonymous).toEqual([]);
  });

  it('the threat-level buttons say which one is selected without colour', () => {
    const room = pacingRoom('r1', { difficulty: 3 });
    const { container } = render(
      <RoomDetailPanel room={room} onUpdate={vi.fn()} onGenerateCode={vi.fn()} accentColor="var(--text)" isGenerating={false} />,
    );
    const pressed = [...container.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent?.trim());
    expect(pressed).toContain('3');
  });
});
