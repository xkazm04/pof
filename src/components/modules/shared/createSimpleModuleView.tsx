'use client';

import { ReviewableModuleView } from './ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import type { SubModuleId } from '@/types/modules';

/**
 * Factory that creates a simple module view component for modules that only need
 * the standard ReviewableModuleView with no extra tabs or custom logic.
 */
export function createSimpleModuleView(moduleId: SubModuleId) {
  function SimpleModuleView() {
    const mod = SUB_MODULE_MAP[moduleId];
    const cat = getCategoryForSubModule(moduleId);
    if (!mod || !cat) return null;

    return (
      <ReviewableModuleView
        moduleId={moduleId}
        moduleLabel={mod.label}
        moduleDescription={mod.description}
        moduleIcon={mod.icon}
        accentColor={cat.accentColor}
        checklist={getModuleChecklist(moduleId)}
        quickActions={mod.quickActions}
      />
    );
  }

  SimpleModuleView.displayName = `SimpleModuleView(${moduleId})`;
  return SimpleModuleView;
}
