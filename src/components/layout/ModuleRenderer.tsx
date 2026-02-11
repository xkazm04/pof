'use client';

import { useRef } from 'react';
import { useNavigationStore } from '@/stores/navigationStore';
import { CATEGORY_MAP, SUB_MODULE_MAP } from '@/lib/module-registry';

// Genre-based core engine view
import { GenreModuleView } from '@/components/modules/core-engine/GenreModuleView';

import { ModelsView } from '@/components/modules/content/ModelsView';
import { AnimationsView } from '@/components/modules/content/AnimationsView';
import { MaterialsView } from '@/components/modules/content/MaterialsView';
import { LevelDesignView } from '@/components/modules/content/LevelDesignView';
import { UIHudView } from '@/components/modules/content/UIHudView';
import { AudioView } from '@/components/modules/content/AudioView';

import { AIBehaviorView } from '@/components/modules/game-systems/AIBehaviorView';
import { PhysicsView } from '@/components/modules/game-systems/PhysicsView';
import { MultiplayerView } from '@/components/modules/game-systems/MultiplayerView';
import { SaveLoadView } from '@/components/modules/game-systems/SaveLoadView';
import { InputView } from '@/components/modules/game-systems/InputView';
import { DialogueView } from '@/components/modules/game-systems/DialogueView';
import { PackagingView } from '@/components/modules/game-systems/PackagingView';

import { EvaluatorModule } from '@/components/modules/evaluator/EvaluatorModule';
import { ProjectSetupModule } from '@/components/modules/project-setup/ProjectSetupModule';
import { InlineTerminal } from '@/components/cli/InlineTerminal';

import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useActiveModuleId } from '@/hooks/useActiveModuleId';
import type { SubModuleId } from '@/types/modules';

// Factory for genre-based core engine sub-modules
function makeGenreView(id: SubModuleId) {
  return function GenreView() {
    return <GenreModuleView moduleId={id} />;
  };
}

const MODULE_COMPONENTS: Record<SubModuleId, React.ComponentType> = {
  // Core Engine — aRPG genre
  'arpg-character': makeGenreView('arpg-character'),
  'arpg-animation': makeGenreView('arpg-animation'),
  'arpg-gas': makeGenreView('arpg-gas'),
  'arpg-combat': makeGenreView('arpg-combat'),
  'arpg-enemy-ai': makeGenreView('arpg-enemy-ai'),
  'arpg-inventory': makeGenreView('arpg-inventory'),
  'arpg-loot': makeGenreView('arpg-loot'),
  'arpg-ui': makeGenreView('arpg-ui'),
  'arpg-progression': makeGenreView('arpg-progression'),
  'arpg-world': makeGenreView('arpg-world'),
  'arpg-save': makeGenreView('arpg-save'),
  'arpg-polish': makeGenreView('arpg-polish'),
  // Content
  'models': ModelsView,
  'animations': AnimationsView,
  'materials': MaterialsView,
  'level-design': LevelDesignView,
  'ui-hud': UIHudView,
  'audio': AudioView,
  'ai-behavior': AIBehaviorView,
  'physics': PhysicsView,
  'multiplayer': MultiplayerView,
  'save-load': SaveLoadView,
  'input-handling': InputView,
  'dialogue-quests': DialogueView,
  'packaging': PackagingView,
};

// Special-case categories that render without sub-modules
const SPECIAL_CATEGORIES: Record<string, React.ComponentType> = {
  'project-setup': ProjectSetupModule,
  'evaluator': EvaluatorModule,
};

export function ModuleRenderer() {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const activeSubModule = useNavigationStore((s) => s.activeSubModule);
  const visitedModules = useRef(new Set<string>());
  const visitedSessions = useRef(new Set<string>());
  const activeModuleId = useActiveModuleId();

  // Show inline terminal only when the maximized tab belongs to the current module
  const maximizedTabId = useCLIPanelStore((s) => s.maximizedTabId);
  const maximizedSession = useCLIPanelStore((s) =>
    s.maximizedTabId ? s.sessions[s.maximizedTabId] : null
  );
  const inlineSessionId =
    maximizedTabId && maximizedSession?.moduleId === activeModuleId
      ? maximizedTabId
      : null;

  // Track visited modules for keep-alive
  if (activeSubModule) {
    visitedModules.current.add(activeSubModule);
  }
  if (activeCategory && SPECIAL_CATEGORIES[activeCategory]) {
    visitedModules.current.add(activeCategory);
  }

  // Track visited sessions for terminal keep-alive (same pattern — never unmount, just hide)
  if (inlineSessionId) {
    visitedSessions.current.add(inlineSessionId);
  }

  // Determine what to render
  const isSpecialCategory = activeCategory && SPECIAL_CATEGORIES[activeCategory];
  const hasActiveContent = isSpecialCategory || activeSubModule;

  // Welcome / empty state
  if (!hasActiveContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          {activeCategory ? (
            <p className="text-[#6b7294] text-sm">Select a module from the sidebar</p>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-[#e0e4f0] mb-2">Welcome to POF</h2>
              <p className="text-[#6b7294] text-sm">Select a category to begin</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Scrollable module content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {Array.from(visitedModules.current).map((moduleId) => {
          // Special category modules
          if (SPECIAL_CATEGORIES[moduleId]) {
            const SpecialComponent = SPECIAL_CATEGORIES[moduleId];
            const isVisible = activeCategory === moduleId;
            return (
              <div
                key={moduleId}
                style={{ display: isVisible ? 'block' : 'none' }}
                className="h-full"
              >
                <SpecialComponent />
              </div>
            );
          }

          // Regular sub-module views
          const Component = MODULE_COMPONENTS[moduleId as SubModuleId];
          if (!Component) return null;
          return (
            <div
              key={moduleId}
              style={{ display: activeSubModule === moduleId ? 'block' : 'none' }}
            >
              <Component />
            </div>
          );
        })}
      </div>

      {/* Inline terminals — keep-alive: never unmount, toggle visibility via display */}
      {Array.from(visitedSessions.current).map((sessionId) => {
        const isVisible = sessionId === inlineSessionId;
        return (
          <div
            key={sessionId}
            className="shrink-0"
            style={{ display: isVisible ? 'block' : 'none' }}
          >
            <InlineTerminal sessionId={sessionId} visible={isVisible} />
          </div>
        );
      })}
    </div>
  );
}
