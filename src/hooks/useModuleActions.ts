'use client';

import { useCallback } from 'react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useProjectStore } from '@/stores/projectStore';
import { getCategoryForSubModule, SUB_MODULE_MAP } from '@/lib/module-registry';
import type { SubModuleId } from '@/types/modules';

export function useModuleActions() {
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

    // Dispatch custom event for the terminal to pick up
    window.dispatchEvent(new CustomEvent('pof-cli-prompt', {
      detail: { tabId, prompt },
    }));
  }, [projectPath, createSession, findSessionByModule, setActiveTab]);

  return { sendPromptToModule };
}
