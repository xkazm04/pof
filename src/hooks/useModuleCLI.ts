'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';
import { recordSessionOutcome } from '@/hooks/useSessionAnalytics';
import { buildTaskPrompt, type CLITask } from '@/lib/cli-task';
import type { SkillId } from '@/components/cli/skills';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { SubModuleId } from '@/types/modules';

interface UseModuleCLIOptions {
  /** Module this session is displayed within (must match the page's activeModuleId for inline visibility) */
  moduleId: SubModuleId;
  /** Unique key to distinguish this session from others in the same module */
  sessionKey: string;
  /** Tab label shown in bottom panel and terminal header */
  label: string;
  /** Accent color for the terminal tab */
  accentColor: string;
  /** Called when the CLI transitions from running → stopped. Receives true if the task succeeded. */
  onComplete?: (success: boolean) => void;
}

export interface UseModuleCLIResult {
  sendPrompt: (prompt: string) => void;
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

  const isRunning = useCLIPanelStore((s) => {
    const entry = Object.values(s.sessions).find(
      (sess) => sess.sessionKey === opts.sessionKey
    );
    return entry?.isRunning ?? false;
  });

  // Track prompt and start time for analytics recording
  const lastPromptRef = useRef<string>('');
  const taskStartRef = useRef<string>('');

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
  onCompleteRef.current = opts.onComplete;
  sessionKeyRef.current = opts.sessionKey;
  moduleIdRef.current = opts.moduleId;

  useEffect(() => {
    if (prevRunningRef.current && !isRunning) {
      // Read success imperatively from the settled store state
      setTimeout(() => {
        const sessions = useCLIPanelStore.getState().sessions;
        const entry = Object.values(sessions).find(
          (sess) => sess.sessionKey === sessionKeyRef.current
        );
        const success = entry?.lastTaskSuccess === true;

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
          });
        }

        onCompleteRef.current?.(success);
      }, UI_TIMEOUTS.raceConditionBuffer);
    }
    prevRunningRef.current = isRunning;
  }, [isRunning]);

  const sendPrompt = useCallback(
    (prompt: string) => {
      // Track for analytics
      lastPromptRef.current = prompt;
      taskStartRef.current = new Date().toISOString();

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

      // Small delay to allow the terminal component to mount and attach its event listener
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('pof-cli-prompt', {
            detail: { tabId, prompt },
          })
        );
      }, UI_TIMEOUTS.mountDelay);
    },
    [findSessionByKey, createSession, setActiveTab, projectPath, opts.sessionKey, opts.moduleId, opts.label, opts.accentColor]
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
      // Scan project for dynamic context (uses cache if fresh)
      const scanProject = useProjectStore.getState().scanProject;
      await scanProject();

      // Resolve adaptive skills from telemetry patterns (fire-and-forget on failure)
      resolveAndApplySkills(opts.sessionKey);

      const { projectName, projectPath: pp, ueVersion, dynamicContext } = useProjectStore.getState();
      const ctx = { projectName, projectPath: pp, ueVersion, dynamicContext };
      const enriched = buildTaskPrompt(task, ctx);
      sendPrompt(enriched);
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
