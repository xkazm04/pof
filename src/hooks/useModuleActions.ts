'use client';

import { useCallback } from 'react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';
import { getCategoryForSubModule, SUB_MODULE_MAP } from '@/lib/module-registry';
import { UI_TIMEOUTS } from '@/lib/constants';
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
    const module = SUB_MODULE_MAP[moduleId];
    const category = getCategoryForSubModule(moduleId);
    if (!module || !category) return;

    let tabId = findSessionByModule(moduleId);
    if (!tabId) {
      tabId = createSession({
        label: module.label,
        accentColor: category.accentColor,
        moduleId,
        projectPath,
      });
    }
    setActiveTab(tabId);

    // Small delay to allow the terminal component to mount and attach its event listener
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pof-cli-prompt', {
        detail: { tabId, prompt },
      }));
    }, UI_TIMEOUTS.mountDelay);
  }, [projectPath, createSession, findSessionByModule, setActiveTab]);

  return { sendPromptToModule };
}
