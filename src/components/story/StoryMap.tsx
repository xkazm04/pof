'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { OrreryView, type OrreryDataset, type OrreryExtraContext } from '@/components/story/orrery/OrreryView';
import { WalkControl } from '@/components/story/WalkControl';
import type { WalkResult } from '@/components/story/useStoryWalk';
import { mergeWalkEvidence } from '@/lib/story/orrery/walk';
import type { StoredStoryGraph, StoryGraphSummary } from '@/lib/story/story-db-conn';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; datasets: OrreryDataset[] };

/** Fetch every stored graph with its body. Pure async: returns the next state, never sets it. */
async function fetchStoryDatasets(): Promise<LoadState> {
  const list = await tryApiFetch<StoryGraphSummary[]>('/api/story/graphs');
  if (!list.ok) return { kind: 'error', message: list.error };
  const bodies = await Promise.all(
    list.data.map((s) =>
      tryApiFetch<StoredStoryGraph>(
        `/api/story/graphs/${encodeURIComponent(s.graphId)}?project=${encodeURIComponent(s.project)}`,
      ),
    ),
  );
  const datasets: OrreryDataset[] = [];
  for (const b of bodies) {
    if (!b.ok) return { kind: 'error', message: b.error };
    datasets.push({
      key: b.data.id,
      label: `${b.data.name} · ${b.data.nodeCount.toLocaleString()} nodes`,
      graph: b.data.graph,
      project: b.data.project,
      graphId: b.data.graphId,
      hash: b.data.hash,
    });
  }
  return { kind: 'ready', datasets };
}

/**
 * /story — the story map. Reads every imported `pof.storygraph/1` document from the
 * `story_graphs` table (via `/api/story/graphs`) and renders them in the Orrery.
 *
 * PoF is a READER of the standard: graphs arrive through `POST /api/story/graphs`
 * (the importer validates them); this surface never authors or edits one. The Walk control runs
 * the bounded walker over a stored graph (`POST /api/story/walk`, in memory, writes nothing); its
 * SAMPLED evidence is merged under the document's imported evidence for the lens, and its findings
 * show as leads.
 */
export function StoryMap() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void fetchStoryDatasets().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    void fetchStoryDatasets().then(setState);
  }, []);

  if (state.kind === 'loading') return <LoadingRow label="Loading story graphs…" />;
  if (state.kind === 'error') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <InlineErrorRetry message={`Could not load story graphs: ${state.message}`} onRetry={retry} />
      </div>
    );
  }
  if (state.datasets.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No story graphs imported yet"
        description="POST a pof.storygraph/1 document to /api/story/graphs (see docs/architecture/storygraph-standard.md). Imported graphs appear here."
      />
    );
  }
  return <StoryOrrery datasets={state.datasets} />;
}

/** The Orrery plus the per-dataset walk results it reads. */
function StoryOrrery({ datasets }: { datasets: OrreryDataset[] }) {
  const [activeKey, setActiveKey] = useState(() => datasets[0].key);
  const [walks, setWalks] = useState<Record<string, WalkResult>>({});
  const dataset = datasets.find((d) => d.key === activeKey) ?? datasets[0];
  const walk = walks[dataset.key] ?? null;

  // Read against the STORED hash: the walker pinned its run to exactly that, so its cells verify.
  const merged = useMemo(
    () => (walk ? mergeWalkEvidence(dataset.graph, dataset.hash ?? '', walk.report) : null),
    [walk, dataset],
  );

  const target = useMemo(
    () => (dataset.project && dataset.graphId ? { project: dataset.project, graphId: dataset.graphId } : null),
    [dataset],
  );

  const handleDone = useCallback(
    (key: string) => (result: WalkResult) => setWalks((prev) => ({ ...prev, [key]: result })),
    [],
  );

  const renderExtra = useCallback(
    (ctx: OrreryExtraContext) => (
      <WalkControl
        key={ctx.datasetKey}
        target={target}
        last={walk}
        merged={merged}
        model={ctx.model}
        selected={ctx.selected}
        lens={ctx.lens}
        onLens={ctx.onLens}
        onDone={handleDone(ctx.datasetKey)}
      />
    ),
    [target, walk, merged, handleDone],
  );

  return (
    <OrreryView
      datasets={datasets}
      activeKey={dataset.key}
      onActiveKeyChange={setActiveKey}
      evidence={merged}
      leads={walk?.report.findings ?? null}
      renderExtra={renderExtra}
      className="h-full"
    />
  );
}
