'use client';

import { useCallback, useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { OrreryView, type OrreryDataset } from '@/components/story/orrery/OrreryView';
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
    });
  }
  return { kind: 'ready', datasets };
}

/**
 * /story — the story map. Reads every imported `pof.storygraph/1` document from the
 * `story_graphs` table (via `/api/story/graphs`) and renders them in the Orrery.
 *
 * PoF is a READER of the standard: graphs arrive through `POST /api/story/graphs`
 * (the importer validates them); this surface never authors or edits one.
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
  return <OrreryView datasets={state.datasets} className="h-full" />;
}
