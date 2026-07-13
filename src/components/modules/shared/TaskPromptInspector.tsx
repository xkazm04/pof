'use client';

import { useCallback, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { TaskFactory } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import { composeTaskDispatch } from '@/lib/prompt-evolution/dispatch-resolve';
import { summarizeInjectedKnowledge } from '@/lib/prompts/prompt-knowledge-summary';
import { useProjectStore } from '@/stores/projectStore';
import { PromptInspector } from './PromptInspector';

/**
 * Pre-dispatch prompt preview for the daily checklist run path — the run-side
 * counterpart of the forge's post-run inspector.
 *
 * Collapsed it is a single low-friction text toggle; on first open it composes
 * the prompt through the EXACT dispatch pipeline `useModuleCLI.execute` uses —
 * same project scan, same store context, same `composeTaskDispatch` (variant
 * resolution + knowledge injection) — so the string shown is byte-identical to
 * the one a "Run with Claude" click would send. No prompt logic lives here.
 */
export function TaskPromptInspector({ moduleId, itemId, prompt, label }: {
  moduleId: Parameters<typeof TaskFactory.checklist>[0];
  itemId: string;
  prompt: string;
  /** Display label threaded into the task (not part of the composed prompt). */
  label?: string;
}) {
  const [state, setState] = useState<
    | { kind: 'closed' }
    | { kind: 'loading' }
    | { kind: 'ready'; composed: string; knowledge: string[] }
    | { kind: 'error'; message: string }
  >({ kind: 'closed' });

  const openPreview = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      // Identical context assembly to useModuleCLI.execute: fresh (cached) scan,
      // then the store's project fields.
      await useProjectStore.getState().scanProject();
      const { projectName, projectPath, ueVersion, dynamicContext } = useProjectStore.getState();
      const task = TaskFactory.checklist(moduleId, itemId, prompt, label ?? itemId, getAppOrigin());
      const { prompt: composed, variantId } = await composeTaskDispatch(task, {
        projectName, projectPath, ueVersion, dynamicContext,
      });
      setState({ kind: 'ready', composed, knowledge: summarizeInjectedKnowledge(composed, variantId) });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Preview failed' });
    }
  }, [moduleId, itemId, prompt, label]);

  if (state.kind === 'ready') {
    return (
      <div data-testid="task-prompt-inspector" className="mt-2">
        <PromptInspector prompt={state.composed} knowledge={state.knowledge} title="Dispatch preview" />
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid="task-prompt-preview-toggle"
      onClick={openPreview}
      disabled={state.kind === 'loading'}
      className="mt-1.5 flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors disabled:opacity-60"
    >
      {state.kind === 'loading'
        ? <Loader2 size={11} className="animate-spin" />
        : <Eye size={11} />}
      {state.kind === 'error' ? `Preview failed: ${state.message} — retry` : 'Preview prompt'}
    </button>
  );
}
