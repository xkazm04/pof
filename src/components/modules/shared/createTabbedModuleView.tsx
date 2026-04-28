'use client';

import { ReviewableModuleView } from './ReviewableModuleView';
import type { ExtraTab } from './ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import type { SubModuleId } from '@/types/modules';

/**
 * Factory companion to `createSimpleModuleView`. Builds a module view that
 * mounts the standard `<ReviewableModuleView>` AND threads caller-supplied
 * extra tabs through its existing `extraTabs` prop.
 *
 * Use when a module needs one or more custom panels alongside the standard
 * checklist/feature-matrix/quick-actions surfaces. This keeps the tab bar,
 * accent stripe, and `mod`/`cat` null-guard in a single shared owner instead
 * of every consumer hand-rolling the wiring (see ui-perfectionist 16.1).
 *
 * Example:
 * ```tsx
 * export const DialogueView = createTabbedModuleView('dialogue-quests', [
 *   { id: 'generator', label: 'Quest Generator', icon: Sparkles, render: () => <QuestGeneratorPanel /> },
 * ]);
 * ```
 */
export function createTabbedModuleView(moduleId: SubModuleId, tabs: ExtraTab[]) {
  function TabbedModuleView() {
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
        extraTabs={tabs}
      />
    );
  }

  TabbedModuleView.displayName = `TabbedModuleView(${moduleId})`;
  return TabbedModuleView;
}
