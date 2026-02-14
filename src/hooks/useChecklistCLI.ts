'use client';

import { useState, useCallback } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useModuleStore } from '@/stores/moduleStore';
import { TaskFactory } from '@/lib/cli-task';

interface UseChecklistCLIOptions {
  moduleId: string;
  sessionKey: string;
  label: string;
  accentColor: string;
  /** Called after a successful completion with the completed item's id */
  onItemCompleted?: (itemId: string) => void;
}

/**
 * Encapsulates the repeated checklist-CLI pattern used across content views:
 *   activeItemId state, onComplete callback that marks checklist items,
 *   useModuleCLI instantiation, and prompt enrichment via TaskFactory + execute.
 */
export function useChecklistCLI(opts: UseChecklistCLIOptions) {
  const setChecklistItem = useModuleStore((s) => s.setChecklistItem);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const handleComplete = useCallback(
    (success: boolean) => {
      if (success && activeItemId) {
        setChecklistItem(opts.moduleId, activeItemId, true);
        opts.onItemCompleted?.(activeItemId);
      }
      setActiveItemId(null);
    },
    [activeItemId, opts.moduleId, opts.onItemCompleted, setChecklistItem],
  );

  const cli = useModuleCLI({
    moduleId: opts.moduleId,
    sessionKey: opts.sessionKey,
    label: opts.label,
    accentColor: opts.accentColor,
    onComplete: handleComplete,
  });

  const sendPrompt = useCallback(
    (itemId: string, prompt: string) => {
      setActiveItemId(itemId);
      const task = TaskFactory.checklist(opts.moduleId, itemId, prompt, opts.label);
      cli.execute(task);
    },
    [cli, opts.moduleId, opts.label],
  );

  return {
    sendPrompt,
    isRunning: cli.isRunning,
    activeItemId,
  };
}
