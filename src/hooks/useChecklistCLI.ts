'use client';

import { useState, useCallback, useRef } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useModuleStore } from '@/stores/moduleStore';
import { TaskFactory, type CallbackStatus } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import type { SubModuleId } from '@/types/modules';

export interface UseChecklistCLIResult {
  sendPrompt: (itemId: string, prompt: string) => void;
  isRunning: boolean;
  activeItemId: string | null;
  /**
   * An item whose run completed but whose completion callback never CONFIRMED
   * (the /api/checklist/complete POST was missing or failed) — so the item was
   * NOT flipped to done. Surface a small "unconfirmed" affordance for it and call
   * {@link retryUnconfirmed} to re-run. `null` when there is nothing unconfirmed.
   */
  unconfirmedItemId: string | null;
  /** Re-dispatch the last unconfirmed item's prompt. No-op when nothing is unconfirmed. */
  retryUnconfirmed: () => void;
  /** Dismiss the unconfirmed affordance without retrying. */
  dismissUnconfirmed: () => void;
}

interface UseChecklistCLIOptions {
  moduleId: SubModuleId;
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
 *
 * Callback truth: the checklist item flips to done ONLY when the run's completion
 * callback is CONFIRMED (Claude emitted the @@CALLBACK marker AND the
 * /api/checklist/complete POST succeeded). A completed run whose callback is
 * missing/failed leaves the item un-done and surfaces {@link unconfirmedItemId} +
 * {@link retryUnconfirmed} — no more silent UI/DB divergence.
 */
export function useChecklistCLI(opts: UseChecklistCLIOptions): UseChecklistCLIResult {
  const { moduleId, sessionKey, label, accentColor, onItemCompleted } = opts;
  const setChecklistItem = useModuleStore((s) => s.setChecklistItem);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [unconfirmedItemId, setUnconfirmedItemId] = useState<string | null>(null);
  // Last prompt dispatched per item, so an unconfirmed run can be retried verbatim.
  const lastPromptRef = useRef<Record<string, string>>({});
  // The item the in-flight run belongs to, read imperatively at completion time
  // (activeItemId state may lag the microtask-delayed onComplete).
  const activeItemRef = useRef<string | null>(null);

  const handleComplete = useCallback(
    (success: boolean, callbackStatus?: CallbackStatus) => {
      const itemId = activeItemRef.current;
      if (itemId) {
        if (success && callbackStatus === 'confirmed') {
          // Ground truth: the completion POST landed. Mirror it in the UI.
          setChecklistItem(moduleId, itemId, true);
          onItemCompleted?.(itemId);
          setUnconfirmedItemId((cur) => (cur === itemId ? null : cur));
        } else if (success) {
          // Run finished but the callback did not confirm (missing/failed). Do NOT
          // mark done — the DB was never updated. Offer a retry instead.
          setUnconfirmedItemId(itemId);
        }
        // On failure, leave the item untouched (no false "done", no retry nag).
      }
      activeItemRef.current = null;
      setActiveItemId(null);
    },
    [moduleId, onItemCompleted, setChecklistItem],
  );

  const cli = useModuleCLI({
    moduleId,
    sessionKey,
    label,
    accentColor,
    onComplete: handleComplete,
  });

  const appOrigin = getAppOrigin();

  const sendPrompt = useCallback(
    (itemId: string, prompt: string) => {
      lastPromptRef.current[itemId] = prompt;
      // A fresh run for this item clears any stale unconfirmed flag on it.
      setUnconfirmedItemId((cur) => (cur === itemId ? null : cur));
      activeItemRef.current = itemId;
      setActiveItemId(itemId);
      const task = TaskFactory.checklist(moduleId, itemId, prompt, label, appOrigin);
      cli.execute(task);
    },
    [cli, moduleId, label, appOrigin],
  );

  const retryUnconfirmed = useCallback(() => {
    const itemId = unconfirmedItemId;
    if (!itemId) return;
    const prompt = lastPromptRef.current[itemId];
    if (prompt) sendPrompt(itemId, prompt);
  }, [unconfirmedItemId, sendPrompt]);

  const dismissUnconfirmed = useCallback(() => setUnconfirmedItemId(null), []);

  return {
    sendPrompt,
    isRunning: cli.isRunning,
    activeItemId,
    unconfirmedItemId,
    retryUnconfirmed,
    dismissUnconfirmed,
  };
}
