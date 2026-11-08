/**
 * The Asset Inventory dependency graph (models-asset-inventory, night 2026-11-08).
 *
 * Marker id: the graph's arrowheads used a document-global `<marker id="arrowhead">`,
 * the same id ability TagDepsSection declares (TacticsMap already fixed its copy,
 * see bestiary-tactics-marker-id.test.tsx). The module LRU keeps hidden modules
 * mounted, so `url(#arrowhead)` could resolve to the foreign marker. Per-instance id.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DependencyGraph } from '@/components/modules/content/models/AssetInventory/DependencyGraph';
import type { InventoryEdge } from '@/lib/asset-inventory/declared-edges';
import { scanned } from '@/__tests__/lib/asset-inventory/design-doc-fixture';

afterEach(cleanup);

const MESH = scanned('Meshes/SM_Rock.uasset', 'mesh');
const MAT = scanned('Materials/M_Rock.uasset', 'material');
const EDGE: InventoryEdge = { from: MESH.relativePath, to: MAT.relativePath, relation: 'uses-material', provenance: 'inferred' };

describe('DependencyGraph arrow marker id', () => {
  it('is unique per instance, never the shared "arrowhead" id, and every edge points at its own', () => {
    const { container } = render(
      <div>
        <svg><defs><marker id="arrowhead" /></defs></svg>
        <DependencyGraph asset={MESH} allAssets={[MESH, MAT]} dependencies={[EDGE]} ueListed={null} />
        <DependencyGraph asset={MAT} allAssets={[MESH, MAT]} dependencies={[EDGE]} ueListed={null} />
      </div>,
    );
    const ids = Array.from(container.querySelectorAll('marker')).map((m) => m.getAttribute('id'));
    expect(new Set(ids).size).toBe(ids.length);

    const graphs = Array.from(container.querySelectorAll('svg')).filter((s) => s.querySelector('line[marker-end]'));
    expect(graphs).toHaveLength(2);
    for (const svg of graphs) {
      const own = svg.querySelector('marker')!.getAttribute('id');
      expect(own).not.toBe('arrowhead');
      const refs = Array.from(svg.querySelectorAll('[marker-end]')).map((l) => l.getAttribute('marker-end'));
      expect(refs.length).toBeGreaterThan(0);
      for (const r of refs) expect(r).toBe(`url(#${own})`);
    }
  });
});
