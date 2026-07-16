'use client';

import { useCallback } from 'react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';
import { getCategoryForSubModule, SUB_MODULE_MAP } from '@/lib/module-registry';
import { dispatchPromptWhenReady } from '@/lib/cli-dispatch';
import type { SubModuleId } from '@/types/modules';

export interface UseModuleActionsResult {
  sendPromptToModule: (moduleId: SubModuleId, prompt: string) => void;
}

export function useModuleActions(): UseModuleActionsResult {
  const projectPath = useProjectStore((s) => s.projectPath);
  const createSession = useCLIPanelStore((s) => s.createSession);
  const findSessionByModule = useCLIPanelStore((s) => s.findSessionByModule);
  const setActiveTab = useCLIPanelStore((s) => s.setActiveTab);

  const sendPromptToModule = useCallback((moduleId: SubModuleId, prompt: string) => {
    const mod = SUB_MODULE_MAP[moduleId];
    const category = getCategoryForSubModule(moduleId);
    if (!mod || !category) return;

    let tabId = findSessionByModule(moduleId);
    if (!tabId) {
      tabId = createSession({
        label: mod.label,
        accentColor: category.accentColor,
        moduleId,
        projectPath,
      });
    }
    setActiveTab(tabId);

    // Dispatch when the target terminal announces readiness (handshake) instead
    // of a blind fixed mount-delay that can fire before the terminal's listener
    // attaches and silently drop the prompt (window.dispatchEvent with no
    // listener is a no-op). A safety-fallback timer still fires if it never
    // announces. See src/lib/cli-dispatch.ts.
    dispatchPromptWhenReady(tabId, prompt);
  }, [projectPath, createSession, findSessionByModule, setActiveTab]);

  return { sendPromptToModule };
}
