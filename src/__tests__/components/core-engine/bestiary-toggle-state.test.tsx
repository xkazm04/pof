/**
 * Toggle buttons in the bestiary must expose their state, and icon/glyph-only buttons
 * a real name (WCAG 4.1.2). Before: the group-by and decision-filter rows painted the
 * selected option by colour only, the compare badge was named "+" / "1", and the two
 * pagination chevrons had no name at all.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { BestiaryFilters } from '@/components/modules/core-engine/sub_bestiary/archetypes/BestiaryFilters';
import { DecisionDebugger } from '@/components/modules/core-engine/sub_bestiary/ai-logic/DecisionDebugger';
import { ArchetypeGrid } from '@/components/modules/core-engine/sub_bestiary/archetypes/ArchetypeGrid';
import { ARCHETYPES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

afterEach(cleanup);
const noop = () => {};

function pressedStates(buttons: HTMLElement[]) {
  return buttons.map(b => b.getAttribute('aria-pressed'));
}

describe('bestiary toggle state', () => {
  it('BestiaryFilters group-by buttons expose aria-pressed (one true)', () => {
    const { getByRole } = render(
      <BestiaryFilters
        searchTerm="" setSearchTerm={noop} roleFilter="all" setRoleFilter={noop}
        categoryFilter="all" setCategoryFilter={noop} tierFilter="all" setTierFilter={noop}
        areaFilter="all" setAreaFilter={noop} groupBy="tier" setGroupBy={noop} filteredCount={0}
      />,
    );
    const group = getByRole('group', { name: 'Group by' });
    const states = pressedStates(within(group).getAllByRole('button'));
    expect(states).toHaveLength(6);
    expect(states.filter(s => s === 'true')).toHaveLength(1);
    expect(states.filter(s => s === 'false')).toHaveLength(5);
  });

  it('DecisionDebugger filter buttons expose aria-pressed (one true)', () => {
    const { getByRole } = render(<DecisionDebugger />);
    const group = getByRole('group', { name: 'Filter decisions' });
    const states = pressedStates(within(group).getAllByRole('button'));
    expect(states).toEqual(['true', 'false', 'false', 'false']);
  });

  it('ArchetypeGrid compare badges and pagination chevrons have real names', () => {
    const items = ARCHETYPES.slice(0, 2);
    const { getByRole } = render(
      <ArchetypeGrid
        filteredArchetypes={items} paginatedGroups={[{ header: null, items }]}
        groupedArchetypes={[{ header: null, items }]} groupBy="none" totalPages={3} page={1}
        setPage={noop} featureMap={new Map()} expandedArchetype={null} toggleArchetype={noop}
        cardModifiers={{}} toggleCardModifier={noop} setCodegenMod={noop}
        compareIds={[items[0].id]} toggleCompare={noop} resetFilters={noop}
      />,
    );
    const inCompare = getByRole('button', { name: `Remove ${items[0].label} from comparison` });
    expect(inCompare.getAttribute('aria-pressed')).toBe('true');
    const notInCompare = getByRole('button', { name: `Add ${items[1].label} to comparison` });
    expect(notInCompare.getAttribute('aria-pressed')).toBe('false');
    expect(getByRole('button', { name: 'Previous page' })).toBeTruthy();
    expect(getByRole('button', { name: 'Next page' })).toBeTruthy();
  });
});
