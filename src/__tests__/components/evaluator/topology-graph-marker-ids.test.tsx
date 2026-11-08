/**
 * scan-sweep night 2026-11-08 (module-topology-graph): the three topology graphs
 * declared document-global SVG ids (`arrow`, `arrow-blocked`, `nexus-arrow`, `glow-red`,
 * `cst-arrow`, `cst-glow` …). `arrow` is also declared by AIComboChoreographer's
 * ComboChainGraph, and the module LRU keeps hidden modules mounted, so `url(#arrow)`
 * can resolve to a foreign marker (other size and colour). Every marker / filter id
 * must be per-instance and every reference must point at its own svg's defs.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { GraphCanvas } from '@/components/modules/evaluator/DependencyGraph/GraphCanvas';
import { NexusGraph } from '@/components/modules/evaluator/NexusView/NexusGraph';
import { FeatureConstellation } from '@/components/modules/evaluator/FeatureConstellation';
import { invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';
import type { SubModuleId } from '@/types/modules';
import type { NexusNode } from '@/components/modules/evaluator/NexusView/types';
import type { ModuleNode } from '@/components/modules/evaluator/DependencyGraph/types';

const noop = () => {};
const FOREIGN = ['arrow', 'arrow-blocked', 'nexus-arrow', 'glow-red', 'glow-purple', 'cst-arrow', 'cst-glow'];

const depNodes: ModuleNode[] = [
  { moduleId: 'arpg-character' as SubModuleId, label: 'Character', color: '', featureCount: 2, blockedCount: 1, implementedCount: 1, cx: 100, cy: 100 },
  { moduleId: 'arpg-combat' as SubModuleId, label: 'Combat', color: '', featureCount: 2, blockedCount: 0, implementedCount: 0, cx: 300, cy: 100 },
];
const nexusNodes = depNodes.map((n) => ({
  ...n, genreItemCount: 1, checklistTotal: 0, checklistDone: 0,
  patternSuccessRate: 0.5, criticalFindings: 2, healthScore: null, sessionCount: null, runSuccessCount: null, avgDurationMs: null,
})) as unknown as NexusNode[];
const edges = [
  { from: 'arpg-character', to: 'arpg-combat', count: 1, hasBlockers: false },
  { from: 'arpg-combat', to: 'arpg-character', count: 1, hasBlockers: true },
];

/** Every `url(#id)` used inside an svg must name an id defined in THAT svg. */
function assertOwnRefs(svg: SVGSVGElement) {
  const own = new Set(Array.from(svg.querySelectorAll('marker, filter')).map((m) => m.getAttribute('id')));
  const refs: string[] = [];
  for (const el of Array.from(svg.querySelectorAll('*'))) {
    for (const attr of ['marker-end', 'filter', 'style']) {
      const v = el.getAttribute(attr) ?? '';
      for (const m of v.matchAll(/url\(#([^)]+)\)/g)) refs.push(m[1]);
    }
  }
  expect(refs.length).toBeGreaterThan(0);
  for (const r of refs) expect(own.has(r)).toBe(true);
  for (const id of own) expect(FOREIGN).not.toContain(id);
}

function assertUniqueIds(container: HTMLElement) {
  const ids = Array.from(container.querySelectorAll('marker, filter')).map((m) => m.getAttribute('id'));
  expect(new Set(ids).size).toBe(ids.length);
}

afterEach(cleanup);

describe('topology graphs — per-instance SVG marker / filter ids', () => {
  it('DependencyGraph GraphCanvas: two mounts beside a foreign #arrow never share an id', () => {
    const props = {
      svgRef: { current: null }, svgWidth: 400, svgHeight: 200, zoom: 1, edges, nodes: depNodes,
      highlightModule: null, selectedModule: null, setSelectedModule: noop, setHoveredModule: noop,
      bridgeConnected: false, moduleCrossRefCounts: new Map(), previewEdges: new Set(['arpg-character->arpg-combat']),
    };
    const { container } = render(
      <div>
        <svg><defs><marker id="arrow" /></defs></svg>
        <GraphCanvas {...props} />
        <GraphCanvas {...props} />
      </div>,
    );
    assertUniqueIds(container);
    const graphs = Array.from(container.querySelectorAll('svg')).slice(1) as SVGSVGElement[];
    expect(graphs).toHaveLength(2);
    graphs.forEach(assertOwnRefs);
  });

  it('NexusGraph: two mounts never share a marker or glow-filter id', () => {
    const props = {
      edges, nodes: nexusNodes, highlightModule: null, activeLayers: new Set(['builds', 'genre'] as const),
      selectedModule: null, setSelectedModule: noop, setHoveredModule: noop, zoom: 1, svgWidth: 400, svgHeight: 200,
    };
    const { container } = render(
      <div>
        <NexusGraph {...props} activeLayers={new Set(['builds'])} />
        <NexusGraph {...props} activeLayers={new Set(['genre'])} />
      </div>,
    );
    assertUniqueIds(container);
    (Array.from(container.querySelectorAll('svg')) as SVGSVGElement[]).forEach(assertOwnRefs);
  });

  describe('FeatureConstellation', () => {
    beforeEach(() => {
      invalidateFeatureStatuses();
      mockFetchRoutes([{
        match: '/api/feature-matrix/all-statuses',
        response: { body: { success: true, data: { statuses: [{ moduleId: 'arpg-character', featureName: 'AARPGCharacterBase', status: 'implemented' }] } } },
      }]);
    });

    it('two mounts never share a marker or glow-filter id', async () => {
      const { container } = render(<div><FeatureConstellation /><FeatureConstellation /></div>);
      await waitFor(() => expect(container.querySelectorAll('svg[role]').length).toBe(2));
      assertUniqueIds(container);
      (Array.from(container.querySelectorAll('svg[role]')) as SVGSVGElement[]).forEach(assertOwnRefs);
    });
  });
});
