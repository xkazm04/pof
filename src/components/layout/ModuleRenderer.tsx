'use client';

import { Suspense, lazy, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigationStore } from '@/stores/navigationStore';
import { MODULE_LABELS } from '@/lib/module-registry';
import { DURATION, EASE_OUT } from '@/lib/motion';
import { SuspendContext } from '@/hooks/useSuspend';

/** Max number of modules kept mounted simultaneously. Oldest are evicted. */
const LRU_CAP = 5;

/** Max number of inline terminal sessions kept mounted simultaneously. */
const SESSION_LRU_CAP = 5;

// Module views are code-split via React.lazy so each module's code lives in its
// own chunk, loaded on demand and served by the <Suspense> boundary below.
// These view modules expose *named* exports, so each dynamic import is mapped to
// the `{ default }` shape React.lazy requires.
//
// Genre-based core engine view (shared by all 12 aRPG sub-modules via makeGenreView;
// it takes a `moduleId` prop, which the lazy wrapper preserves).
const GenreModuleView = lazy(() =>
  import('@/components/modules/core-engine/GenreModuleView').then((m) => ({ default: m.GenreModuleView })),
);
const PlanView = lazy(() =>
  import('@/components/modules/core-engine/PlanView').then((m) => ({ default: m.PlanView })),
);

const ModelsView = lazy(() =>
  import('@/components/modules/content/models/ModelsView').then((m) => ({ default: m.ModelsView })),
);
const AnimationsView = lazy(() =>
  import('@/components/modules/content/animations/AnimationsView').then((m) => ({ default: m.AnimationsView })),
);
const MaterialsView = lazy(() =>
  import('@/components/modules/content/materials/MaterialsView').then((m) => ({ default: m.MaterialsView })),
);
const LevelDesignView = lazy(() =>
  import('@/components/modules/content/level-design/LevelDesignView').then((m) => ({ default: m.LevelDesignView })),
);
const UIHudView = lazy(() =>
  import('@/components/modules/content/ui-hud/UIHudView').then((m) => ({ default: m.UIHudView })),
);
const AudioView = lazy(() =>
  import('@/components/modules/content/audio/AudioView').then((m) => ({ default: m.AudioView })),
);

const AIBehaviorView = lazy(() =>
  import('@/components/modules/game-systems/AIBehaviorView').then((m) => ({ default: m.AIBehaviorView })),
);
const PhysicsView = lazy(() =>
  import('@/components/modules/game-systems/PhysicsView').then((m) => ({ default: m.PhysicsView })),
);
const MultiplayerView = lazy(() =>
  import('@/components/modules/game-systems/MultiplayerView').then((m) => ({ default: m.MultiplayerView })),
);
const SaveLoadView = lazy(() =>
  import('@/components/modules/game-systems/SaveLoadView').then((m) => ({ default: m.SaveLoadView })),
);
const InputView = lazy(() =>
  import('@/components/modules/game-systems/InputView').then((m) => ({ default: m.InputView })),
);
const DialogueView = lazy(() =>
  import('@/components/modules/game-systems/DialogueView').then((m) => ({ default: m.DialogueView })),
);
const PackagingView = lazy(() =>
  import('@/components/modules/game-systems/PackagingView').then((m) => ({ default: m.PackagingView })),
);
const BlueprintTranspilerView = lazy(() =>
  import('@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView').then((m) => ({ default: m.BlueprintTranspilerView })),
);

const AssetViewerView = lazy(() =>
  import('@/components/modules/visual-gen/asset-viewer/AssetViewerView').then((m) => ({ default: m.AssetViewerView })),
);
const AssetForgeView = lazy(() =>
  import('@/components/modules/visual-gen/asset-forge/AssetForgeView').then((m) => ({ default: m.AssetForgeView })),
);
const MaterialLabView = lazy(() =>
  import('@/components/modules/visual-gen/material-lab/MaterialLabView').then((m) => ({ default: m.MaterialLabView })),
);
const BlenderPipelineView = lazy(() =>
  import('@/components/modules/visual-gen/blender-pipeline/BlenderPipelineView').then((m) => ({ default: m.BlenderPipelineView })),
);
const AssetBrowserView = lazy(() =>
  import('@/components/modules/visual-gen/asset-browser/AssetBrowserView').then((m) => ({ default: m.AssetBrowserView })),
);
const ImportAutomationView = lazy(() =>
  import('@/components/modules/visual-gen/import-automation/ImportAutomationView').then((m) => ({ default: m.ImportAutomationView })),
);
const AutoRigView = lazy(() =>
  import('@/components/modules/visual-gen/auto-rig/AutoRigView').then((m) => ({ default: m.AutoRigView })),
);
const ProceduralEngineView = lazy(() =>
  import('@/components/modules/visual-gen/procedural-engine/ProceduralEngineView').then((m) => ({ default: m.ProceduralEngineView })),
);
const SceneComposerView = lazy(() =>
  import('@/components/modules/visual-gen/scene-composer/SceneComposerView').then((m) => ({ default: m.SceneComposerView })),
);
const EvaluatorModule = lazy(() =>
  import('@/components/modules/evaluator/EvaluatorModule').then((m) => ({ default: m.EvaluatorModule })),
);
const GameDesignDocView = lazy(() =>
  import('@/components/modules/evaluator/GameDesignDocView').then((m) => ({ default: m.GameDesignDocView })),
);
const GameDirectorModule = lazy(() =>
  import('@/components/modules/game-director/GameDirectorModule').then((m) => ({ default: m.GameDirectorModule })),
);
const ProjectSetupModule = lazy(() =>
  import('@/components/modules/project-setup/ProjectSetupModule').then((m) => ({ default: m.ProjectSetupModule })),
);

// InlineTerminal is rendered with props *outside* the module Suspense boundary,
// so it stays eagerly imported (lazifying it would suspend with no boundary).
import { InlineTerminal } from '@/components/cli/InlineTerminal';

import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useActiveModuleId } from '@/hooks/useActiveModuleId';
import { ModuleErrorBoundary } from './ModuleErrorBoundary';
import { ModuleSkeleton } from './ModuleSkeleton';
import type { SubModuleId } from '@/types/modules';

/** Labels for special categories (not sub-modules — not in MODULE_LABELS) */
const SPECIAL_CATEGORY_LABELS: Record<string, string> = {
  'project-setup': 'Project Setup',
  'evaluator': 'Evaluator',
  'game-director': 'Game Director',
};

/** Human-readable label for a module/special-category id, falling back to the id. */
function moduleLabel(id: string): string {
  return MODULE_LABELS[id] ?? SPECIAL_CATEGORY_LABELS[id] ?? id;
}

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
  'core-engine-plan': PlanView, // Plan pseudo-module
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
  // Visual Generation (Asset Studio)
  'asset-viewer': AssetViewerView,
  'asset-forge': AssetForgeView,
  'material-lab': MaterialLabView,
  'blender-pipeline': BlenderPipelineView,
  'asset-browser': AssetBrowserView,
  'import-automation': ImportAutomationView,
  'auto-rig': AutoRigView,
  'procedural-engine': ProceduralEngineView,
  'scene-composer': SceneComposerView,
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
function lruTouched(list: string[], id: string, cap: number): string[] | null {
  if (list[0] === id) return null; // already MRU — no change
  const next = list.filter(x => x !== id);
  next.unshift(id);
  if (next.length > cap) next.pop();
  return next;
}

export function ModuleRenderer() {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const activeSubModule = useNavigationStore((s) => s.activeSubModule);
  const prefersReduced = useReducedMotion();

  // LRU list stored in a ref — mutations happen during render before JSX evaluation,
  // and navigation store changes already trigger re-renders.
  const [moduleLru, setModuleLru] = useState<string[]>([]);
  const [sessionLru, setSessionLru] = useState<string[]>([]);

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

  // Track visited modules with LRU eviction (render-time state adjustment).
  if (activeSubModule) {
    const next = lruTouched(moduleLru, activeSubModule, LRU_CAP);
    if (next) setModuleLru(next);
  }
  if (activeCategory && SPECIAL_CATEGORIES[activeCategory]) {
    const next = lruTouched(moduleLru, activeCategory, LRU_CAP);
    if (next) setModuleLru(next);
  }
  if (inlineSessionId) {
    const next = lruTouched(sessionLru, inlineSessionId, SESSION_LRU_CAP);
    if (next) setSessionLru(next);
  }

  // Determine what to render
  const isSpecialCategory = activeCategory && SPECIAL_CATEGORIES[activeCategory];
  const hasActiveContent = isSpecialCategory || activeSubModule;

  // Track module switches to trigger entrance animations (must be before early return)
  const [prevActiveId, setPrevActiveId] = useState<string | null>(null);
  const [switchKey, setSwitchKey] = useState(0);
  const currentActiveId = isSpecialCategory ? activeCategory : activeSubModule;
  if (currentActiveId !== prevActiveId) {
    setPrevActiveId(currentActiveId ?? null);
    setSwitchKey(k => k + 1);
  }

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

  const crossfadeDuration = prefersReduced ? 0 : DURATION.fast;

  // Render a single keep-alive module pane: visibility toggled via `display`,
  // suspended when hidden, crossfaded on entrance, guarded by an error boundary.
  // Shared by both special-category and sub-module panes (resolution differs only
  // in how `Component` and `isVisible` are derived below).
  const renderModulePane = (
    moduleId: string,
    Component: React.ComponentType,
    isVisible: boolean,
  ) => (
    <div
      key={moduleId}
      className="h-full"
      style={{ display: isVisible ? 'block' : 'none' }}
    >
      <SuspendContext.Provider value={!isVisible}>
        <motion.div
          key={`fade-${moduleId}-${isVisible ? switchKey : 'hidden'}`}
          initial={isVisible ? { opacity: 0, y: -4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: crossfadeDuration, ease: EASE_OUT }}
          className="h-full"
        >
          <ModuleErrorBoundary moduleName={moduleLabel(moduleId)}>
            <Suspense fallback={<ModuleSkeleton />}>
              <Component />
            </Suspense>
          </ModuleErrorBoundary>
        </motion.div>
      </SuspendContext.Provider>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Scrollable module content */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {moduleLru.map((moduleId) => {
          // Special category modules render without sub-modules.
          const SpecialComponent = SPECIAL_CATEGORIES[moduleId];
          if (SpecialComponent) {
            return renderModulePane(moduleId, SpecialComponent, activeCategory === moduleId);
          }

          // Regular sub-module views.
          const Component = MODULE_COMPONENTS[moduleId as SubModuleId];
          if (!Component) return null;
          return renderModulePane(moduleId, Component, activeSubModule === moduleId);
        })}

        {/* Crossfade veil — bg-colored overlay that fades out to reveal incoming module */}
        <AnimatePresence>
          {currentActiveId && (
            <motion.div
              key={`veil-${switchKey}`}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: crossfadeDuration, ease: EASE_OUT }}
              className="absolute inset-0 bg-background pointer-events-none z-10"
              aria-hidden
            />
          )}
        </AnimatePresence>
      </div>

      {/* Inline terminals — LRU keep-alive: toggle visibility via display */}
      {sessionLru.map((sessionId) => {
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
