/**
 * The compare hint must describe the interaction that actually adds a comparison.
 * Clicking an enemy card expands it (toggleArchetype); only the "+" badge in the card's
 * corner calls toggleCompare. The hint said "Click enemies to compare".
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { CompareHint } from '@/components/modules/core-engine/sub_bestiary/archetypes/CompareHint';
import { ArchetypeGrid } from '@/components/modules/core-engine/sub_bestiary/archetypes/ArchetypeGrid';
import { ARCHETYPES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

afterEach(cleanup);
const noop = () => {};

describe('CompareHint copy', () => {
  it('points at the + badge, not at clicking the enemy', () => {
    const { container } = render(<CompareHint compareIds={[]} compareArchetypes={[]} toggleCompare={noop} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/click enemies/i);
    expect(text).toContain('+');
  });

  it('premise: clicking the card body expands, the + badge compares', () => {
    const items = ARCHETYPES.slice(0, 1);
    const toggleArchetype = vi.fn();
    const toggleCompare = vi.fn();
    const { getByText, container } = render(
      <ArchetypeGrid
        filteredArchetypes={items} paginatedGroups={[{ header: null, items }]}
        groupedArchetypes={[{ header: null, items }]} groupBy="none" totalPages={1} page={0}
        setPage={noop} featureMap={new Map()} expandedArchetype={null} toggleArchetype={toggleArchetype}
        cardModifiers={{}} toggleCardModifier={noop} setCodegenMod={noop}
        compareIds={[]} toggleCompare={toggleCompare} resetFilters={noop}
      />,
    );
    fireEvent.click(getByText(items[0].label));
    expect(toggleArchetype).toHaveBeenCalledWith(items[0].id);
    expect(toggleCompare).not.toHaveBeenCalled();
    const plus = [...container.querySelectorAll('button')].find(b => b.textContent === '+')!;
    fireEvent.click(plus);
    expect(toggleCompare).toHaveBeenCalledWith(items[0].id);
  });
});
