/**
 * eqs-squad-combat-spatial — the squad member listbox announces a selection
 * model it really has: hover/focus never flip aria-selected, Enter/Space/click
 * pins a member (single-select) and the pin keeps its glyph highlighted.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SquadChoreographyEditor } from '@/components/modules/game-systems/SquadChoreographyEditor';

afterEach(cleanup);

const rows = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>('[data-testid^="squad-member-row-"]'));
const selected = (c: HTMLElement) => rows(c).filter((r) => r.getAttribute('aria-selected') === 'true');
const glyphOf = (c: HTMLElement, row: HTMLElement) =>
  c.querySelector(`[data-testid="squad-member-${row.getAttribute('data-testid')!.replace('squad-member-row-', '')}"]`)!;

describe('SquadChoreographyEditor member listbox', () => {
  it('hover and focus leave aria-selected unchanged', () => {
    const { container } = render(<SquadChoreographyEditor />);
    const list = rows(container);
    expect(list.length).toBeGreaterThan(1);
    expect(selected(container).length).toBe(0);
    fireEvent.pointerEnter(list[0]);
    expect(selected(container).length).toBe(0);
    fireEvent.pointerLeave(list[0]);
    fireEvent.focus(list[1]);
    expect(selected(container).length).toBe(0);
  });

  it('Enter pins the member, marks it selected and highlights its glyph; a second pin moves it', () => {
    const { container } = render(<SquadChoreographyEditor />);
    const list = rows(container);
    expect(glyphOf(container, list[0]).textContent).not.toContain('Score:');
    fireEvent.keyDown(list[0], { key: 'Enter' });
    expect(selected(container)).toEqual([list[0]]);
    expect(glyphOf(container, list[0]).textContent).toContain('Score:');
    fireEvent.click(list[1]);
    expect(selected(container)).toEqual([list[1]]);
    expect(glyphOf(container, list[1]).textContent).toContain('Score:');
    expect(glyphOf(container, list[0]).textContent).not.toContain('Score:');
  });
});
