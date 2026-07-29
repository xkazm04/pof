'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { recordSessionOutcome } from '@/hooks/useSessionAnalytics';
import { type CLITask, type CallbackStatus } from '@/lib/cli-task';
import { composeTaskDispatch, STATIC_VARIANT_ID } from '@/lib/prompt-evolution/dispatch-resolve';
import type { SkillId } from '@/components/cli/skills';
import { UI_TIMEOUTS } from '@/lib/constants';
import { dispatchPromptWhenReady } from '@/lib/cli-dispatch';
import { logger } from '@/lib/logger';
import type { SubModuleId } from '@/types/modules';
import { isExpensiveTaskType } from '@/lib/cli-spend/preflight';
import { fetchPreflightVerdict } from '@/lib/cli-spend-client';
import { requestPreflightConfirm } from '@/stores/preflightStore';

/** Optional task attribution carried with a dispatch (for spend tracking). */
interface DispatchMeta {
  taskType?: string;
  label?: string;
  /** Prompt-evolution variant this dispatch resolved to (or 'static'). */
  variantId?: string;
}

interface UseModuleCLIOptions {
  /** Module this session is displayed within (must match the page's activeModuleId for inline visibility) */
  moduleId: SubModuleId;
  /** Unique key to distinguish this session from others in the same module */
  sessionKey: string;
  /** Tab label shown in bottom panel and terminal header */
  label: string;
  /** Accent color for the terminal tab */
  accentColor: string;
  /**
   * Called when the CLI transitions from running → stopped. Receives true if the
   * task succeeded, plus the run's additive callback confirmation status when known
   * ('confirmed' | 'failed' | 'missing') — checklist hosts flip UI to done only on
   * 'confirmed'. The second arg is optional so callers that only need success are
   * unaffected.
   */
  onComplete?: (success: boolean, callbackStatus?: CallbackStatus) => void;
}

export interface UseModuleCLIResult {
  sendPrompt: (prompt: string, meta?: DispatchMeta) => void;
  execute: (task: CLITask) => Promise<void>;
  isRunning: boolean;
}

/**
 * Reusable hook for launching a CLI terminal from any module button.
 *
 * Handles: session creation/lookup, prompt dispatch, running-state subscription,
 * auto-callback when the stream completes, and session analytics recording.
 */
export function useModuleCLI(opts: UseModuleCLIOptions): UseModuleCLIResult {
  const projectPath = useProjectStore((s) => s.projectPath);
  const createSession = useCLIPanelStore((s) => s.createSession);
  const findSessionByKey = useCLIPanelStore((s) => s.findSessionByKey);
  const setActiveTab = useCLIPanelStore((s) => s.setActiveTab);
  const setSessionTaskMeta = useCLIPanelStore((s) => s.setSessionTaskMeta);

  const isRunning = useCLIPanelStore((s) => {
    const entry = Object.values(s.sessions).find(
      (sess) => sess.sessionKey === opts.sessionKey
    );
    return entry?.isRunning ?? false;
  });

  // Track prompt and start time for analytics recording
  const lastPromptRef = useRef<string>('');
  const taskStartRef = useRef<string>('');
  // The prompt-evolution variant the last dispatch resolved to (or 'static') —
  // recorded with the outcome so A/B attribution can close the loop.
  const lastVariantIdRef = useRef<string>(STATIC_VARIANT_ID);

  // Detect running → stopped transition and fire onComplete with success info.
  //
  // Race condition context: CompactTerminal fires onStreamingChange(false) and
  // onTaskComplete(id, success) synchronously. The first call sets isRunning=false
  // in the store WITHOUT lastTaskSuccess. The second call sets lastTaskSuccess.
  // React batches both, but to be safe we read success imperatively from getState()
  // after a microtask so both store writes are guaranteed settled.
  const prevRunningRef = useRef(false);
  const onCompleteRef = useRef(opts.onComplete);
  const sessionKeyRef = useRef(opts.sessionKey);
  const moduleIdRef = useRef(opts.moduleId);
  useEffect(() => { onCompleteRef.current = opts.onComplete; }, [opts.onComplete]);
  useEffect(() => { sessionKeyRef.current = opts.sessionKey; }, [opts.sessionKey]);
  useEffect(() => { moduleIdRef.current = opts.moduleId; }, [opts.moduleId]);

  // The key the prevRunning value was observed under. A sessionKey switch
  // re-subscribes this hook to a DIFFERENT session — comparing the old key's
  // running=true against the new key's running=false is NOT a completion.
  const prevKeyRef = useRef(opts.sessionKey);

  useEffect(() => {
    if (prevKeyRef.current !== opts.sessionKey) {
      // Resync to the new session and skip the transition: firing here would
      // record a false 'failed' analytics outcome (with the OLD session's
      // prompt and a bogus duration) and call onComplete for a run that is
      // still in progress on the previous key.
      prevKeyRef.current = opts.sessionKey;
      prevRunningRef.current = isRunning;
      lastPromptRef.current = '';
      taskStartRef.current = '';
      return;
    }
    if (prevRunningRef.current && !isRunning) {
      // Read success imperatively from the settled store state
      setTimeout(() => {
        const sessions = useCLIPanelStore.getState().sessions;
        const entry = Object.values(sessions).find(
          (sess) => sess.sessionKey === sessionKeyRef.current
        );
        const success = entry?.lastTaskSuccess === true;
        // Additive callback truth for this run (undefined when the host never
        // reported one — e.g. a non-callback interactive run).
        const callbackStatus = entry?.lastCallbackStatus ?? undefined;

        // Record session analytics (fire and forget)
        if (lastPromptRef.current && taskStartRef.current) {
          const startTime = new Date(taskStartRef.current).getTime();
          const durationMs = Date.now() - startTime;
          const hadProjectContext = lastPromptRef.current.includes('## Project Context')
            || lastPromptRef.current.includes('## Build Command');

          recordSessionOutcome({
            moduleId: moduleIdRef.current,
            sessionKey: sessionKeyRef.current,
            prompt: lastPromptRef.current,
            hadProjectContext,
            success,
            durationMs,
            startedAt: taskStartRef.current,
            promptVariantId: lastVariantIdRef.current,
          });
        }

        onCompleteRef.current?.(success, callbackStatus ?? undefined);
      }, UI_TIMEOUTS.raceConditionBuffer);
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, opts.sessionKey]);

  const sendPrompt = useCallback(
    (prompt: string, meta?: DispatchMeta) => {
      // Track for analytics
      lastPromptRef.current = prompt;
      taskStartRef.current = new Date().toISOString();
      lastVariantIdRef.current = meta?.variantId ?? STATIC_VARIANT_ID;

      let tabId = findSessionByKey(opts.sessionKey);
      if (!tabId) {
        tabId = createSession({
          label: opts.label,
          accentColor: opts.accentColor,
          moduleId: opts.moduleId,
          sessionKey: opts.sessionKey,
          projectPath,
        });
      }
      setActiveTab(tabId);

      // Attribute spend to the dispatched task type (defaults to a free-typed
      // interactive prompt). The terminal reads this back when the run's cost
      // result arrives. See cli-spend-client / SpendDashboard.
      setSessionTaskMeta(tabId, meta?.taskType ?? 'interactive', meta?.label ?? opts.label);

      // Non-blocking anti-pattern check — fire-and-forget. Writes warnings to
      // the pattern library store so the Anti-Patterns tab + any subscribed
      // UI surface can flag the dispatched prompt against known-failure
      // approaches mined from prior sessions. We don't gate the dispatch on
      // this; the user gets the warning post-hoc just like an ESLint warning.
      void usePatternLibraryStore
        .getState()
        .checkPromptBeforeDispatch(prompt, opts.moduleId)
        .then((warnings) => {
          if (warnings.length > 0) {
            logger.warn(
              `[anti-pattern] dispatched ${opts.moduleId} prompt matched ${warnings.length} known-failure pattern${warnings.length === 1 ? '' : 's'}:`,
              warnings.map((w) => ({
                id: w.antiPattern.id,
                severity: w.antiPattern.severity,
                matchScore: w.matchScore,
                message: w.message,
              })),
            );
          }
        });

      // Dispatch when the target terminal announces readiness (handshake) —
      // replaces a fixed mount-delay timer that could lose the event.
      // The dispatch task type rides along so the terminal pins the model-policy
      // model + effort for this run (Quality Program WS0). See src/lib/cli-dispatch.ts.
      dispatchPromptWhenReady(tabId, prompt, meta?.taskType);
    },
    [findSessionByKey, createSession, setActiveTab, setSessionTaskMeta, projectPath, opts.sessionKey, opts.moduleId, opts.label, opts.accentColor]
  );

  /**
   * High-level execution: accepts a CLITask, scans the project for context,
   * assembles the enriched prompt via buildTaskPrompt, and dispatches it.
   *
   * This is the preferred entry point — callers should use TaskFactory to
   * create the task and then call execute(task) instead of building prompts.
   */
  const execute = useCallback(
    async (task: CLITask) => {
      // Pre-flight budget guardrail — for resource-intensive task types (live
      // editor runs, broad scans), check the spend guard before doing any work.
      // Only interrupts under genuine budget pressure; never blocks on an error.
      if (isExpensiveTaskType(task.type)) {
        const verdict = await fetchPreflightVerdict(task.type);
        const proceed = await requestPreflightConfirm(verdict);
        if (!proceed) return;
      }

      // Scan project for dynamic context (uses cache if fresh)
      const scanProject = useProjectStore.getState().scanProject;
      await scanProject();

      // Resolve adaptive skills from telemetry patterns (fire-and-forget on failure)
      resolveAndApplySkills(opts.sessionKey);

      const { projectName, projectPath: pp, ueVersion, dynamicContext } = useProjectStore.getState();
      const ctx = { projectName, projectPath: pp, ueVersion, dynamicContext };
      // Resolve the adopted prompt-evolution variant for this task (if any) and
      // build the enriched prompt exactly as the preview shows it. Falls back to
      // the static registry prompt on no-variant / API error — never blocks.
      // `seed: true` — a REAL dispatch with no adopted variant captures the
      // prompt it served as the item's baseline (v1), fire-and-forget, so the
      // A/B rail has an incumbent to challenge. Previews pass no options.
      const { prompt: enriched, variantId } = await composeTaskDispatch(task, ctx, { seed: true });
      sendPrompt(enriched, { taskType: task.type, label: task.label, variantId });
    },
    [sendPrompt, opts.sessionKey],
  );

  return { sendPrompt, execute, isRunning };
}

/**
 * Resolve adaptive skills from telemetry patterns and apply to the session.
 * Non-blocking — silently skips on failure so it never blocks prompt dispatch.
 */
function resolveAndApplySkills(sessionKey: string): void {
  fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'resolve-skills' }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((envelope: { success: boolean; data: { skills?: SkillId[] } } | null) => {
      const json = envelope?.success ? envelope.data : null;
      if (!json?.skills?.length) return;
      const { sessions, tabOrder } = useCLIPanelStore.getState();
      const tabId = tabOrder.find((id) => sessions[id]?.sessionKey === sessionKey);
      if (tabId) {
        useCLIPanelStore.getState().setSessionSkills(tabId, json.skills);
      }
    })
    .catch(() => {});
}
