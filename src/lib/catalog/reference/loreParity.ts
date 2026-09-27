import type { GraphEdge, GraphNode } from '@/lib/catalog/acceptance/graphCheckers';

export interface LoreGraphEntity {
  id: string;
  name: string;
  aliases: string[];
  kind: string;
}

export interface LoreGraphFact {
  subject: string;
  relation: string;
  object: string;
  textIds: string[];
  speakers: string[];
  status: 'stated' | 'implied' | 'rumoured';
  optional?: boolean;
}

export interface LoreFactGraph {
  entities: LoreGraphEntity[];
  facts: LoreGraphFact[];
  timeline?: unknown;
  consistency?: unknown;
  codexFit?: unknown;
}

export interface LoreParityEntry {
  entityId: string;
  name: string;
  textIds: string[];
}

export interface LoreParityArtifact {
  catalogId?: string;
  entityId: string;
  step: string;
  data: Record<string, unknown>;
}

export interface ResolvedLoreEdge extends GraphEdge {
  fromEntities: string[];
  toEntities: string[];
}

export interface LoreParityEntryResult {
  entityId: string;
  name: string;
  textIds: string[];
  referenceFacts: LoreGraphFact[];
  referencePairs: number;
  coveredReferencePairs: number;
  producedEdges: GraphEdge[];
  supported: ResolvedLoreEdge[];
  unsupported: ResolvedLoreEdge[];
  unresolvedNodes: GraphNode[];
  precision: number | null;
  recall: number | null;
}

export interface LoreParityTotals {
  entries: number;
  referenceFacts: number;
  referencePairs: number;
  coveredReferencePairs: number;
  producedEdges: number;
  supported: number;
  unsupported: number;
  unresolvedNodes: number;
  precision: number | null;
  recall: number | null;
}

export interface LoreParityResult {
  entries: LoreParityEntryResult[];
  totals: LoreParityTotals;
}

const normalize = (value: string): string => value.trim().toLocaleLowerCase('en-US');
/** Slug form shared by names, aliases, graph ids and produced node ids/labels: case-folded, a leading article dropped,
 *  every non-alphanumeric run collapsed to '-' (so 'The Burning Hells', 'burning-hells' and 'Burning Hells' meet). */
const slugKey = (value: string): string => normalize(value).replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const pairKey = (left: string, right: string): string => [left, right].sort().join('\u0000');

const graphOf = (artifact: LoreParityArtifact): { nodes: GraphNode[]; edges: GraphEdge[] } => {
  const value = artifact.data.graph;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { nodes: [], edges: [] };
  const candidate = value as { nodes?: unknown; edges?: unknown };
  const nodes = Array.isArray(candidate.nodes)
    ? candidate.nodes.filter((node): node is GraphNode => !!node && typeof node === 'object' && typeof (node as GraphNode).id === 'string')
    : [];
  const edges = Array.isArray(candidate.edges)
    ? candidate.edges.filter((edge): edge is GraphEdge => !!edge && typeof edge === 'object'
      && typeof (edge as GraphEdge).from === 'string' && typeof (edge as GraphEdge).to === 'string')
    : [];
  return { nodes, edges };
};

/**
 * Compares produced codex cross-reference edges with a text-sourced fact graph.
 *
 * Node matching compares slug keys (case-folded, leading article dropped, punctuation runs → '-'): a produced
 * node matches by its id AND its label, against every graph entity's id, name and aliases. For `<catalog>::<id>`
 * the suffix is compared; a `codex::` id that names a supplied entry is also mapped to that entry's name.
 * (W42: matching ids against names only read 85 of 103 real edges as unresolved — 'burning-hells' / 'Burning Hells'
 * never met the graph's own entity.) Fact and edge direction is ignored, and repeated facts for the same entity pair
 * count once for recall. Precision is supported edges / all produced edges; recall is covered reference pairs /
 * reference pairs. An empty denominator yields null (nothing to measure), never a 0 that reads as a failure.
 */
export function loreParity({
  graph,
  entries,
  artifacts,
}: {
  graph: LoreFactGraph;
  entries: readonly LoreParityEntry[];
  artifacts: readonly LoreParityArtifact[];
}): LoreParityResult {
  const entitiesByName = new Map<string, Set<string>>();
  for (const entity of graph.entities) {
    for (const value of [entity.id, entity.name, ...entity.aliases]) {
      const key = slugKey(value);
      const matches = entitiesByName.get(key) ?? new Set<string>();
      matches.add(entity.id);
      entitiesByName.set(key, matches);
    }
  }

  const codexNamesById = new Map<string, Set<string>>();
  for (const entry of entries) {
    const key = normalize(entry.entityId);
    const names = codexNamesById.get(key) ?? new Set<string>();
    names.add(entry.name);
    codexNamesById.set(key, names);
  }

  const resolve = (nodeId: string, label?: string): string[] => {
    const separator = nodeId.indexOf('::');
    const candidate = separator >= 0 ? nodeId.slice(separator + 2) : nodeId;
    const names = label ? [candidate, label] : [candidate];
    if (separator >= 0 && normalize(nodeId.slice(0, separator)) === 'codex') {
      names.push(...(codexNamesById.get(normalize(candidate)) ?? []));
    }
    const matches = new Set<string>();
    for (const name of names) {
      for (const entityId of entitiesByName.get(slugKey(name)) ?? []) matches.add(entityId);
    }
    return [...matches].sort();
  };

  const results = entries.map((entry): LoreParityEntryResult => {
    const textIds = new Set(entry.textIds);
    const ownEntities = new Set(resolve(entry.name));
    const referenceFacts = graph.facts.filter((fact) => (
      fact.textIds.some((textId) => textIds.has(textId))
      || ownEntities.has(fact.subject)
      || ownEntities.has(fact.object)
    ));
    const referencePairKeys = new Set(referenceFacts.map((fact) => pairKey(fact.subject, fact.object)));

    const matchingArtifacts = artifacts.filter((artifact) => artifact.entityId === entry.entityId
      && artifact.step === 'Cross-References'
      && (artifact.catalogId === undefined || artifact.catalogId === 'codex'));
    const producedGraphs = matchingArtifacts.map(graphOf);
    const producedEdges = producedGraphs.flatMap((produced) => produced.edges);
    const nodes = producedGraphs.flatMap((produced) => produced.nodes);

    const labelOf = new Map(nodes.map((node) => [node.id, node.label]));
    const resolveNode = (id: string): string[] => resolve(id, labelOf.get(id));
    const unresolvedNodes: GraphNode[] = [];
    const seenUnresolved = new Set<string>();
    for (const node of nodes) {
      if (resolveNode(node.id).length || seenUnresolved.has(node.id)) continue;
      seenUnresolved.add(node.id);
      unresolvedNodes.push(node);
    }

    const supported: ResolvedLoreEdge[] = [];
    const unsupported: ResolvedLoreEdge[] = [];
    const coveredPairs = new Set<string>();
    for (const edge of producedEdges) {
      const fromEntities = resolveNode(edge.from);
      const toEntities = resolveNode(edge.to);
      if (!fromEntities.length || !toEntities.length) continue;
      const resolvedEdge = { ...edge, fromEntities, toEntities };
      const linkedPairs = fromEntities.flatMap((from) => toEntities.map((to) => pairKey(from, to)));
      const supportedPairs = linkedPairs.filter((pair) => referencePairKeys.has(pair));
      if (supportedPairs.length) {
        supported.push(resolvedEdge);
        for (const pair of supportedPairs) coveredPairs.add(pair);
      } else {
        unsupported.push(resolvedEdge);
      }
    }

    return {
      entityId: entry.entityId,
      name: entry.name,
      textIds: [...entry.textIds],
      referenceFacts,
      referencePairs: referencePairKeys.size,
      coveredReferencePairs: coveredPairs.size,
      producedEdges,
      supported,
      unsupported,
      unresolvedNodes,
      precision: producedEdges.length ? supported.length / producedEdges.length : null,
      recall: referencePairKeys.size ? coveredPairs.size / referencePairKeys.size : null,
    };
  });

  const totals = results.reduce<LoreParityTotals>((sum, entry) => ({
    entries: sum.entries + 1,
    referenceFacts: sum.referenceFacts + entry.referenceFacts.length,
    referencePairs: sum.referencePairs + entry.referencePairs,
    coveredReferencePairs: sum.coveredReferencePairs + entry.coveredReferencePairs,
    producedEdges: sum.producedEdges + entry.producedEdges.length,
    supported: sum.supported + entry.supported.length,
    unsupported: sum.unsupported + entry.unsupported.length,
    unresolvedNodes: sum.unresolvedNodes + entry.unresolvedNodes.length,
    precision: 0,
    recall: 0,
  }), {
    entries: 0,
    referenceFacts: 0,
    referencePairs: 0,
    coveredReferencePairs: 0,
    producedEdges: 0,
    supported: 0,
    unsupported: 0,
    unresolvedNodes: 0,
    precision: 0,
    recall: 0,
  });
  totals.precision = totals.producedEdges ? totals.supported / totals.producedEdges : null;
  totals.recall = totals.referencePairs ? totals.coveredReferencePairs / totals.referencePairs : null;

  return { entries: results, totals };
}
