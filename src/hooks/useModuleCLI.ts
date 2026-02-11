'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';

interface UseModuleCLIOptions {
  /** Module this session is displayed within (must match the page's activeModuleId for inline visibility) */
  moduleId: string;
  /** Unique key to distinguish this session from others in the same module */
  sessionKey: string;
  /** Tab label shown in bottom panel and terminal header */
  label: string;
  /** Accent color for the terminal tab */
  accentColor: string;
  /** Called when the CLI transitions from running → stopped. Receives true if the task succeeded. */
  onComplete?: (success: boolean) => void;
}

/**
 * Reusable hook for launching a CLI terminal from any module button.
 *
 * Handles: session creation/lookup, prompt dispatch, running-state subscription,
 * and auto-callback when the stream completes.
 *
 * Usage:
 * ```ts
 * const { sendPrompt, isRunning } = useModuleCLI({
 *   moduleId: 'project-setup',
 *   sessionKey: 'project-build-verify',
 *   label: 'Build & Verify',
 *   accentColor: '#f59e0b',
 *   onComplete: (success) => { if (success) markDone(); },
 * });
 * ```
 */
export function useModuleCLI(opts: UseModuleCLIOptions) {
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

  const lastTaskSuccess = useCLIPanelStore((s) => {
    const entry = Object.values(s.sessions).find(
      (sess) => sess.sessionKey === opts.sessionKey
    );
    return entry?.lastTaskSuccess ?? null;
  });

  // Detect running → stopped transition and fire onComplete with success info
  const prevRunningRef = useRef(false);
  const onCompleteRef = useRef(opts.onComplete);
  onCompleteRef.current = opts.onComplete;

  useEffect(() => {
    if (prevRunningRef.current && !isRunning) {
      onCompleteRef.current?.(lastTaskSuccess === true);
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, lastTaskSuccess]);

  const sendPrompt = useCallback(
    (prompt: string) => {
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
      }, 100);
    },
    [findSessionByKey, createSession, setActiveTab, projectPath, opts.sessionKey, opts.moduleId, opts.label, opts.accentColor]
  );

  return { sendPrompt, isRunning };
}
