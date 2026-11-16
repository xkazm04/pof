/**
 * Every form control in the bestiary archetype / AI-logic surfaces needs an accessible
 * name (WCAG 4.1.2). A placeholder is not a name, and a visual <label> that neither wraps
 * nor points at its control (htmlFor) names nothing.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { BestiaryFilters } from '@/components/modules/core-engine/sub_bestiary/archetypes/BestiaryFilters';
import { RadarComparison } from '@/components/modules/core-engine/sub_bestiary/archetypes/RadarComparison';
import { ArchetypeBuilder } from '@/components/modules/core-engine/sub_bestiary/archetypes/ArchetypeBuilder';
import { BTFlowchart } from '@/components/modules/core-engine/sub_bestiary/ai-logic/BTFlowchart';

afterEach(cleanup);

const noop = () => {};

function hasName(el: HTMLElement): boolean {
  if (el.getAttribute('aria-label')?.trim()) return true;
  const by = el.getAttribute('aria-labelledby');
  if (by && by.split(/\s+/).some(id => document.getElementById(id)?.textContent?.trim())) return true;
  if (el.closest('label')?.textContent?.trim()) return true;
  if (el.id && [...document.querySelectorAll('label')].some(l => l.htmlFor === el.id && l.textContent?.trim())) return true;
  return false;
}

function unnamed(ui: ReactElement) {
  const { container } = render(ui);
  return [...container.querySelectorAll<HTMLElement>('input, select, textarea')]
    .filter(el => !hasName(el))
    .map(el => el.outerHTML.slice(0, 80));
}

describe('bestiary form controls carry an accessible name', () => {
  it('BestiaryFilters: search + 4 filter selects', () => {
    expect(unnamed(
      <BestiaryFilters
        searchTerm="" setSearchTerm={noop} roleFilter="all" setRoleFilter={noop}
        categoryFilter="all" setCategoryFilter={noop} tierFilter="all" setTierFilter={noop}
        areaFilter="all" setAreaFilter={noop} groupBy="none" setGroupBy={noop} filteredCount={0}
      />,
    )).toEqual([]);
  });

  it('RadarComparison: the enemy filter box', () => {
    expect(unnamed(
      <RadarComparison radarOverlays={{ player: true }} onToggleOverlay={noop} activeOverlays={[]} accent="var(--accent)" />,
    )).toEqual([]);
  });

  it('ArchetypeBuilder: name, stat sliders, behaviour-tree select', () => {
    expect(unnamed(<ArchetypeBuilder />)).toEqual([]);
  });

  it('BTFlowchart: the node search box', () => {
    expect(unnamed(<BTFlowchart expandedNodeId={null} onNodeClick={noop} />)).toEqual([]);
  });
});
