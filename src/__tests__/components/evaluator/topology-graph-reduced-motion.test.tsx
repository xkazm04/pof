/**
 * scan-sweep night 2026-11-08 (module-topology-graph): two SVG SMIL pulses loop forever
 * (`<animate repeatCount="indefinite">`) — Nexus's critical-findings glow and the
 * Constellation's "do this next" ring. SMIL is outside framer-motion's
 * `reducedMotion="user"` policy and outside the CSS reduced-motion reset, so they kept
 * pulsing for users who asked for reduced motion. Under that preference the ring stays
 * (static, still marking the node) and the <animate> is not rendered.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

let reduced = false;
vi.mock('framer-motion', async (orig) => ({
  ...(await orig<typeof import('framer-motion')>()),
  useReducedMotion: () => reduced,
}));

import { NexusGraph } from '@/components/modules/evaluator/NexusView/NexusGraph';
import { ConstellationNodeG } from '@/components/modules/evaluator/FeatureConstellation/ConstellationNodeG';
import type { NexusNode } from '@/components/modules/evaluator/NexusView/types';
import type { ConstellationNode } from '@/lib/constellation/layout';

afterEach(() => { cleanup(); reduced = false; });

const noop = () => {};
const NEXUS_NODE = {
  moduleId: 'arpg-combat', label: 'Combat', cx: 100, cy: 100, featureCount: 2, implementedCount: 1, blockedCount: 0,
  genreItemCount: 0, checklistTotal: 0, checklistDone: 0,
  patternSuccessRate: null, criticalFindings: 3, healthScore: null, sessionCount: null, runSuccessCount: null, avgDurationMs: null,
} as unknown as NexusNode;

const CST_NODE = {
  key: 'arpg-character::Base', featureName: 'Base', category: 'core', description: '', status: 'missing',
  x: 100, y: 100, deps: [], blockers: [], isBlocked: false, dependentCount: 2,
} as unknown as ConstellationNode;

function renderNexus() {
  return render(
    <NexusGraph
      edges={[]} nodes={[NEXUS_NODE]} highlightModule={null} activeLayers={new Set(['builds'])}
      selectedModule={null} setSelectedModule={noop} setHoveredModule={noop} zoom={1} svgWidth={300} svgHeight={200}
    />,
  );
}

function renderCst() {
  return render(
    <svg><ConstellationNodeG node={CST_NODE} index={0} isNext glowId="g" dimmed={false} onHoverStart={noop} onHoverEnd={noop} /></svg>,
  );
}

describe('topology graphs honour prefers-reduced-motion for SMIL pulses', () => {
  it('Nexus critical-findings glow: pulses normally, static under reduced motion', () => {
    expect(renderNexus().container.querySelectorAll('animate')).toHaveLength(1);
    cleanup();
    reduced = true;
    const { container } = renderNexus();
    expect(container.querySelectorAll('animate')).toHaveLength(0);
    expect(container.querySelector('rect[filter]')).not.toBeNull();
  });

  it('Constellation "do this next" ring: pulses normally, static under reduced motion', () => {
    expect(renderCst().container.querySelectorAll('animate')).toHaveLength(1);
    cleanup();
    reduced = true;
    const { container } = renderCst();
    expect(container.querySelectorAll('animate')).toHaveLength(0);
    expect(container.querySelector('rect[filter="url(#g)"]')).not.toBeNull();
  });
});
