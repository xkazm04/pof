'use client';

import { useState, useCallback } from 'react';
import { getGenreSubModule } from '@/lib/genre-registry';
import { buildChecklistPrompt } from '@/lib/prompt-context';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import { RoadmapChecklist } from './RoadmapChecklist';
import { QuickActionsPanel } from './QuickActionsPanel';
import type { SubModuleId } from '@/types/modules';

const CORE_ENGINE_ACCENT = '#3b82f6';

interface GenreModuleViewProps {
  moduleId: SubModuleId;
}

export function GenreModuleView({ moduleId }: GenreModuleViewProps) {
  const genreModule = getGenreSubModule(moduleId);
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);
  const setChecklistItem = useModuleStore((s) => s.setChecklistItem);

  // Track which checklist item is being worked on by the CLI
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  // Track last auto-completed item for visual flash
  const [lastCompletedItemId, setLastCompletedItemId] = useState<string | null>(null);

  const handleComplete = useCallback((success: boolean) => {
    if (success && activeItemId) {
      setChecklistItem(moduleId, activeItemId, true);
      setLastCompletedItemId(activeItemId);
      // Clear the flash after animation
      setTimeout(() => setLastCompletedItemId(null), 2000);
    }
    setActiveItemId(null);
  }, [activeItemId, moduleId, setChecklistItem]);

  const cli = useModuleCLI({
    moduleId,
    sessionKey: `${moduleId}-cli`,
    label: genreModule?.label ?? moduleId,
    accentColor: CORE_ENGINE_ACCENT,
    onComplete: handleComplete,
  });

  // Wrap prompt with project context before sending
  const sendChecklistPrompt = useCallback((itemId: string, prompt: string) => {
    setActiveItemId(itemId);
    const enriched = buildChecklistPrompt(prompt, { projectName, projectPath, ueVersion });
    cli.sendPrompt(enriched);
  }, [cli, projectName, projectPath, ueVersion]);

  if (!genreModule) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[#6b7294]">Module data not found.</p>
      </div>
    );
  }

  const Icon = genreModule.icon;
  const checklist = genreModule.checklist ?? [];
  const quickActions = genreModule.quickActions;

  return (
    <div className="flex h-full">
      {/* Main content — Roadmap */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Icon className="w-6 h-6" style={{ color: CORE_ENGINE_ACCENT }} />
          <div>
            <h1 className="text-lg font-semibold text-[#e0e4f0]">{genreModule.label}</h1>
            <p className="text-xs text-[#6b7294]">{genreModule.description}</p>
          </div>
        </div>

        {/* Roadmap checklist */}
        {checklist.length > 0 ? (
          <RoadmapChecklist
            items={checklist}
            subModuleId={moduleId}
            onRunPrompt={sendChecklistPrompt}
            accentColor={CORE_ENGINE_ACCENT}
            isRunning={cli.isRunning}
            activeItemId={activeItemId}
            lastCompletedItemId={lastCompletedItemId}
          />
        ) : (
          <p className="text-sm text-[#6b7294]">No checklist items defined for this module.</p>
        )}
      </div>

      {/* Right panel — Quick Actions */}
      <div className="w-56 border-l border-[#1e1e3a] bg-[#0d0d22] flex-shrink-0">
        <QuickActionsPanel
          actions={quickActions}
          onRunPrompt={cli.sendPrompt}
          accentColor={CORE_ENGINE_ACCENT}
          isRunning={cli.isRunning}
          moduleLabel={genreModule.label}
        />
      </div>
    </div>
  );
}
