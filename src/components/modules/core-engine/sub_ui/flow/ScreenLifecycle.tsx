'use client';

import { useMemo } from 'react';
import { useGeneration } from '@/hooks/useGeneration';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';
import { getRecipe, type GenerationStep } from '@/lib/catalog/recipe';
import type { ScreenEntry } from '@/lib/catalog/types';
import {
  nextRecipeStep, screenWorklist, STEP_VERB,
} from '@/components/modules/core-engine/sub_ui/flow/screenWorklist';

/** The screen-flow recipe's step list — the ground truth for "what runs next". */
const SCREEN_STEPS: readonly GenerationStep[] = getRecipe('screen-flow')?.steps ?? [];

/**
 * One row's catalog lifecycle: its OWN screen entity's badge, plus a run button
 * bound to the recipe's next step. No button when no step is legal (verified, or
 * failed — which must be reset to planned before anything may run).
 * useGeneration creates its CLI session on click, not on mount.
 */
export function ScreenLifecycle({ entity }: { entity: ScreenEntry | undefined }) {
  if (!entity) {
    return (
      <p data-testid="screen-lifecycle-unresolved" className="text-xs text-text-muted">
        No catalog screen backs this row, so it has nothing to generate.
      </p>
    );
  }
  return <ResolvedScreenLifecycle entity={entity} />;
}

function stepHint(entity: ScreenEntry, step: GenerationStep | null): string {
  if (step) return `Next: ${STEP_VERB[step]}`;
  if (entity.lifecycle === 'failed') return 'Failed: reset to planned before re-running';
  if (entity.lifecycle === 'verified') return 'Verified in UE';
  return 'No recipe step left';
}

function ResolvedScreenLifecycle({ entity }: { entity: ScreenEntry }) {
  const gen = useGeneration(entity);
  const step = nextRecipeStep(SCREEN_STEPS, entity.lifecycle);
  return (
    <div
      data-testid={`screen-lifecycle-${entity.id}`}
      className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg border border-border/40 bg-surface-deep"
    >
      <span className="text-xs font-mono text-text-muted">
        Catalog screen <span className="font-bold text-text">{entity.name}</span>
        {' · '}{stepHint(entity, step)}
      </span>
      <CatalogLifecycleCell
        lifecycle={entity.lifecycle}
        ueAssetCount={entity.ueAssets?.length ?? 0}
        busy={gen.isRunning}
        onRegenerate={step ? () => gen.generate(step) : undefined}
      />
    </div>
  );
}

/** "Screens 0/6 verified · Next: Scaffold HUD" — the next action is one click. */
export function ScreenWorklistHeader({ entries }: { entries: readonly ScreenEntry[] }) {
  const wl = useMemo(() => screenWorklist(entries, SCREEN_STEPS), [entries]);
  const nextEntity = wl.next ? entries.find((e) => e.id === wl.next!.entityId) : undefined;
  const idle = wl.verified === wl.total ? 'All screens verified' : 'No runnable step';
  return (
    <div data-testid="screen-worklist" className="flex flex-wrap items-center justify-between gap-2 px-1">
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
        Screens {wl.verified}/{wl.total} verified
        {wl.failed > 0 && ` · ${wl.failed} failed`}
      </span>
      {wl.next && nextEntity
        ? <NextActionButton entity={nextEntity} step={wl.next.step} />
        : <span className="text-xs font-mono text-text-muted">{idle}</span>}
    </div>
  );
}

function NextActionButton({ entity, step }: { entity: ScreenEntry; step: GenerationStep }) {
  const gen = useGeneration(entity);
  const label = `Next: ${STEP_VERB[step]} ${entity.name}`;
  return (
    <button
      type="button"
      // Guarded, not `disabled`, so focus stays on the button while its run is in flight.
      onClick={() => { if (!gen.isRunning) gen.generate(step); }}
      aria-disabled={gen.isRunning}
      aria-busy={gen.isRunning}
      title={gen.isRunning ? 'Running… a generation step is in progress' : label}
      className={[
        'focus-ring inline-flex items-center h-6 px-2 rounded border border-border/50',
        'text-xs font-mono font-bold text-text-muted',
        gen.isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:text-text hover:border-border',
      ].join(' ')}
    >
      {gen.isRunning ? 'Running…' : label}
    </button>
  );
}
