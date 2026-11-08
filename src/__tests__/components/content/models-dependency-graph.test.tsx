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

describe('DependencyGraph truncated node names', () => {
  it('every node whose label is cut keeps its full name and path as a node title', () => {
    const center = scanned('Meshes/SM_Castle_Gatehouse_Ruined.uasset', 'mesh');
    const target = scanned('Materials/MI_Castle_Gatehouse_Ruined_Moss.uasset', 'material');
    const edge: InventoryEdge = { from: center.relativePath, to: target.relativePath, relation: 'uses-material', provenance: 'inferred' };
    const { container } = render(
      <DependencyGraph asset={center} allAssets={[center, target]} dependencies={[edge]} ueListed={null} />,
    );
    const texts = Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent ?? '');
    expect(texts.some((t) => t.endsWith('…'))).toBe(true);
    const nodeTitles = Array.from(container.querySelectorAll('svg g > title, svg > g > title'))
      .map((t) => t.textContent ?? '');
    expect(nodeTitles.some((t) => t.includes(target.name) && t.includes(target.relativePath))).toBe(true);
    expect(nodeTitles.some((t) => t.includes(center.name) && t.includes(center.relativePath))).toBe(true);
  });
});

describe('DependencyGraph hub asset', () => {
  const hub = scanned('Materials/M_Master.uasset', 'material');
  const insts = Array.from({ length: 300 }, (_, i) => scanned(`Materials/MI_Inst_${i}.uasset`, 'material'));
  const edges: InventoryEdge[] = insts.map((m) => ({ from: m.relativePath, to: hub.relativePath, relation: 'uses-material', provenance: 'declared' }));

  it('caps 300 inbound edges at 12 rows, shows a +N more node and lists the rest', () => {
    const { container } = render(
      <DependencyGraph asset={hub} allAssets={[hub, ...insts]} dependencies={edges} ueListed={true} />,
    );
    const svg = Array.from(container.querySelectorAll('svg')).find((s) => s.querySelector('line[marker-end]'))!;
    expect(Number(svg.getAttribute('height'))).toBeLessThanOrEqual(12 * 34 + 20);
    expect(svg.querySelectorAll('line[marker-end]').length).toBe(11);
    expect(svg.querySelector('[data-testid="dependency-more"]')!.textContent).toContain('+289 more');
    expect(container.querySelectorAll('[data-testid="dependency-overflow"] li').length).toBe(289);
  });

  it('[guard] a small fan-in draws every edge and no overflow', () => {
    const { container } = render(
      <DependencyGraph asset={hub} allAssets={[hub, ...insts]} dependencies={edges.slice(0, 5)} ueListed={true} />,
    );
    expect(container.querySelectorAll('line[marker-end]').length).toBe(5);
    expect(container.querySelector('[data-testid="dependency-more"]')).toBeNull();
    expect(container.querySelector('[data-testid="dependency-overflow"]')).toBeNull();
  });
});
