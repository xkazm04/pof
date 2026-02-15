'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/stores/navigationStore';
import { CATEGORY_MAP, SUB_MODULE_MAP } from '@/lib/module-registry';
import { DURATION, EASE_OUT } from '@/lib/motion';

/** Max number of modules kept mounted simultaneously. Oldest are evicted. */
const LRU_CAP = 5;

/** Max number of inline terminal sessions kept mounted simultaneously. */
const SESSION_LRU_CAP = 5;

// Genre-based core engine view
import { GenreModuleView } from '@/components/modules/core-engine/GenreModuleView';

import { ModelsView } from '@/components/modules/content/models/ModelsView';
import { AnimationsView } from '@/components/modules/content/animations/AnimationsView';
import { MaterialsView } from '@/components/modules/content/materials/MaterialsView';
import { LevelDesignView } from '@/components/modules/content/level-design/LevelDesignView';
import { UIHudView } from '@/components/modules/content/ui-hud/UIHudView';
import { AudioView } from '@/components/modules/content/audio/AudioView';

import { AIBehaviorView } from '@/components/modules/game-systems/AIBehaviorView';
import { PhysicsView } from '@/components/modules/game-systems/PhysicsView';
import { MultiplayerView } from '@/components/modules/game-systems/MultiplayerView';
import { SaveLoadView } from '@/components/modules/game-systems/SaveLoadView';
import { InputView } from '@/components/modules/game-systems/InputView';
import { DialogueView } from '@/components/modules/game-systems/DialogueView';
import { PackagingView } from '@/components/modules/game-systems/PackagingView';
import { BlueprintTranspilerView } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView';

import { EvaluatorModule } from '@/components/modules/evaluator/EvaluatorModule';
import { GameDesignDocView } from '@/components/modules/evaluator/GameDesignDocView';
import { GameDirectorModule } from '@/components/modules/game-director/GameDirectorModule';
import { ProjectSetupModule } from '@/components/modules/project-setup/ProjectSetupModule';
import { InlineTerminal } from '@/components/cli/InlineTerminal';

import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useActiveModuleId } from '@/hooks/useActiveModuleId';
import { ModuleErrorBoundary } from './ModuleErrorBoundary';
import type { SubModuleId } from '@/types/modules';

/** Human-readable labels for error boundary fallback */
const MODULE_LABELS: Record<string, string> = {
  'project-setup': 'Project Setup',
  'evaluator': 'Evaluator',
  'game-director': 'Game Director',
  'arpg-character': 'Character',
  'arpg-animation': 'Animation',
  'arpg-gas': 'GAS',
  'arpg-combat': 'Combat',
  'arpg-enemy-ai': 'Enemy AI',
  'arpg-inventory': 'Inventory',
  'arpg-loot': 'Loot',
  'arpg-ui': 'UI',
  'arpg-progression': 'Progression',
  'arpg-world': 'World',
  'arpg-save': 'Save',
  'arpg-polish': 'Polish',
  'models': 'Models',
  'animations': 'Animations',
  'materials': 'Materials',
  'level-design': 'Level Design',
  'ui-hud': 'UI / HUD',
  'audio': 'Audio',
  'ai-behavior': 'AI Behavior',
  'physics': 'Physics',
  'multiplayer': 'Multiplayer',
  'save-load': 'Save / Load',
  'input-handling': 'Input',
  'dialogue-quests': 'Dialogue & Quests',
  'packaging': 'Packaging',
  'blueprint-transpiler': 'Blueprint Transpiler',
  'game-design-doc': 'Game Design Doc',
};

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
  'blueprint-transpiler': BlueprintTranspilerView,
  'game-design-doc': GameDesignDocView,
};

// Special-case categories that render without sub-modules
const SPECIAL_CATEGORIES: Record<string, React.ComponentType> = {
  'project-setup': ProjectSetupModule,
  'evaluator': EvaluatorModule,
  'game-director': GameDirectorModule,
};

/**
 * Promote `id` to the front of `list` (most-recently-used). If the list
 * exceeds `cap`, the tail (least-recently-used) entry is evicted.
 * Mutates `list` in place and returns true if the list changed.
 */
function lruTouch(list: string[], id: string, cap: number): boolean {
  const idx = list.indexOf(id);
  if (idx === 0) return false; // already MRU — no change
  if (idx > 0) list.splice(idx, 1); // remove from old position
  list.unshift(id); // push to front
  if (list.length > cap) list.pop(); // evict LRU
  return true;
}

export function ModuleRenderer() {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const activeSubModule = useNavigationStore((s) => s.activeSubModule);

  // LRU list stored in a ref — mutations happen during render before JSX evaluation,
  // and navigation store changes already trigger re-renders.
  const moduleLru = useRef<string[]>([]);
  const sessionLru = useRef<string[]>([]);

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

  // Track visited modules with LRU eviction.
  // Navigation store changes trigger re-renders, so mutating the ref here is
  // picked up by the JSX below in the same render pass.
  if (activeSubModule) {
    lruTouch(moduleLru.current, activeSubModule, LRU_CAP);
  }
  if (activeCategory && SPECIAL_CATEGORIES[activeCategory]) {
    lruTouch(moduleLru.current, activeCategory, LRU_CAP);
  }
  if (inlineSessionId) {
    lruTouch(sessionLru.current, inlineSessionId, SESSION_LRU_CAP);
  }

  // Determine what to render
  const isSpecialCategory = activeCategory && SPECIAL_CATEGORIES[activeCategory];
  const hasActiveContent = isSpecialCategory || activeSubModule;

  // Track module switches to trigger entrance animations (must be before early return)
  const prevActiveRef = useRef<string | null>(null);
  const switchCountRef = useRef(0);
  const currentActiveId = isSpecialCategory ? activeCategory : activeSubModule;
  if (currentActiveId !== prevActiveRef.current) {
    switchCountRef.current += 1;
    prevActiveRef.current = currentActiveId ?? null;
  }
  const switchKey = switchCountRef.current;

  // Welcome / empty state
  if (!hasActiveContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          {activeCategory ? (
            <p className="text-text-muted text-sm">Select a module from the sidebar</p>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-text mb-2">Welcome to POF</h2>
              <p className="text-text-muted text-sm">Select a category to begin</p>
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
        {moduleLru.current.map((moduleId) => {
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
                <motion.div
                  key={`fade-${moduleId}-${isVisible ? switchKey : 'hidden'}`}
                  initial={isVisible ? { opacity: 0, y: 6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE_OUT }}
                  className="h-full"
                >
                  <ModuleErrorBoundary moduleName={MODULE_LABELS[moduleId] ?? moduleId}>
                    <SpecialComponent />
                  </ModuleErrorBoundary>
                </motion.div>
              </div>
            );
          }

          // Regular sub-module views
          const Component = MODULE_COMPONENTS[moduleId as SubModuleId];
          if (!Component) return null;
          const isVisible = activeSubModule === moduleId;
          return (
            <div
              key={moduleId}
              className="h-full"
              style={{ display: isVisible ? 'block' : 'none' }}
            >
              <motion.div
                key={`fade-${moduleId}-${isVisible ? switchKey : 'hidden'}`}
                initial={isVisible ? { opacity: 0, y: 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.base, ease: EASE_OUT }}
                className="h-full"
              >
                <ModuleErrorBoundary moduleName={MODULE_LABELS[moduleId] ?? moduleId}>
                  <Component />
                </ModuleErrorBoundary>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Inline terminals — LRU keep-alive: toggle visibility via display */}
      {sessionLru.current.map((sessionId) => {
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
