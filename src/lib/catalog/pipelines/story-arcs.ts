import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength } from '../acceptance/dataCheckers';
import { storyGraphAcceptance } from '@/lib/catalog/acceptance/storyCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import { starterStoryGraph, starterNodes, walkSummary, storyWalkFresh, WALK_SAMPLES } from './storyArcs/storyArcsWalk';

/**
 * Story Arcs pipeline (catalogId: 'story-arcs').
 *
 * A story arc is a `pof.storygraph/1` document (docs/architecture/storygraph-standard.md): the
 * decisions, events and consequences of a storyline as a directed graph with guarded edges. This
 * row owns the GRAPH, not the writing — a structural pass here is necessary and never sufficient,
 * and the walker's state-altitude findings are leads, never proven defects.
 *
 *   1. Concept Brief — what the arc is about and which choices carry weight.
 *   2. Story Graph   — the document, graded by the six structural checkers (`storyGraphAcceptance`).
 *   3. Impact Walk   — a pof-walker@1 sample summary bound to the graph by content hash.
 *
 * Cross-catalog `links` are not declared: the standard links a graph's NODES to the quests /
 * dialog-trees / cutscenes / codex / factions rows that realise them (`realises`, §12), which is a
 * per-node reference inside the document, not an entity-level CatalogLink.
 */
registerCatalogPipeline({
  catalogId: 'story-arcs',
  packagingExempt:
    'A story graph is a data document, not a UE asset package: the pof.storygraph/1 JSON is ' +
    'imported into PoF\'s own story store (POST /api/story/graphs, project-scoped story_graphs) and ' +
    'read by the Orrery at /story. Nothing passes through PoF\'s package staging, so the packaging ' +
    'drain would have no manifest to rebuild; the terminal proof is a pof-walker@1 walk of the ' +
    'current graph (the Impact Walk step).',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      engine: 'Claude',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity, direction?: string) => ({
        data: {
          brief:
            `${e.name} is a branching story arc authored as a pof.storygraph/1 document. ` +
            `It declares its entry, its endings and every state variable its choices write, so each ` +
            `ending can be proven reachable and each choice proven real (the options write different ` +
            `state). The arc names the decisions that carry weight, the consequences they gate later, ` +
            `and a text budget per node class so writing length is a design input rather than an ` +
            `accident. Structure is graded on every save; the bounded walker then samples ` +
            `playthroughs and reports reach per node and state-altitude leads to review, not defects.` +
            (direction?.trim() ? ` Operator direction: ${direction.trim()}` : ''),
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Story Graph ────────────────────────────────────────────────────────
    {
      archetype: 'graph',
      label: 'Story Graph',
      engine: 'Claude',
      view: { kind: 'graph', field: 'storyGraph' },
      produce: (e: LabEntity, direction?: string) => ({ data: { storyGraph: starterStoryGraph(e, direction) } }),
      criteria: [
        'Author `storyGraph` as ONE pof.storygraph/1 document per docs/architecture/storygraph-standard.md: format, project, graphId, revision, profile, variables, entries, nodes, edges, endings, budgets.',
        'Declare every variable any edge reads or writes, with type, domain, initial and writers; a choice whose options write identical state is a false choice.',
        'Every node reachable from an entry and co-reachable to a declared ending; type every guard (no `expr` atoms) so the walker can grade it.',
      ],
      accept: storyGraphAcceptance(),
      produceNote: `Stub: a deterministic starter topology (${starterNodes()} nodes; "nodes N" in the direction resizes it, 4–64). Live: the CLI authors the arc per the standard. View the full graph at /story.`,
    },

    // ── 3. Impact Walk ────────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'Impact Walk',
      // engine: `walkSummary` RUNS the pof-walker@1 sampler and hashes the graph it walked — the
      // verdict compares that hash to the current Story Graph sibling, an input outside this file.
      engine: 'Code',
      view: { kind: 'manifest', field: 'walk' },
      produce: (e: LabEntity, direction?: string) => ({ data: { walk: walkSummary(starterStoryGraph(e, direction), direction) } }),
      accept: storyWalkFresh(),
      produceNote:
        `Samples ${WALK_SAMPLES} pof-walker@1 walks ("seed N" picks the seed). Produce walks the STARTER graph (it cannot read the stored one); ` +
        'if the Story Graph was authored or resized since, the verdict walks the CURRENT graph itself and names the stored record as old. ' +
        'Leads are listed, never failing; full walks: /api/story/walk.',
    },
  ],
});
