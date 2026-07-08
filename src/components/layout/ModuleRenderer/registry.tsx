'use client';

import { lazy } from 'react';
import type { SubModuleId } from '@/types/modules';

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

// Factory for genre-based core engine sub-modules
function makeGenreView(id: SubModuleId) {
  return function GenreView() {
    return <GenreModuleView moduleId={id} />;
  };
}

export const MODULE_COMPONENTS: Record<SubModuleId, React.ComponentType> = {
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
export const SPECIAL_CATEGORIES: Record<string, React.ComponentType> = {
  'project-setup': ProjectSetupModule,
  'evaluator': EvaluatorModule,
  'game-director': GameDirectorModule,
};
