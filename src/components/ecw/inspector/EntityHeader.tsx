'use client';

import { ChevronRight, Sparkles } from 'lucide-react';
import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';
import { useGeneration } from '@/hooks/useGeneration';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { GenerationStep } from '@/lib/catalog/recipe';

/**
 * Resolve the next generation step for an entity based on its lifecycle.
 * Mirrors the per-catalog inspector pattern shipped in folder-09 R3.
 */
function nextStepFor(lifecycle: StoredCatalogEntity['lifecycle']): GenerationStep {
  if (lifecycle === 'generated') return 'wire';
  if (lifecycle === 'wired') return 'verify';
  return 'author-python';
}

/**
 * Inspector header: categoryPath breadcrumb · entity name (h2) · (Re)generate
 * button · lifecycle badge. The (Re)generate button dispatches via
 * `useGeneration` — opens a session in the CLI Rail (entity-scoped via
 * `sessionKey='gen-<entityId>'`), and on `@@CALLBACK` the rail's
 * `loadLifecycle` refresh propagates the new state into every inspector
 * panel that reads from `catalogStore` (two-way binding).
 */
export function EntityHeader({ entity }: { entity: StoredCatalogEntity }) {
  const gen = useGeneration(entity);
  const step = nextStepFor(entity.lifecycle);

  return (
    <header className="flex flex-col gap-2 px-4 py-3 border-b border-border/40">
      <nav aria-label="entity breadcrumb" className="flex items-center gap-1 text-2xs font-mono uppercase tracking-wider text-text-muted">
        {entity.categoryPath.map((seg, i) => (
          <span key={`${seg}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 opacity-60" />}
            <span>{seg}</span>
          </span>
        ))}
      </nav>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-text truncate">{entity.name}</h2>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => gen.generate(step)}
            disabled={gen.isRunning}
            aria-label={`(Re)generate · ${step}`}
            className="focus-ring flex items-center gap-1.5 px-2 py-1 rounded text-2xs font-mono border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3 h-3" />
            <span>{gen.isRunning ? 'Generating…' : `(Re)generate · ${step}`}</span>
          </button>
          <LifecycleBadge state={entity.lifecycle} />
        </div>
      </div>
    </header>
  );
}
