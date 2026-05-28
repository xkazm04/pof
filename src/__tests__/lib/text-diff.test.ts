import { describe, it, expect } from 'vitest';
import { diffPrompts, rowText, type DiffRow } from '@/lib/text-diff';

/** Concatenate every row's text on a given side for quick reconstruction checks. */
function joinSide(rows: DiffRow[], side: 'before' | 'after'): string {
  return rows
    .filter((r) => (side === 'before' ? r.type !== 'add' : r.type !== 'del'))
    .map(rowText)
    .join('\n');
}

describe('diffPrompts — line level', () => {
  it('marks every line equal when the texts are identical', () => {
    const { unified, summary } = diffPrompts('one\ntwo\nthree', 'one\ntwo\nthree');
    expect(unified.every((r) => r.type === 'eq')).toBe(true);
    expect(summary).toEqual({ added: 0, removed: 0, unchanged: 3 });
  });

  it('detects a purely inserted line', () => {
    const { unified, summary } = diffPrompts('a\nc', 'a\nb\nc');
    expect(summary.added).toBe(1);
    expect(summary.removed).toBe(0);
    const added = unified.filter((r) => r.type === 'add');
    expect(added).toHaveLength(1);
    expect(rowText(added[0])).toBe('b');
    // The inserted line has no original line number, but an optimized one.
    expect(added[0].beforeNo).toBeNull();
    expect(added[0].afterNo).toBe(2);
  });

  it('detects a purely deleted line', () => {
    const { unified, summary } = diffPrompts('a\nb\nc', 'a\nc');
    expect(summary.removed).toBe(1);
    expect(summary.added).toBe(0);
    const removed = unified.filter((r) => r.type === 'del');
    expect(removed).toHaveLength(1);
    expect(rowText(removed[0])).toBe('b');
    expect(removed[0].afterNo).toBeNull();
    expect(removed[0].beforeNo).toBe(2);
  });

  it('reconstructs both sides exactly from the unified rows', () => {
    const before = 'Create a sword actor.\nUse UE5 conventions.\nDone.';
    const after = 'You must create a sword actor.\nUse strict UE5 conventions.\nVerify the build.\nDone.';
    const { unified } = diffPrompts(before, after);
    expect(joinSide(unified, 'before')).toBe(before);
    expect(joinSide(unified, 'after')).toBe(after);
  });
});

describe('diffPrompts — word level', () => {
  it('highlights only the changed words on a modified line', () => {
    const { unified } = diffPrompts('Create a sword', 'Create a hammer');
    const del = unified.find((r) => r.type === 'del')!;
    const add = unified.find((r) => r.type === 'add')!;

    // The shared prefix "Create a " is unchanged on both sides.
    expect(del.segments.some((s) => s.type === 'eq' && s.text.includes('Create a'))).toBe(true);
    // Only "sword" is deleted, only "hammer" is inserted.
    expect(del.segments.filter((s) => s.type === 'del').map((s) => s.text).join('')).toBe('sword');
    expect(add.segments.filter((s) => s.type === 'add').map((s) => s.text).join('')).toBe('hammer');
    // A del row never carries 'add' segments and vice versa.
    expect(del.segments.some((s) => s.type === 'add')).toBe(false);
    expect(add.segments.some((s) => s.type === 'del')).toBe(false);
  });

  it('treats a pure prefix addition without flagging existing words as deleted', () => {
    const { unified } = diffPrompts('Create the actor', 'You must create the actor');
    const del = unified.find((r) => r.type === 'del');
    // "Create" vs "create" differ in case, so the first word changes; but
    // "the actor" must remain unchanged (no spurious deletions there).
    expect(del).toBeDefined();
    expect(del!.segments.filter((s) => s.type === 'del').map((s) => s.text).join('')).not.toContain('actor');
  });

  it('each modified del row reconstructs the original line; add row the optimized line', () => {
    const { unified } = diffPrompts('alpha beta gamma', 'alpha BETA gamma delta');
    const del = unified.find((r) => r.type === 'del')!;
    const add = unified.find((r) => r.type === 'add')!;
    expect(rowText(del)).toBe('alpha beta gamma');
    expect(rowText(add)).toBe('alpha BETA gamma delta');
  });
});

describe('diffPrompts — split view', () => {
  it('pairs a modified line on a single split row', () => {
    const { split } = diffPrompts('hello world', 'hello there');
    const changed = split.find((r) => r.left?.type === 'del' && r.right?.type === 'add');
    expect(changed).toBeDefined();
    expect(rowText(changed!.left!)).toBe('hello world');
    expect(rowText(changed!.right!)).toBe('hello there');
  });

  it('puts an equal line on both sides of one split row', () => {
    const { split } = diffPrompts('same\nx', 'same\ny');
    const eqRow = split[0];
    expect(eqRow.left?.type).toBe('eq');
    expect(eqRow.right?.type).toBe('eq');
    expect(rowText(eqRow.left!)).toBe('same');
    expect(rowText(eqRow.right!)).toBe('same');
  });

  it('leaves the opposite side empty for unpaired insertions', () => {
    const { split } = diffPrompts('a\nb', 'a\nb\nc');
    const insertRow = split.find((r) => r.right?.type === 'add' && r.left === null);
    expect(insertRow).toBeDefined();
    expect(rowText(insertRow!.right!)).toBe('c');
  });
});

describe('diffPrompts — edge cases', () => {
  it('handles an empty original (all insertions)', () => {
    const { unified, summary } = diffPrompts('', 'fresh\nprompt');
    expect(summary.added).toBe(2);
    expect(summary.removed).toBe(0);
    expect(unified.every((r) => r.type === 'add')).toBe(true);
  });

  it('handles an empty optimized (all deletions)', () => {
    const { summary } = diffPrompts('gone\nnow', '');
    expect(summary.removed).toBe(2);
    expect(summary.added).toBe(0);
  });
});
