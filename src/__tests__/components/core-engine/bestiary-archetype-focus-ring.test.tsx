/**
 * Follow-up to bestiary-focus-ring.test.tsx for the controls it did not reach: the
 * archetype filters, the radar filter, the BT search and the archetype card's own toggle
 * stripped the outline (outline-none / focus:outline-none) and replaced it with nothing
 * or with a border tinted by an --accent variable the bestiary never sets (WCAG 2.4.7).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { BestiaryFilters } from '@/components/modules/core-engine/sub_bestiary/archetypes/BestiaryFilters';
import { RadarComparison } from '@/components/modules/core-engine/sub_bestiary/archetypes/RadarComparison';
import { ArchetypeCard } from '@/components/modules/core-engine/sub_bestiary/archetypes/ArchetypeCard';
import { BTFlowchart } from '@/components/modules/core-engine/sub_bestiary/ai-logic/BTFlowchart';
import { ARCHETYPES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

afterEach(cleanup);
const noop = () => {};

function strippedFocus(ui: ReactElement, selector: string) {
  const { container } = render(ui);
  return [...container.querySelectorAll<HTMLElement>(selector)]
    .filter(el => /(^|\s)(focus:)?outline-none(\s|$)/.test(el.className) && !el.className.includes('focus-ring'))
    .map(el => el.outerHTML.slice(0, 60));
}

describe('bestiary archetype controls keep a visible focus ring', () => {
  it('BestiaryFilters search + selects', () => {
    expect(strippedFocus(
      <BestiaryFilters
        searchTerm="" setSearchTerm={noop} roleFilter="all" setRoleFilter={noop}
        categoryFilter="all" setCategoryFilter={noop} tierFilter="all" setTierFilter={noop}
        areaFilter="all" setAreaFilter={noop} groupBy="none" setGroupBy={noop} filteredCount={0}
      />, 'input, select')).toEqual([]);
  });

  it('RadarComparison filter box', () => {
    expect(strippedFocus(
      <RadarComparison radarOverlays={{ player: true }} onToggleOverlay={noop} activeOverlays={[]} accent="var(--accent)" />,
      'input')).toEqual([]);
  });

  it('BTFlowchart search box', () => {
    expect(strippedFocus(<BTFlowchart expandedNodeId={null} onNodeClick={noop} />, 'input')).toEqual([]);
  });

  it('ArchetypeCard expand toggle', () => {
    expect(strippedFocus(
      <ArchetypeCard archetype={ARCHETYPES[0]} featureMap={new Map()} expanded={false} onToggle={noop}
        activeModifiers={[]} onToggleModifier={noop} onViewCodegen={noop} />,
      'button')).toEqual([]);
  });
});
