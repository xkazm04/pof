import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SchemaTree } from '@/components/modules/core-engine/sub_save/schema/SchemaTree';

afterEach(cleanup);

describe('SchemaTree field details', () => {
  function field() {
    const { container } = render(<SchemaTree expandedGroups={new Set(['character'])} toggleGroup={vi.fn()} />);
    return container.querySelector('[role="treeitem"][aria-label^="PlayerLevel"]') as HTMLElement;
  }

  it('announces the field note, not only its name and type', () => {
    expect(field().getAttribute('aria-label')).toContain('current character level');
  });

  it('reveals the note on keyboard focus as well as hover', () => {
    const note = field().querySelector('span:last-child') as HTMLElement;
    expect(note.className).toContain('group-focus:opacity-100');
  });
});
