'use client';

import { createRegistry } from '@/lib/dzin/core';
import { DENSITY_CONFIG } from '@/lib/dzin/animation-constants';
import { CorePanel } from '@/components/modules/core-engine/dzin-panels/CorePanel';
import { AttributesPanel } from '@/components/modules/core-engine/dzin-panels/AttributesPanel';
import { TagsPanel } from '@/components/modules/core-engine/dzin-panels/TagsPanel';
import { AbilitiesPanel } from '@/components/modules/core-engine/dzin-panels/AbilitiesPanel';
import { EffectsPanel } from '@/components/modules/core-engine/dzin-panels/EffectsPanel';
import { TagDepsPanel } from '@/components/modules/core-engine/dzin-panels/TagDepsPanel';
import { EffectTimelinePanel } from '@/components/modules/core-engine/dzin-panels/EffectTimelinePanel';
import { DamageCalcPanel } from '@/components/modules/core-engine/dzin-panels/DamageCalcPanel';
import { TagAuditPanel } from '@/components/modules/core-engine/dzin-panels/TagAuditPanel';
import { LoadoutPanel } from '@/components/modules/core-engine/dzin-panels/LoadoutPanel';
import { CharacterOverviewPanel } from '@/components/modules/core-engine/dzin-panels/CharacterOverviewPanel';
import { CharacterMovementPanel } from '@/components/modules/core-engine/dzin-panels/CharacterMovementPanel';
import { AnimationStateMachinePanel } from '@/components/modules/core-engine/dzin-panels/AnimationStateMachinePanel';
import { AnimationMontagesPanel } from '@/components/modules/core-engine/dzin-panels/AnimationMontagesPanel';
import { AnimationBlendSpacePanel } from '@/components/modules/core-engine/dzin-panels/AnimationBlendSpacePanel';
import { CharacterInputPanel } from '@/components/modules/core-engine/dzin-panels/CharacterInputPanel';
import { InventoryCatalogPanel } from '@/components/modules/core-engine/dzin-panels/InventoryCatalogPanel';
import { InventoryEquipmentPanel } from '@/components/modules/core-engine/dzin-panels/InventoryEquipmentPanel';
import { LootTablePanel } from '@/components/modules/core-engine/dzin-panels/LootTablePanel';
import { LootAffixPanel } from '@/components/modules/core-engine/dzin-panels/LootAffixPanel';
import { ItemEconomyPanel } from '@/components/modules/core-engine/dzin-panels/ItemEconomyPanel';
import { ItemDNAPanel } from '@/components/modules/core-engine/dzin-panels/ItemDNAPanel';
import { EnemyBestiaryPanel } from '@/components/modules/core-engine/dzin-panels/EnemyBestiaryPanel';
import { EnemyAITreePanel } from '@/components/modules/core-engine/dzin-panels/EnemyAITreePanel';
import { WorldZoneMapPanel } from '@/components/modules/core-engine/dzin-panels/WorldZoneMapPanel';
import { WorldEncountersPanel } from '@/components/modules/core-engine/dzin-panels/WorldEncountersPanel';
import { WorldLevelDesignPanel } from '@/components/modules/core-engine/dzin-panels/WorldLevelDesignPanel';
import { ProgressionCurvesPanel } from '@/components/modules/core-engine/dzin-panels/ProgressionCurvesPanel';
import { HudCompositorPanel } from '@/components/modules/core-engine/dzin-panels/HudCompositorPanel';
import { ScreenFlowPanel } from '@/components/modules/core-engine/dzin-panels/ScreenFlowPanel';
import { SaveSchemaPanel } from '@/components/modules/core-engine/dzin-panels/SaveSchemaPanel';
import { SaveSlotsPanel } from '@/components/modules/core-engine/dzin-panels/SaveSlotsPanel';
import { MenuFlowPanel } from '@/components/modules/core-engine/dzin-panels/MenuFlowPanel';
import { EvalQualityPanel } from '@/components/modules/core-engine/dzin-panels/EvalQualityPanel';
import { EvalDepsPanel } from '@/components/modules/core-engine/dzin-panels/EvalDepsPanel';
import { EvalInsightsPanel } from '@/components/modules/core-engine/dzin-panels/EvalInsightsPanel';
import { ProjectHealthPanel } from '@/components/modules/core-engine/dzin-panels/ProjectHealthPanel';
import { FeatureMatrixPanel } from '@/components/modules/core-engine/dzin-panels/FeatureMatrixPanel';
import { MaterialPreviewPanel } from '@/components/modules/core-engine/dzin-panels/MaterialPreviewPanel';
import { AudioSpatialPanel } from '@/components/modules/core-engine/dzin-panels/AudioSpatialPanel';
import { ModelAssetsPanel } from '@/components/modules/core-engine/dzin-panels/ModelAssetsPanel';
import { LevelBlockoutPanel } from '@/components/modules/core-engine/dzin-panels/LevelBlockoutPanel';
import { VfxParticlesPanel } from '@/components/modules/core-engine/dzin-panels/VfxParticlesPanel';
import { DirectorOverviewPanel } from '@/components/modules/core-engine/dzin-panels/DirectorOverviewPanel';
import { DirectorFindingsPanel } from '@/components/modules/core-engine/dzin-panels/DirectorFindingsPanel';
import { DirectorRegressionPanel } from '@/components/modules/core-engine/dzin-panels/DirectorRegressionPanel';
import { DirectorSessionPanel } from '@/components/modules/core-engine/dzin-panels/DirectorSessionPanel';
import { AISandboxPanel } from '@/components/modules/core-engine/dzin-panels/AISandboxPanel';
import { PhysicsSystemPanel } from '@/components/modules/core-engine/dzin-panels/PhysicsSystemPanel';
import { MultiplayerSystemPanel } from '@/components/modules/core-engine/dzin-panels/MultiplayerSystemPanel';
import { InputSystemPanel } from '@/components/modules/core-engine/dzin-panels/InputSystemPanel';
import { SaveLoadSystemPanel } from '@/components/modules/core-engine/dzin-panels/SaveLoadSystemPanel';
import { BuildPipelinePanel } from '@/components/modules/core-engine/dzin-panels/BuildPipelinePanel';
import { SetupWizardPanel } from '@/components/modules/core-engine/dzin-panels/SetupWizardPanel';
import { SetupStatusPanel } from '@/components/modules/core-engine/dzin-panels/SetupStatusPanel';
import { UE5RemotePanel } from '@/components/modules/core-engine/dzin-panels/UE5RemotePanel';
import { BlueprintInspectorPanel } from '@/components/modules/core-engine/dzin-panels/BlueprintInspectorPanel';
import { TestHarnessDzinPanel } from '@/components/modules/core-engine/dzin-panels/TestHarnessDzinPanel';
import { AssetBrowserPanel } from '@/components/modules/core-engine/dzin-panels/AssetBrowserPanel';
import { AssetForgePanel } from '@/components/modules/core-engine/dzin-panels/AssetForgePanel';
import { AssetViewer3DPanel } from '@/components/modules/core-engine/dzin-panels/AssetViewer3DPanel';
import { MaterialLabPBRPanel } from '@/components/modules/core-engine/dzin-panels/MaterialLabPBRPanel';
import { BlenderPipelinePanel } from '@/components/modules/core-engine/dzin-panels/BlenderPipelinePanel';
import { SceneComposerPanel } from '@/components/modules/core-engine/dzin-panels/SceneComposerPanel';
import { EvalDeepScanPanel } from '@/components/modules/core-engine/dzin-panels/EvalDeepScanPanel';
import { EvalEconomyPanel } from '@/components/modules/core-engine/dzin-panels/EvalEconomyPanel';
import { EvalRoadmapPanel } from '@/components/modules/core-engine/dzin-panels/EvalRoadmapPanel';
import { EvalPerformancePanel } from '@/components/modules/core-engine/dzin-panels/EvalPerformancePanel';
import { EvalSessionAnalyticsPanel } from '@/components/modules/core-engine/dzin-panels/EvalSessionAnalyticsPanel';
import { EvalPatternLibraryPanel } from '@/components/modules/core-engine/dzin-panels/EvalPatternLibraryPanel';
import { AnimChoreographerPanel } from '@/components/modules/core-engine/dzin-panels/AnimChoreographerPanel';
import { AudioEventCatalogPanel } from '@/components/modules/core-engine/dzin-panels/AudioEventCatalogPanel';
import { LevelFlowEditorPanel } from '@/components/modules/core-engine/dzin-panels/LevelFlowEditorPanel';
import { MaterialPatternsPanel } from '@/components/modules/core-engine/dzin-panels/MaterialPatternsPanel';
import { UIDamageNumbersPanel } from '@/components/modules/core-engine/dzin-panels/UIDamageNumbersPanel';
import { UIHealthBarsPanel } from '@/components/modules/core-engine/dzin-panels/UIHealthBarsPanel';
import { AbilityForgePanel } from '@/components/modules/core-engine/dzin-panels/AbilityForgePanel';
import { CombatChoreographyPanel } from '@/components/modules/core-engine/dzin-panels/CombatChoreographyPanel';
import { ComboChainPanel } from '@/components/modules/core-engine/dzin-panels/ComboChainPanel';
import { DamagePipelinePanel } from '@/components/modules/core-engine/dzin-panels/DamagePipelinePanel';
import { DebugDashboardPanel } from '@/components/modules/core-engine/dzin-panels/DebugDashboardPanel';
import { DodgeTimelinePanel } from '@/components/modules/core-engine/dzin-panels/DodgeTimelinePanel';
import { GenomeEditorPanel } from '@/components/modules/core-engine/dzin-panels/GenomeEditorPanel';
import { GasBlueprintPanel } from '@/components/modules/core-engine/dzin-panels/GasBlueprintPanel';
import type { ComponentType } from 'react';

/* ── PoF Panel Registry ─────────────────────────────────────────────────── */

export const pofRegistry = createRegistry();

/* ── CorePanel registration (gold standard template) ────────────────────── */

pofRegistry.register({
  type: 'arpg-combat-core',
  label: 'Core -- AbilitySystem',
  icon: 'Cpu',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-combat'],
  description:
    'GAS pipeline status, AbilitySystemComponent connections, and architecture explorer for the core ARPG combat module',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: [
    'View AbilitySystemComponent setup status',
    'Check GAS pipeline completion',
    'Inspect ASC connection topology',
  ],
  suggestedCompanions: [
    'arpg-combat-abilities',
    'arpg-combat-effects',
    'arpg-combat-attributes',
  ],
  inputs: [
    {
      name: 'featureMap',
      type: 'object',
      description: 'Map<string, FeatureRow> mapping feature names to their status data',
      required: true,
    },
    {
      name: 'defs',
      type: 'object',
      description: 'Array of feature definitions with featureName, description, and optional dependsOn',
      required: true,
    },
  ],
  outputs: [
    {
      name: 'onFeatureSelect',
      type: 'string',
      description: 'Emits selected feature name when user clicks a feature card, for cross-panel filtering',
    },
  ],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Cpu icon with pipeline progress badge (e.g. 3/6)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'ASC feature status, 4 connection indicators, pipeline step count' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full CoreSection with feature card, connections grid, GAS pipeline, architecture explorer' },
  },
  component: CorePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── AttributesPanel registration ──────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-combat-attributes',
  label: 'Attributes -- AttributeSet',
  icon: 'BarChart3',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-combat'],
  description: 'Attribute catalog, relationship web, and growth projections for the ARPG combat AttributeSet',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['View core and derived attributes', 'Inspect attribute relationships', 'Project attribute growth curves'],
  suggestedCompanions: ['arpg-combat-core', 'arpg-combat-abilities', 'arpg-combat-damage-calc'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onAttributeSelect', type: 'string', description: 'Emits selected attribute name for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'BarChart3 icon with attribute count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Core vs derived attribute summary with status' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full attribute catalog, relationship web, growth projections' },
  },
  component: AttributesPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── TagsPanel registration ───────────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-combat-tags',
  label: 'Tags -- Gameplay Tags',
  icon: 'Tags',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'low',
  domains: ['arpg-combat'],
  description: 'Gameplay tag hierarchy viewer showing tag categories, naming conventions, and tag tree structure',
  capabilities: ['viewing', 'hierarchy-visualization'],
  useCases: ['Browse tag hierarchy', 'Check tag category counts', 'Inspect tag naming structure'],
  suggestedCompanions: ['arpg-combat-tag-deps', 'arpg-combat-tag-audit', 'arpg-combat-effects'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onTagSelect', type: 'string', description: 'Emits selected tag name for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Tags icon with total tag count' },
    compact: { ...DENSITY_CONFIG.standard.compact, minHeight: 120, description: 'Tag categories with child counts' },
    full: { ...DENSITY_CONFIG.standard.full, minHeight: 280, description: 'Full tag hierarchy tree with category colors' },
  },
  component: TagsPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── AbilitiesPanel registration ──────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-combat-abilities',
  label: 'Abilities -- GameplayAbility',
  icon: 'Sparkles',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-combat'],
  description: 'Ability radar comparison, cooldown flow visualization, and GameplayAbility feature tracking',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Compare ability stats via radar chart', 'Monitor cooldown flows', 'Track GameplayAbility implementation'],
  suggestedCompanions: ['arpg-combat-core', 'arpg-combat-effects', 'arpg-combat-loadout'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onAbilitySelect', type: 'string', description: 'Emits selected ability name for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Sparkles icon with ability count' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Ability list with cooldown bars' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full ability radar, cooldown flow, feature cards' },
  },
  component: AbilitiesPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EffectsPanel registration ─────────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-combat-effects',
  label: 'Effects -- GameplayEffect',
  icon: 'Flame',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-combat'],
  description: 'Gameplay effect types, application pipeline, and effect feature tracking for the ARPG combat system',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View effect type catalog', 'Track GameplayEffect implementation', 'Inspect effect application pipeline'],
  suggestedCompanions: ['arpg-combat-effect-timeline', 'arpg-combat-abilities', 'arpg-combat-damage-calc'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onEffectSelect', type: 'string', description: 'Emits selected effect type for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Flame icon with effect count badge (4)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Effect type list with colored dots and feature status indicators' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full effect type cards with stacking/calculation details and application pipeline' },
  },
  component: EffectsPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── TagDepsPanel registration ─────────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-combat-tag-deps',
  label: 'Tag Deps -- Dependencies',
  icon: 'Network',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-combat'],
  description: 'Tag dependency network graph showing blocking and requirement relationships between gameplay tags',
  capabilities: ['viewing', 'graph-visualization'],
  useCases: ['Visualize tag blocking relationships', 'Identify dependency chains', 'Debug tag interaction conflicts'],
  suggestedCompanions: ['arpg-combat-tags', 'arpg-combat-tag-audit', 'arpg-combat-effects'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onTagDepSelect', type: 'string', description: 'Emits selected tag dependency for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Network icon with dependency edge count badge (6)' },
    compact: { ...DENSITY_CONFIG.standard.compact, minHeight: 120, description: 'Simplified dependency list showing blocking relationships' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'SVG network graph with nodes, edges, and category color coding' },
  },
  component: TagDepsPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EffectTimelinePanel registration ──────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-combat-effect-timeline',
  label: 'Effect Timeline',
  icon: 'Clock',
  defaultRole: 'secondary',
  sizeClass: 'wide',
  complexity: 'medium',
  domains: ['arpg-combat'],
  description: 'Temporal visualization of gameplay effect stacking, durations, and application sequence',
  capabilities: ['viewing', 'timeline-visualization'],
  useCases: ['Visualize effect timing', 'Debug effect stacking order', 'Inspect duration overlaps'],
  suggestedCompanions: ['arpg-combat-effects', 'arpg-combat-abilities', 'arpg-combat-damage-calc'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onTimelineEventSelect', type: 'string', description: 'Emits selected timeline event for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.wide.micro, description: 'Clock icon with timeline span badge (e.g. 0.5s - 10.5s)' },
    compact: { ...DENSITY_CONFIG.wide.compact, description: 'Condensed timeline bar with color-coded segments' },
    full: { ...DENSITY_CONFIG.wide.full, description: 'Full interactive TimelineStrip with event details' },
  },
  component: EffectTimelinePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── DamageCalcPanel registration ──────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-combat-damage-calc',
  label: 'Damage Calc -- Execution Pipeline',
  icon: 'Calculator',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-combat'],
  description: 'Step-by-step damage execution pipeline from ability commit through post-effect callbacks',
  capabilities: ['viewing', 'pipeline-visualization'],
  useCases: ['Trace damage calculation flow', 'Debug execution pipeline steps', 'Understand GAS damage sequence'],
  suggestedCompanions: ['arpg-combat-effects', 'arpg-combat-abilities', 'arpg-combat-attributes'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onStepSelect', type: 'string', description: 'Emits selected pipeline step for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Calculator icon with step count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, minHeight: 200, description: 'Pipeline step list with colored dots' },
    full: { ...DENSITY_CONFIG.standard.full, minHeight: 400, description: 'Full animated GAS execution sequence diagram' },
  },
  component: DamageCalcPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── TagAuditPanel registration ────────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-combat-tag-audit',
  label: 'Tag Audit -- Quality Check',
  icon: 'ClipboardCheck',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-combat'],
  description: 'Tag quality audit dashboard with duplicate detection, unused tag identification, and naming convention checks',
  capabilities: ['viewing', 'audit-reporting'],
  useCases: ['Run tag quality audit', 'Identify unused or missing tags', 'Check naming conventions'],
  suggestedCompanions: ['arpg-combat-tags', 'arpg-combat-tag-deps'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onAuditCategorySelect', type: 'string', description: 'Emits selected audit category for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'ClipboardCheck icon with pass/fail score badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Audit category summary with status indicators' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full audit checklist, usage frequency, tag details' },
  },
  component: TagAuditPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── LoadoutPanel registration ─────────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-combat-loadout',
  label: 'Loadout -- Optimizer',
  icon: 'Layers',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-combat'],
  description: 'Ability loadout optimizer with slot assignments, balance radar, and alternative loadout comparisons',
  capabilities: ['viewing', 'chart-visualization', 'comparison'],
  useCases: ['View optimal ability loadout', 'Compare loadout balance', 'Explore alternative configurations'],
  suggestedCompanions: ['arpg-combat-abilities', 'arpg-combat-core', 'arpg-combat-effects'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onLoadoutSelect', type: 'string', description: 'Emits selected loadout for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Layers icon with slot count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Loadout slots with ability names and score' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full loadout grid, radar chart, alternatives table' },
  },
  component: LoadoutPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── CharacterOverviewPanel registration ──────────────────────────────── */

pofRegistry.register({
  type: 'arpg-character-overview',
  label: 'Character Overview',
  icon: 'User',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-character'],
  description: 'Class hierarchy, framework classes, and character feature tracking for AARPGCharacterBase and AARPGPlayerCharacter',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View character class hierarchy', 'Track character feature implementation', 'Inspect framework class setup'],
  suggestedCompanions: ['arpg-character-movement', 'arpg-character-input', 'arpg-animation-state-machine'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onFeatureSelect', type: 'string', description: 'Emits selected feature name for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'User icon with feature completion badge (e.g. 5/10)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'CharacterBase status, framework class list with status dots' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full class hierarchy, feature cards, framework pipeline' },
  },
  component: CharacterOverviewPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── CharacterMovementPanel registration ──────────────────────────────── */

pofRegistry.register({
  type: 'arpg-character-movement',
  label: 'Movement -- CMC',
  icon: 'Move',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-character'],
  description: 'Character movement system with WASD, sprint, dodge, and CMC parameter tracking',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View movement feature status', 'Inspect CMC parameters', 'Trace movement pipeline'],
  suggestedCompanions: ['arpg-character-overview', 'arpg-character-input', 'arpg-animation-blend-space'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onMovementSelect', type: 'string', description: 'Emits selected movement feature for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Move icon with movement feature count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Movement feature list with status dots and CMC note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full movement feature cards, parameter grid, pipeline flow' },
  },
  component: CharacterMovementPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── AnimationStateMachinePanel registration ──────────────────────────── */

pofRegistry.register({
  type: 'arpg-animation-state-machine',
  label: 'Anim State Machine',
  icon: 'GitBranch',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-character', 'arpg-animation'],
  description: 'AnimBP state machine with 5 states (Locomotion, Attacking, Dodging, HitReact, Death) and transition graph',
  capabilities: ['viewing', 'graph-visualization', 'status-tracking'],
  useCases: ['View animation states and transitions', 'Track AnimInstance implementation', 'Inspect root motion config'],
  suggestedCompanions: ['arpg-animation-montages', 'arpg-animation-blend-space', 'arpg-character-overview'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onStateSelect', type: 'string', description: 'Emits selected animation state for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'GitBranch icon with state count badge (5 states)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'State list with transition counts and status' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full state transition graph, feature cards, root motion details' },
  },
  component: AnimationStateMachinePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── AnimationMontagesPanel registration ──────────────────────────────── */

pofRegistry.register({
  type: 'arpg-animation-montages',
  label: 'Montages -- Notifies',
  icon: 'Film',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-character', 'arpg-animation'],
  description: 'Animation montage catalog with combo sections, anim notify types, and motion warping tracking',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['Browse montage catalog', 'View combo section structure', 'Track anim notify implementation'],
  suggestedCompanions: ['arpg-animation-state-machine', 'arpg-animation-blend-space', 'arpg-character-movement'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onMontageSelect', type: 'string', description: 'Emits selected montage for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Film icon with montage count badge (4)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Montage list with section counts and status' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full montage catalog, section breakdown, notify type grid' },
  },
  component: AnimationMontagesPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── AnimationBlendSpacePanel registration ────────────────────────────── */

pofRegistry.register({
  type: 'arpg-animation-blend-space',
  label: 'Blend Space -- 1D',
  icon: 'Blend',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'low',
  domains: ['arpg-character', 'arpg-animation'],
  description: '1D Blend Space visualization with Idle/Walk/Run samples driven by Speed parameter',
  capabilities: ['viewing', 'chart-visualization'],
  useCases: ['Visualize blend space samples', 'Inspect speed axis parameters', 'Track blend space implementation'],
  suggestedCompanions: ['arpg-animation-state-machine', 'arpg-character-movement'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onSampleSelect', type: 'string', description: 'Emits selected blend sample for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Blend icon with "1D BS" label' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Sample list with speed values and axis info' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full blend space axis visualization, sample cards, feature cards' },
  },
  component: AnimationBlendSpacePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── CharacterInputPanel registration ─────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-character-input',
  label: 'Input -- Enhanced Input',
  icon: 'Gamepad2',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-character'],
  description: 'Enhanced Input system with InputAction catalog, binding details, and input pipeline visualization',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Browse input action catalog', 'View key bindings', 'Trace enhanced input pipeline'],
  suggestedCompanions: ['arpg-character-overview', 'arpg-character-movement'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onInputSelect', type: 'string', description: 'Emits selected input action for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Gamepad2 icon with input action count badge (6 IA)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Input action list with bindings and IMC note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full input action grid, binding details, input pipeline flow' },
  },
  component: CharacterInputPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── InventoryCatalogPanel registration ──────────────────────────────── */

pofRegistry.register({
  type: 'arpg-inventory-catalog',
  label: 'Item Catalog',
  icon: 'Package',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-inventory'],
  description: 'Item type catalog with rarity tiers, stack management, and inventory pipeline for UARPGItemDefinition data assets',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Browse item type catalog', 'View rarity distribution', 'Track inventory feature implementation'],
  suggestedCompanions: ['arpg-inventory-equipment', 'arpg-loot-table', 'arpg-loot-affix'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onItemTypeSelect', type: 'string', description: 'Emits selected item type for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Package icon with item count and completion badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Item type list with counts and rarity tier dots' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full item type grid, rarity distribution, feature cards, inventory pipeline' },
  },
  component: InventoryCatalogPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── InventoryEquipmentPanel registration ────────────────────────────── */

pofRegistry.register({
  type: 'arpg-inventory-equipment',
  label: 'Equipment -- Slots',
  icon: 'Shield',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-inventory'],
  description: 'Equipment slot system with 8 slots, stat bonuses from equipped items, and drag-and-drop swap logic',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['View equipment slot layout', 'Check equipped item status', 'Track equipment system features'],
  suggestedCompanions: ['arpg-inventory-catalog', 'arpg-loot-affix', 'arpg-item-dna'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onSlotSelect', type: 'string', description: 'Emits selected equipment slot for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Shield icon with equipped/total count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Equipment slot list with equipped status dots' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full equipment slot grid with slot details and feature cards' },
  },
  component: InventoryEquipmentPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── LootTablePanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-loot-table',
  label: 'Loot Tables',
  icon: 'Coins',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-loot'],
  description: 'Loot table system with weighted random selection, world item spawning, and drop pipeline visualization',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Browse loot table catalog', 'View drop rates and weights', 'Trace loot drop pipeline'],
  suggestedCompanions: ['arpg-loot-affix', 'arpg-inventory-catalog', 'arpg-item-economy'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onLootTableSelect', type: 'string', description: 'Emits selected loot table for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Coins icon with loot table count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Loot table list with drop rates and entry counts' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full loot table cards, feature cards, drop pipeline flow' },
  },
  component: LootTablePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── LootAffixPanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-loot-affix',
  label: 'Affix Crafting',
  icon: 'Sparkles',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-loot', 'arpg-inventory'],
  description: 'Affix rolling system with offensive/defensive/utility categories, prefix/suffix slots per rarity tier, and power budgets',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['Browse affix categories', 'View rolling tier rules', 'Track affix system implementation'],
  suggestedCompanions: ['arpg-loot-table', 'arpg-item-dna', 'arpg-inventory-catalog'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onAffixSelect', type: 'string', description: 'Emits selected affix for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Sparkles icon with total affix count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Affix category list with counts and rarity tier note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full affix category cards, rolling tier breakdown, feature cards' },
  },
  component: LootAffixPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── ItemEconomyPanel registration ───────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-item-economy',
  label: 'Item Economy',
  icon: 'TrendingUp',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-loot', 'arpg-inventory'],
  description: 'Item economy simulator tracking gold influx, item sink rates, rarity inflation, and power curve health',
  capabilities: ['viewing', 'chart-visualization', 'audit-reporting'],
  useCases: ['Monitor economy health metrics', 'View supply/demand radar', 'Check economy alerts'],
  suggestedCompanions: ['arpg-loot-table', 'arpg-inventory-catalog', 'arpg-item-dna'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onMetricSelect', type: 'string', description: 'Emits selected economy metric for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'TrendingUp icon with alert count or "Stable" badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Economy metrics list with status dots and values' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full economy metrics, radar chart, and alert list' },
  },
  component: ItemEconomyPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── ItemDNAPanel registration ───────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-item-dna',
  label: 'Item DNA -- Genome',
  icon: 'Dna',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-loot', 'arpg-inventory'],
  description: 'Item DNA genome editor with 5-axis trait system, genome breeding, evolution mechanics, and affix rolling biases',
  capabilities: ['viewing', 'chart-visualization'],
  useCases: ['View trait axis weights', 'Browse genome presets', 'Inspect DNA operations'],
  suggestedCompanions: ['arpg-loot-affix', 'arpg-item-economy', 'arpg-inventory-catalog'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onTraitSelect', type: 'string', description: 'Emits selected trait axis for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Dna icon with trait axis count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Trait axis list with weight bars and preset count' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full trait axis bars, radar chart, genome presets, DNA operations' },
  },
  component: ItemDNAPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EnemyBestiaryPanel registration ───────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-enemy-bestiary',
  label: 'Enemy Bestiary',
  icon: 'Skull',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-enemy'],
  description: 'Enemy bestiary with archetypes (Grunt, Caster, Brute, Assassin), AI pipeline, and radar comparison',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Browse enemy archetypes', 'Compare archetype stats via radar', 'Track AI feature implementation'],
  suggestedCompanions: ['arpg-enemy-ai-tree', 'arpg-world-encounters', 'arpg-world-zone-map'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onArchetypeSelect', type: 'string', description: 'Emits selected enemy archetype for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Skull icon with archetype count badge (4 types)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Archetype list with roles and AI pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full archetype cards, radar chart, feature cards, AI pipeline' },
  },
  component: EnemyBestiaryPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EnemyAITreePanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-enemy-ai-tree',
  label: 'AI Behavior Tree',
  icon: 'Brain',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-enemy'],
  description: 'Behavior tree state machine with Idle/Patrol/Chase/Attack/Flee states and BT node pipeline',
  capabilities: ['viewing', 'graph-visualization', 'pipeline-visualization'],
  useCases: ['View BT states and transitions', 'Trace BT execution pipeline', 'Track AI controller implementation'],
  suggestedCompanions: ['arpg-enemy-bestiary', 'arpg-world-encounters'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onBTStateSelect', type: 'string', description: 'Emits selected BT state for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Brain icon with BT state count badge (5 states)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'BT state list with colored dots and node type count' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full BT state descriptions, feature cards, execution pipeline' },
  },
  component: EnemyAITreePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── WorldZoneMapPanel registration ────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-world-zone-map',
  label: 'Zone Map',
  icon: 'Map',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-world'],
  description: 'World zone architecture with 5 zones (Town→Boss Arena), difficulty scaling, and build pipeline',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View zone layout and difficulty', 'Track world feature implementation', 'Trace world build pipeline'],
  suggestedCompanions: ['arpg-world-encounters', 'arpg-world-level-design', 'arpg-enemy-bestiary'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onZoneSelect', type: 'string', description: 'Emits selected zone for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Map icon with zone count badge (5 zones)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Zone list with difficulty labels and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full zone grid, feature cards, world build pipeline' },
  },
  component: WorldZoneMapPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── WorldEncountersPanel registration ─────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-world-encounters',
  label: 'World Encounters',
  icon: 'Swords',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-world'],
  description: 'Encounter design with ambient, wave, boss, and trap encounter types with placement counts',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['Browse encounter types', 'View encounter placement counts', 'Track encounter features'],
  suggestedCompanions: ['arpg-world-zone-map', 'arpg-enemy-bestiary', 'arpg-world-level-design'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onEncounterSelect', type: 'string', description: 'Emits selected encounter type for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Swords icon with total encounter count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Encounter type list with placement counts' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full encounter type grid with descriptions and feature cards' },
  },
  component: WorldEncountersPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── WorldLevelDesignPanel registration ────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-world-level-design',
  label: 'Level Design',
  icon: 'Layers',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-world'],
  description: 'Level production pipeline with Greybox/ArtPass/Gameplay/Polish phases and zone feature tracking',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View level production phases', 'Track zone feature implementation', 'Trace level build pipeline'],
  suggestedCompanions: ['arpg-world-zone-map', 'arpg-world-encounters'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onPhaseSelect', type: 'string', description: 'Emits selected production phase for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Layers icon with phase count badge (4 phases)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Production phase list with colored dots and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full phase details, feature cards, level production pipeline' },
  },
  component: WorldLevelDesignPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── ProgressionCurvesPanel registration ───────────────────────────────── */

pofRegistry.register({
  type: 'arpg-progression-curves',
  label: 'Progression Curves',
  icon: 'TrendingUp',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-progression'],
  description: 'Progression scaling curves for XP, power, abilities, gear score, and difficulty with radar visualization',
  capabilities: ['viewing', 'chart-visualization', 'pipeline-visualization'],
  useCases: ['View scaling curve metrics', 'Compare progression balance via radar', 'Track progression feature implementation'],
  suggestedCompanions: ['arpg-enemy-bestiary', 'arpg-world-zone-map'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onCurveSelect', type: 'string', description: 'Emits selected progression curve for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'TrendingUp icon with curve count badge (5 curves)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Curve metric list with colored dots and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full curve details, radar chart, feature cards, level-up pipeline' },
  },
  component: ProgressionCurvesPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── HudCompositorPanel registration ──────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-ui-hud-compositor',
  label: 'HUD Compositor',
  icon: 'Monitor',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-ui'],
  description: 'HUD compositor with z-layer management, widget placements, and context-aware visibility modes',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View HUD z-layers', 'Inspect widget placements', 'Track HUD feature implementation'],
  suggestedCompanions: ['arpg-ui-screen-flow', 'arpg-ui-menu-flow'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onLayerSelect', type: 'string', description: 'Emits selected HUD layer for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Monitor icon with widget count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Z-layer list with context mode count' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full z-layer grid, feature cards, HUD render pipeline' },
  },
  component: HudCompositorPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── ScreenFlowPanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-ui-screen-flow',
  label: 'Screen Flow',
  icon: 'ArrowRightLeft',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-ui'],
  description: 'Screen flow graph with navigation transitions, input mode state machine, and screen group categorization',
  capabilities: ['viewing', 'graph-visualization', 'pipeline-visualization'],
  useCases: ['View screen transition graph', 'Inspect input mode switches', 'Track screen feature implementation'],
  suggestedCompanions: ['arpg-ui-hud-compositor', 'arpg-ui-menu-flow'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onScreenSelect', type: 'string', description: 'Emits selected screen for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'ArrowRightLeft icon with screen count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Screen group list with transition and input mode counts' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full screen groups, flow nodes, feature cards, transition pipeline' },
  },
  component: ScreenFlowPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── SaveSchemaPanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-save-schema',
  label: 'Save Schema',
  icon: 'Database',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-save'],
  description: 'Save data schema with field groups, type mapping, and version history with migration tracking',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View schema field groups', 'Inspect version history', 'Track save feature implementation'],
  suggestedCompanions: ['arpg-save-slots', 'arpg-ui-hud-compositor'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onGroupSelect', type: 'string', description: 'Emits selected schema group for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Database icon with total field count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Schema group list with field counts and version info' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full schema groups, version timeline, feature cards, save pipeline' },
  },
  component: SaveSchemaPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── SaveSlotsPanel registration ──────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-save-slots',
  label: 'Save Slots',
  icon: 'Save',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-save'],
  description: 'Save slot manager with manual/auto slots, file size budget visualization, and compression metrics',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View save slot status', 'Inspect file size budget', 'Track save slot features'],
  suggestedCompanions: ['arpg-save-schema'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onSlotSelect', type: 'string', description: 'Emits selected save slot for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Save icon with active/total slot count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Slot list with level info and file size summary' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full slot details, file size budget bars, feature cards, save pipeline' },
  },
  component: SaveSlotsPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── MenuFlowPanel registration ───────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-ui-menu-flow',
  label: 'Menu Flow',
  icon: 'LayoutGrid',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-ui'],
  description: 'Menu flow system with screen stack management, widget animations, and accessibility audit',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View menu screen layout', 'Inspect animation transitions', 'Check accessibility grades'],
  suggestedCompanions: ['arpg-ui-hud-compositor', 'arpg-ui-screen-flow'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onMenuSelect', type: 'string', description: 'Emits selected menu screen for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'LayoutGrid icon with menu count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Menu screen list with transition and A11Y summary' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full menu screens, accessibility audit, feature cards, menu stack pipeline' },
  },
  component: MenuFlowPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EvalQualityPanel registration ───────────────────────────────────── */

pofRegistry.register({
  type: 'evaluator-quality',
  label: 'Quality Dashboard',
  icon: 'Activity',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['evaluator'],
  description: 'Aggregate quality dashboard showing 3-pass evaluation scores across all modules with trend tracking and radar visualization',
  capabilities: ['viewing', 'chart-visualization', 'audit-reporting'],
  useCases: ['View per-module quality scores', 'Track quality trends', 'Compare dimensions via radar'],
  suggestedCompanions: ['evaluator-deps', 'evaluator-insights', 'evaluator-project-health'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onModuleSelect', type: 'string', description: 'Emits selected module for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Activity icon with average quality score badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Module score list with status dots and trend arrows' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full module scores, radar chart, quality summary' },
  },
  component: EvalQualityPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EvalDepsPanel registration ──────────────────────────────────────── */

pofRegistry.register({
  type: 'evaluator-deps',
  label: 'Dependency Graph',
  icon: 'Link2',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['evaluator'],
  description: 'Cross-module dependency graph showing feature dependencies, blocker chains, and resolution status',
  capabilities: ['viewing', 'graph-visualization', 'pipeline-visualization'],
  useCases: ['View cross-module dependencies', 'Identify blocked features', 'Trace dependency resolution pipeline'],
  suggestedCompanions: ['evaluator-quality', 'evaluator-insights', 'evaluator-feature-matrix'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onDepSelect', type: 'string', description: 'Emits selected dependency for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Link2 icon with blocked count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Module dependency list with counts and blocker badges' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full dependency list, blocker summary, resolution pipeline' },
  },
  component: EvalDepsPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EvalInsightsPanel registration ──────────────────────────────────── */

pofRegistry.register({
  type: 'evaluator-insights',
  label: 'Insights',
  icon: 'Lightbulb',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['evaluator'],
  description: 'Correlated insights from quality, dependency, analytics, and scanner data prioritized by severity',
  capabilities: ['viewing', 'audit-reporting'],
  useCases: ['View prioritized insights', 'Check critical and warning alerts', 'Drill into insight sources'],
  suggestedCompanions: ['evaluator-quality', 'evaluator-deps', 'evaluator-project-health'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onInsightSelect', type: 'string', description: 'Emits selected insight for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Lightbulb icon with total insight count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Insight list with severity icons and truncated titles' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full insight cards with severity styling, descriptions, summary' },
  },
  component: EvalInsightsPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── ProjectHealthPanel registration ─────────────────────────────────── */

pofRegistry.register({
  type: 'evaluator-project-health',
  label: 'Project Health',
  icon: 'Radar',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['evaluator'],
  description: 'Project health overview aggregating completion, quality, dependency health, build stability, and review freshness',
  capabilities: ['viewing', 'chart-visualization', 'pipeline-visualization'],
  useCases: ['View overall project health score', 'Compare health dimensions', 'Trace health scan pipeline'],
  suggestedCompanions: ['evaluator-quality', 'evaluator-insights', 'evaluator-feature-matrix'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onDimensionSelect', type: 'string', description: 'Emits selected health dimension for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Radar icon with overall health percentage badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Health dimension list with percentage bars' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full dimension bars, radar chart, overall score, health scan pipeline' },
  },
  component: ProjectHealthPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── FeatureMatrixPanel registration ─────────────────────────────────── */

pofRegistry.register({
  type: 'evaluator-feature-matrix',
  label: 'Feature Matrix',
  icon: 'LayoutGrid',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['evaluator'],
  description: 'Feature matrix tracking all features across modules with status classification, quality scoring, and progress tracking',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View feature status breakdown', 'Track completion progress', 'Browse individual features'],
  suggestedCompanions: ['evaluator-quality', 'evaluator-deps', 'evaluator-project-health'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onFeatureSelect', type: 'string', description: 'Emits selected feature for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'LayoutGrid icon with completion percentage badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Status summary list with counts and total' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full status breakdown grid, progress bar, feature cards, tracking pipeline' },
  },
  component: FeatureMatrixPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EvalDeepScanPanel registration ────────────────────────────────────── */

pofRegistry.register({
  type: 'evaluator-deep-scan',
  label: 'Deep Scan',
  icon: 'ScanSearch',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['evaluator'],
  description: 'Deep 3-pass evaluation results showing structure, quality, and performance findings across all ARPG modules',
  capabilities: ['viewing', 'audit-reporting', 'pipeline-visualization'],
  useCases: ['View 3-pass evaluation scores', 'Browse recent findings by severity', 'Trace scan pipeline stages'],
  suggestedCompanions: ['evaluator-quality', 'evaluator-performance', 'evaluator-insights'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onFindingSelect', type: 'string', description: 'Emits selected finding for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'ScanSearch icon with average score badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Pass score list with progress bars and finding counts' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full pass scores with animated bars, finding cards, scan pipeline' },
  },
  component: EvalDeepScanPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EvalEconomyPanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'evaluator-economy',
  label: 'Economy Simulator',
  icon: 'Coins',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['evaluator'],
  description: 'Economy simulator tracking currency flow, item sinks, vendor balance, and UE5 C++ code generation templates',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Monitor economy health metrics', 'View code gen templates for economy subsystems', 'Trace economy simulation pipeline'],
  suggestedCompanions: ['evaluator-deep-scan', 'evaluator-pattern-library', 'evaluator-quality'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onMetricSelect', type: 'string', description: 'Emits selected economy metric for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Coins icon with healthy metric count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Economy metric list with status dots and values' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full economy metrics, code gen templates, simulation pipeline' },
  },
  component: EvalEconomyPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EvalRoadmapPanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'evaluator-roadmap',
  label: 'Roadmap',
  icon: 'Calendar',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['evaluator'],
  description: 'Calendar roadmap with weekly focus areas, progress tracking, and weekly digest summaries',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['View weekly roadmap and progress', 'Check weekly digest stats', 'Track milestone completion'],
  suggestedCompanions: ['evaluator-session-analytics', 'evaluator-quality', 'evaluator-project-health'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onWeekSelect', type: 'string', description: 'Emits selected week for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Calendar icon with active week badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Week list with status icons and progress percentages' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full weekly roadmap cards, digest KPIs, roadmap summary' },
  },
  component: EvalRoadmapPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EvalPerformancePanel registration ─────────────────────────────────── */

pofRegistry.register({
  type: 'evaluator-performance',
  label: 'Performance',
  icon: 'Gauge',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['evaluator'],
  description: 'Performance profiling dashboard with frame timing, thread budgets, memory usage, and hotspot identification',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Monitor frame timing and thread budgets', 'Identify performance hotspots', 'Trace profiling pipeline'],
  suggestedCompanions: ['evaluator-deep-scan', 'evaluator-quality', 'evaluator-insights'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onMetricSelect', type: 'string', description: 'Emits selected perf metric for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Gauge icon with ok/total metric count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Perf metric list with status dots and values' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full metric grid, hotspot list, profiling pipeline' },
  },
  component: EvalPerformancePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EvalSessionAnalyticsPanel registration ────────────────────────────── */

pofRegistry.register({
  type: 'evaluator-session-analytics',
  label: 'Session Analytics',
  icon: 'BarChart3',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['evaluator'],
  description: 'Session analytics dashboard showing CLI task history, module activity distribution, and success rates',
  capabilities: ['viewing', 'chart-visualization', 'status-tracking'],
  useCases: ['View session KPIs', 'Compare module activity distribution', 'Browse recent session history'],
  suggestedCompanions: ['evaluator-roadmap', 'evaluator-quality', 'evaluator-project-health'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onSessionSelect', type: 'string', description: 'Emits selected session for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'BarChart3 icon with total session count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Recent session list with outcome dots and durations' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full KPI grid, module activity bars, recent session list' },
  },
  component: EvalSessionAnalyticsPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── EvalPatternLibraryPanel registration ──────────────────────────────── */

pofRegistry.register({
  type: 'evaluator-pattern-library',
  label: 'Pattern Library',
  icon: 'BookOpen',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['evaluator'],
  description: 'Pattern library cataloging reusable UE5 patterns across modules with cross-module overlap detection',
  capabilities: ['viewing', 'audit-reporting'],
  useCases: ['Browse reusable patterns', 'Detect cross-module overlaps', 'View deduplication recommendations'],
  suggestedCompanions: ['evaluator-deps', 'evaluator-economy', 'evaluator-deep-scan'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onPatternSelect', type: 'string', description: 'Emits selected pattern for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'BookOpen icon with total pattern count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Pattern list with maturity dots and usage counts' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full pattern catalog, overlap cards, library summary' },
  },
  component: EvalPatternLibraryPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── MaterialPreviewPanel registration ─────────────────────────────────── */

pofRegistry.register({
  type: 'content-material-preview',
  label: 'Material Preview',
  icon: 'Paintbrush',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['content'],
  description: 'Material layer system with master material, dynamic instances, MPC, post-process chain, and Substrate shading',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['View material layer hierarchy', 'Compare material dimensions via radar', 'Track material feature implementation'],
  suggestedCompanions: ['content-model-assets', 'content-level-blockout', 'content-vfx-particles'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onLayerSelect', type: 'string', description: 'Emits selected material layer for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Paintbrush icon with layer count badge (4 layers)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Material layer list with types and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full layer cards, radar chart, feature cards, material pipeline' },
  },
  component: MaterialPreviewPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── AudioSpatialPanel registration ────────────────────────────────────── */

pofRegistry.register({
  type: 'content-audio-spatial',
  label: 'Spatial Audio',
  icon: 'Volume2',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['content'],
  description: 'Spatial audio system with attenuation, occlusion, reverb zones, MetaSounds, and dynamic music transitions',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['View audio system architecture', 'Compare audio dimensions via radar', 'Track audio feature implementation'],
  suggestedCompanions: ['content-material-preview', 'content-vfx-particles'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onSystemSelect', type: 'string', description: 'Emits selected audio system for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Volume2 icon with system count badge (5 systems)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Audio system list with roles and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full system cards, radar chart, feature cards, audio pipeline' },
  },
  component: AudioSpatialPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── ModelAssetsPanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'content-model-assets',
  label: 'Model Assets',
  icon: 'Box',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['content'],
  description: 'Asset inventory with static/skeletal mesh import, LOD generation, Nanite optimization, collision, and data registries',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Browse asset type catalog', 'Compare asset pipeline coverage via radar', 'Track model feature implementation'],
  suggestedCompanions: ['content-material-preview', 'content-level-blockout'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onAssetTypeSelect', type: 'string', description: 'Emits selected asset type for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Box icon with asset type count badge (5 types)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Asset type list with formats and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full asset type cards, radar chart, feature cards, import pipeline' },
  },
  component: ModelAssetsPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── LevelBlockoutPanel registration ───────────────────────────────────── */

pofRegistry.register({
  type: 'content-level-blockout',
  label: 'Level Blockout',
  icon: 'Layers',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['content'],
  description: 'Level design pipeline with blockout geometry, spawn placement, world partition streaming, NavMesh, and PCG generation',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View level production phases', 'Track level design features', 'Trace level build pipeline'],
  suggestedCompanions: ['content-model-assets', 'content-material-preview', 'content-vfx-particles'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onPhaseSelect', type: 'string', description: 'Emits selected level phase for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Layers icon with phase count badge (5 phases)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Level phase list with stages and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full phase cards, radar chart, feature cards, level build pipeline' },
  },
  component: LevelBlockoutPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── VfxParticlesPanel registration ────────────────────────────────────── */

pofRegistry.register({
  type: 'content-vfx-particles',
  label: 'VFX Particles',
  icon: 'Sparkles',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['content'],
  description: 'Niagara VFX system with GPU particle simulation, mesh emitters, ribbon trails, event handlers, and scalability LOD',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Browse VFX categories', 'Compare VFX dimensions via radar', 'Track particle system implementation'],
  suggestedCompanions: ['content-material-preview', 'content-audio-spatial'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onCategorySelect', type: 'string', description: 'Emits selected VFX category for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Sparkles icon with category count badge (5 types)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'VFX category list with roles and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full category cards, radar chart, feature cards, VFX render pipeline' },
  },
  component: VfxParticlesPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── DirectorOverviewPanel registration ──────────────────────────────── */

pofRegistry.register({
  type: 'game-director-overview',
  label: 'Director Overview',
  icon: 'Gamepad2',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['game-director'],
  description: 'Game Director session list with playtest history, health scores, aggregate stats, and session status tracking',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['View playtest session history', 'Check aggregate health scores', 'Monitor session status'],
  suggestedCompanions: ['game-director-findings', 'game-director-session', 'game-director-regression'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onSessionSelect', type: 'string', description: 'Emits selected session ID for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Gamepad2 icon with session count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Recent sessions list with scores and status' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full stats grid, session list with score rings, health overview' },
  },
  component: DirectorOverviewPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── DirectorFindingsPanel registration ──────────────────────────────── */

pofRegistry.register({
  type: 'game-director-findings',
  label: 'Findings Explorer',
  icon: 'Target',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['game-director'],
  description: 'Findings explorer showing all discovered issues across playtest sessions grouped by severity and category',
  capabilities: ['viewing', 'status-tracking', 'audit-reporting'],
  useCases: ['Browse findings by severity', 'Filter by category', 'View finding details and confidence'],
  suggestedCompanions: ['game-director-overview', 'game-director-session', 'game-director-regression'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onFindingSelect', type: 'string', description: 'Emits selected finding ID for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Target icon with total findings count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Severity breakdown list with counts' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full severity grid, recent findings list with category and confidence' },
  },
  component: DirectorFindingsPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── DirectorRegressionPanel registration ────────────────────────────── */

pofRegistry.register({
  type: 'game-director-regression',
  label: 'Regression Tracker',
  icon: 'Bug',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['game-director'],
  description: 'Regression tracker monitoring bug recurrence across playtest sessions with trend analysis and chronic issue identification',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Monitor regression rate', 'Identify chronic regressions', 'Track issue fix/regress lifecycle'],
  suggestedCompanions: ['game-director-findings', 'game-director-overview', 'game-director-session'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onIssueSelect', type: 'string', description: 'Emits selected issue fingerprint ID for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Bug icon with regressed count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Regression rate, tracked/open/fixed/regressed counts' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full stats grid, regression rate bar, chronic issues list' },
  },
  component: DirectorRegressionPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── DirectorSessionPanel registration ───────────────────────────────── */

pofRegistry.register({
  type: 'game-director-session',
  label: 'Session Detail',
  icon: 'Clapperboard',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['game-director'],
  description: 'Session detail view with findings list, event timeline, test coverage bars, and score visualization',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View session score and stats', 'Browse session findings', 'Trace event timeline', 'Check test coverage'],
  suggestedCompanions: ['game-director-overview', 'game-director-findings', 'game-director-regression'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onFindingSelect', type: 'string', description: 'Emits selected finding ID for cross-panel drill-down' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Clapperboard icon with session score badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Session name, score, findings/systems/playtime stats' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full session header with score ring, findings list, event timeline, coverage bars' },
  },
  component: DirectorSessionPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── Game Systems Panels ───────────────────────────────────────────────── */

/* ── AISandboxPanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'game-systems-ai-sandbox',
  label: 'AI Sandbox',
  icon: 'Brain',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['game-systems'],
  description: 'AI behavior testing sandbox with behavior tree visualization and test suite execution dashboard',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Visualize behavior tree execution', 'Run AI test suites', 'Monitor BT node status'],
  suggestedCompanions: ['game-systems-physics', 'game-systems-multiplayer', 'game-systems-input'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onNodeSelect', type: 'string', description: 'Emits selected BT node name for cross-panel inspection' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Brain icon with test pass/total badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Test suite list with pass/fail counts' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full BT visualizer, test suite cards with scenario breakdowns' },
  },
  component: AISandboxPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── PhysicsSystemPanel registration ─────────────────────────────────── */

pofRegistry.register({
  type: 'game-systems-physics',
  label: 'Physics System',
  icon: 'Zap',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['game-systems'],
  description: 'Physics collision profile editor and projectile system configuration for UE5 trace channels',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['Configure collision profiles', 'View projectile parameters', 'Check trace channel responses'],
  suggestedCompanions: ['game-systems-ai-sandbox', 'game-systems-multiplayer', 'game-systems-input'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onProfileSelect', type: 'string', description: 'Emits selected collision profile name for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Zap icon with profile count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Collision profile list with channel names' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full collision response matrix, projectile config cards' },
  },
  component: PhysicsSystemPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── MultiplayerSystemPanel registration ─────────────────────────────── */

pofRegistry.register({
  type: 'game-systems-multiplayer',
  label: 'Multiplayer System',
  icon: 'Wifi',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['game-systems'],
  description: 'UE5 replication dashboard with replicated properties, RPC monitoring, and bandwidth visualization',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Monitor replicated properties', 'Track RPC call frequency', 'Review bandwidth usage'],
  suggestedCompanions: ['game-systems-ai-sandbox', 'game-systems-physics', 'game-systems-input'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onRPCSelect', type: 'string', description: 'Emits selected RPC name for cross-panel drill-down' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Wifi icon with RPC count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'RPC list with type badges' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full replicated props table, RPC dashboard with bandwidth bars' },
  },
  component: MultiplayerSystemPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── InputSystemPanel registration ───────────────────────────────────── */

pofRegistry.register({
  type: 'game-systems-input',
  label: 'Input System',
  icon: 'Keyboard',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['game-systems'],
  description: 'Enhanced Input System configuration with input actions, mapping contexts, keyboard and gamepad bindings',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['View input action bindings', 'Check mapping context priorities', 'Compare keyboard vs gamepad'],
  suggestedCompanions: ['game-systems-ai-sandbox', 'game-systems-physics', 'game-systems-save-load'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onActionSelect', type: 'string', description: 'Emits selected input action name for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Keyboard icon with binding count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Input action list with key bindings' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full mapping contexts grid, key bindings table with gamepad mappings' },
  },
  component: InputSystemPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── SaveLoadSystemPanel registration ────────────────────────────────── */

pofRegistry.register({
  type: 'game-systems-save-load',
  label: 'Save/Load System',
  icon: 'Save',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['game-systems'],
  description: 'Save/Load system with slot management, auto-save configuration, and serialization subsystem status',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['Manage save slots', 'Configure auto-save settings', 'Check serialization subsystem status'],
  suggestedCompanions: ['game-systems-build-pipeline', 'game-systems-input', 'game-systems-ai-sandbox'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onSlotSelect', type: 'string', description: 'Emits selected save slot name for cross-panel inspection' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Save icon with slot count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Save slot list with level names and auto-save interval' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full auto-save config, save slot details, serialization subsystem status' },
  },
  component: SaveLoadSystemPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── BuildPipelinePanel registration ─────────────────────────────────── */

pofRegistry.register({
  type: 'game-systems-build-pipeline',
  label: 'Build Pipeline',
  icon: 'Package',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['game-systems'],
  description: 'Build pipeline dashboard with build history, cook settings, and platform profile management',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['View build history', 'Configure cook settings', 'Manage platform profiles'],
  suggestedCompanions: ['game-systems-save-load', 'game-systems-multiplayer', 'game-systems-physics'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onBuildSelect', type: 'string', description: 'Emits selected build ID for cross-panel drill-down' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Package icon with build pass/total badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Build history list with status and platform' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full build history, cook settings grid, platform profile cards' },
  },
  component: BuildPipelinePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── Project Setup Panels ──────────────────────────────────────────────── */

/* ── SetupWizardPanel registration ───────────────────────────────────── */

pofRegistry.register({
  type: 'project-setup-wizard',
  label: 'Setup Wizard',
  icon: 'Rocket',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['project-setup'],
  description: 'Project creation wizard with engine selection, project location, module config, feature selection, and scaffolding steps',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['Walk through project setup steps', 'Select engine version and modules', 'View recent projects'],
  suggestedCompanions: ['project-setup-status', 'project-setup-ue5-remote', 'project-setup-blueprint-inspector'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onStepSelect', type: 'string', description: 'Emits selected wizard step ID for cross-panel navigation' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Rocket icon with step progress badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Wizard steps list with status indicators' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full wizard steps with descriptions, recent projects list' },
  },
  component: SetupWizardPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── SetupStatusPanel registration ───────────────────────────────────── */

pofRegistry.register({
  type: 'project-setup-status',
  label: 'Setup Status',
  icon: 'ClipboardCheck',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['project-setup'],
  description: 'Environment status checklist and build verification — confirms toolchain, SDK, and project structure readiness',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['Check environment readiness', 'Verify toolchain installation', 'Run build verification steps'],
  suggestedCompanions: ['project-setup-wizard', 'project-setup-ue5-remote', 'project-setup-test-harness'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onItemSelect', type: 'string', description: 'Emits selected checklist item ID for cross-panel drill-down' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'ClipboardCheck icon with ok/total badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Checklist items with pass/fail indicators' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full environment checklist with details, build verification steps' },
  },
  component: SetupStatusPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── UE5RemotePanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'project-setup-ue5-remote',
  label: 'UE5 Remote',
  icon: 'Radio',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['project-setup'],
  description: 'UE5 remote controller with endpoint health monitoring, live coding log, and connection diagnostics',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Monitor remote endpoints', 'Track live coding patches', 'Diagnose connection issues'],
  suggestedCompanions: ['project-setup-wizard', 'project-setup-status', 'project-setup-blueprint-inspector'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onEndpointSelect', type: 'string', description: 'Emits selected endpoint name for cross-panel inspection' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Radio icon with connected/total badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Endpoint list with status and latency' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full endpoint grid, live coding log with timestamps' },
  },
  component: UE5RemotePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── BlueprintInspectorPanel registration ─────────────────────────────── */

pofRegistry.register({
  type: 'project-setup-blueprint-inspector',
  label: 'Blueprint Inspector',
  icon: 'FileCode',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['project-setup'],
  description: 'Blueprint parsing and asset inspection — view inheritance, components, variables, and event graph entry points',
  capabilities: ['viewing', 'hierarchy-visualization'],
  useCases: ['Parse and inspect blueprints', 'View inheritance hierarchy', 'Browse asset tree'],
  suggestedCompanions: ['project-setup-ue5-remote', 'project-setup-test-harness', 'project-setup-status'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onBlueprintSelect', type: 'string', description: 'Emits selected blueprint name for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'FileCode icon with blueprint count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Blueprint list with component/variable counts' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full blueprint cards with inheritance, asset tree with sizes' },
  },
  component: BlueprintInspectorPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── TestHarnessDzinPanel registration ────────────────────────────────── */

pofRegistry.register({
  type: 'project-setup-test-harness',
  label: 'Test Harness',
  icon: 'FlaskConical',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['project-setup'],
  description: 'Test spec editor and suite runner — create scenarios with spawn/assert/capture actions and track pass/fail results',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['Create and edit test specs', 'Run test suites', 'Track test results and assertions'],
  suggestedCompanions: ['project-setup-status', 'project-setup-blueprint-inspector', 'project-setup-ue5-remote'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onSpecSelect', type: 'string', description: 'Emits selected test spec name for cross-panel drill-down' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'FlaskConical icon with pass/total badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Test spec list with status and duration' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full suite summary stats, test spec cards with action/assertion counts' },
  },
  component: TestHarnessDzinPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── Visual Gen Panels ─────────────────────────────────────────────────── */

/* ── AssetBrowserPanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'visual-gen-asset-browser',
  label: 'Asset Browser',
  icon: 'FolderSearch',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['visual-gen'],
  description: 'Asset browser with category filtering, tag-based search, and recent asset history for the content pipeline',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['Browse assets by category', 'Filter by tags', 'View recent asset history'],
  suggestedCompanions: ['visual-gen-asset-forge', 'visual-gen-asset-viewer-3d', 'visual-gen-material-lab-pbr'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onAssetSelect', type: 'string', description: 'Emits selected asset name for cross-panel inspection' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'FolderSearch icon with total asset count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Asset category list with counts and tag summary' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full category grid, filter tags, recent assets list' },
  },
  component: AssetBrowserPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── AssetForgePanel registration ───────────────────────────────────────── */

pofRegistry.register({
  type: 'visual-gen-asset-forge',
  label: 'Asset Forge',
  icon: 'Wand2',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['visual-gen'],
  description: 'AI asset generation queue with prompt-to-asset pipeline, model profiles, and generation history tracking',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Monitor generation queue', 'View model profiles and quotas', 'Track generation history'],
  suggestedCompanions: ['visual-gen-asset-browser', 'visual-gen-asset-viewer-3d', 'visual-gen-material-lab-pbr'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onGenerationSelect', type: 'string', description: 'Emits selected generation ID for cross-panel inspection' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Wand2 icon with running/queued count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Generation queue list with status and model names' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full generation queue with prompts, model profile cards' },
  },
  component: AssetForgePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── AssetViewer3DPanel registration ────────────────────────────────────── */

pofRegistry.register({
  type: 'visual-gen-asset-viewer-3d',
  label: '3D Viewer',
  icon: 'Box',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['visual-gen'],
  description: '3D scene viewer with viewport modes, camera presets, scene hierarchy, and mesh statistics',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['Switch viewport rendering modes', 'Use camera presets', 'Inspect scene hierarchy and triangle counts'],
  suggestedCompanions: ['visual-gen-asset-browser', 'visual-gen-material-lab-pbr', 'visual-gen-scene-composer'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onObjectSelect', type: 'string', description: 'Emits selected scene object name for cross-panel inspection' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Box icon with scene object count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Scene object list with triangle counts and mode count' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full viewport modes, scene hierarchy, camera presets, lighting config' },
  },
  component: AssetViewer3DPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── MaterialLabPBRPanel registration ───────────────────────────────────── */

pofRegistry.register({
  type: 'visual-gen-material-lab-pbr',
  label: 'Material Lab PBR',
  icon: 'Palette',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['visual-gen'],
  description: 'PBR material editor with texture channel management, shader model selection, and parameter tuning',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['Edit PBR texture channels', 'Select shader models', 'Tune material parameters'],
  suggestedCompanions: ['visual-gen-asset-viewer-3d', 'visual-gen-asset-browser', 'visual-gen-blender-pipeline'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onChannelSelect', type: 'string', description: 'Emits selected PBR channel name for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Palette icon with PBR channel count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'PBR channel list with resolutions and shader count' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full PBR channels, shader model cards, material parameter grid' },
  },
  component: MaterialLabPBRPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── BlenderPipelinePanel registration ──────────────────────────────────── */

pofRegistry.register({
  type: 'visual-gen-blender-pipeline',
  label: 'Blender Pipeline',
  icon: 'Hexagon',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['visual-gen'],
  description: 'Blender integration pipeline with MCP connection, script management, and automated export-to-UE5 workflow',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Monitor Blender MCP connection', 'Run pipeline scripts', 'Track export-to-UE5 workflow'],
  suggestedCompanions: ['visual-gen-asset-browser', 'visual-gen-scene-composer', 'visual-gen-material-lab-pbr'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onScriptSelect', type: 'string', description: 'Emits selected script name for cross-panel inspection' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Hexagon icon with active/total script count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Script list with status and connection indicator' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full connection status, pipeline scripts, workflow steps' },
  },
  component: BlenderPipelinePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── SceneComposerPanel registration ────────────────────────────────────── */

pofRegistry.register({
  type: 'visual-gen-scene-composer',
  label: 'Scene Composer',
  icon: 'Clapperboard',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['visual-gen'],
  description: 'Scene composer with hierarchical scene tree, composition layers, and multi-format export configuration',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Navigate scene tree hierarchy', 'Manage composition layers', 'Configure export formats'],
  suggestedCompanions: ['visual-gen-asset-viewer-3d', 'visual-gen-blender-pipeline', 'visual-gen-asset-browser'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onNodeSelect', type: 'string', description: 'Emits selected scene node for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Clapperboard icon with node count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Scene tree with depth indentation and format count' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full scene tree, composition layers, export format cards' },
  },
  component: SceneComposerPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── AnimChoreographerPanel registration ──────────────────────────────── */

pofRegistry.register({
  type: 'content-anim-choreographer',
  label: 'Anim Choreographer',
  icon: 'Swords',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['content'],
  description: 'AI combo choreographer with chain graphs, state machine editor, cancel windows, and hit-confirm branching',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Design combo chain graphs', 'Tune cancel windows', 'Visualize choreography dimensions via radar'],
  suggestedCompanions: ['content-audio-event-catalog', 'content-ui-damage-numbers', 'content-material-preview'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onChainSelect', type: 'string', description: 'Emits selected combo chain for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Swords icon with chain count badge (5 chains)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Combo chain list with step counts and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full chain cards, radar chart, feature cards, combo execution pipeline' },
  },
  component: AnimChoreographerPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── AudioEventCatalogPanel registration ──────────────────────────────── */

pofRegistry.register({
  type: 'content-audio-event-catalog',
  label: 'Audio Event Catalog',
  icon: 'Radio',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['content'],
  description: 'Audio event catalog with categorized events, priority pooling, bus routing, and streaming bank management',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Browse audio events by category', 'Compare audio dimensions via radar', 'Track audio event features'],
  suggestedCompanions: ['content-audio-spatial', 'content-anim-choreographer', 'content-vfx-particles'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onEventSelect', type: 'string', description: 'Emits selected audio event category for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Radio icon with total event count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Event category list with counts and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full event cards, radar chart, feature cards, event pipeline' },
  },
  component: AudioEventCatalogPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── LevelFlowEditorPanel registration ────────────────────────────────── */

pofRegistry.register({
  type: 'content-level-flow-editor',
  label: 'Level Flow Editor',
  icon: 'Map',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['content'],
  description: 'Level flow editor with zone graph, difficulty arc visualization, streaming zone config, and world partition integration',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Design level flow graphs', 'Tune difficulty arcs', 'Configure streaming zones'],
  suggestedCompanions: ['content-level-blockout', 'content-material-patterns', 'content-anim-choreographer'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onZoneSelect', type: 'string', description: 'Emits selected level zone for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Map icon with zone count badge (5 zones)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Zone list with difficulty tags and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full zone cards, radar chart, feature cards, level flow pipeline' },
  },
  component: LevelFlowEditorPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── MaterialPatternsPanel registration ───────────────────────────────── */

pofRegistry.register({
  type: 'content-material-patterns',
  label: 'Material Patterns',
  icon: 'Palette',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['content'],
  description: 'Material pattern catalog with style transfer, procedural generation, tileability validation, and variant management',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Browse material pattern catalog', 'Compare pattern dimensions via radar', 'Track pattern feature implementation'],
  suggestedCompanions: ['content-material-preview', 'content-level-flow-editor', 'content-model-assets'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onPatternSelect', type: 'string', description: 'Emits selected material pattern for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Palette icon with pattern count badge (5 patterns)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Pattern list with variant counts and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full pattern cards, radar chart, feature cards, creation pipeline' },
  },
  component: MaterialPatternsPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── UIDamageNumbersPanel registration ────────────────────────────────── */

pofRegistry.register({
  type: 'content-ui-damage-numbers',
  label: 'Damage Numbers',
  icon: 'Hash',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['content'],
  description: 'Damage number system with type palette, physics simulation presets, widget pooling, and animation curves',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Configure damage number types', 'Compare number system dimensions via radar', 'Track damage UI features'],
  suggestedCompanions: ['content-ui-health-bars', 'content-anim-choreographer', 'content-vfx-particles'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onTypeSelect', type: 'string', description: 'Emits selected damage type for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Hash icon with damage type count badge (5 types)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Damage type list with styles and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full type cards, radar chart, feature cards, damage number pipeline' },
  },
  component: UIDamageNumbersPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── UIHealthBarsPanel registration ───────────────────────────────────── */

pofRegistry.register({
  type: 'content-ui-health-bars',
  label: 'Health Bars',
  icon: 'Heart',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['content'],
  description: 'Health bar FSM with state transitions, delayed damage drain, low health pulse, shield overlays, and boss segmentation',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Configure health bar states', 'Compare health bar dimensions via radar', 'Track health UI features'],
  suggestedCompanions: ['content-ui-damage-numbers', 'content-anim-choreographer', 'content-audio-event-catalog'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onStateSelect', type: 'string', description: 'Emits selected health state for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Heart icon with state count badge (5 states)' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Health state list with thresholds and pipeline note' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full state cards, radar chart, feature cards, health bar pipeline' },
  },
  component: UIHealthBarsPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── ARPG Tools ─────────────────────────────────────────────────────────── */

/* ── AbilityForgePanel registration ──────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-tools-ability-forge',
  label: 'Ability Forge',
  icon: 'Wand2',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-tools'],
  description: 'Ability generation from text descriptions with template catalog, tag taxonomy, and cost/cooldown tuning',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Generate abilities from text prompts', 'Browse ability template catalog', 'Tune ability cost and cooldown parameters'],
  suggestedCompanions: ['arpg-tools-gas-blueprint', 'arpg-tools-combo-chain', 'arpg-combat-abilities'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onAbilitySelect', type: 'string', description: 'Emits selected ability template for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Wand2 icon with ability template count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Ability template list with tags and costs' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full template cards, generation pipeline, tag taxonomy' },
  },
  component: AbilityForgePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── CombatChoreographyPanel registration ────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-tools-combat-choreography',
  label: 'Combat Choreography',
  icon: 'Swords',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-tools'],
  description: 'Choreography editor with spatial grid, timeline phases, and actor assignments for combat sequences',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['Design combat choreography sequences', 'Assign actors to spatial zones', 'View timeline phase breakdown'],
  suggestedCompanions: ['arpg-tools-combo-chain', 'arpg-tools-dodge-timeline', 'arpg-tools-damage-pipeline'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onSequenceSelect', type: 'string', description: 'Emits selected choreography sequence for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Swords icon with sequence count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Sequence list with phase counts and actor tallies' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full timeline phases, spatial zone grid, actor assignments' },
  },
  component: CombatChoreographyPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── ComboChainPanel registration ────────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-tools-combo-chain',
  label: 'Combo Chain',
  icon: 'Link',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-tools'],
  description: 'Combo builder with move sequences, frame data, cancel windows, and cooldown overlap visualization',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Build combo chains from moves', 'Inspect frame data and cancel windows', 'Visualize cooldown overlap'],
  suggestedCompanions: ['arpg-tools-combat-choreography', 'arpg-tools-dodge-timeline', 'arpg-tools-damage-pipeline'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onChainSelect', type: 'string', description: 'Emits selected combo chain for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Link icon with combo chain count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Chain list with move counts and frame data' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full chain detail with frame bars, cancel windows, cooldown overlap' },
  },
  component: ComboChainPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── DamagePipelinePanel registration ────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-tools-damage-pipeline',
  label: 'Damage Pipeline',
  icon: 'Zap',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-tools'],
  description: 'Damage flow diagram with pipeline stages (raw → mitigation → resistance → final) and execution breakdown',
  capabilities: ['viewing', 'pipeline-visualization', 'chart-visualization'],
  useCases: ['Trace damage pipeline stages', 'Inspect multiplier breakdowns', 'View execution flow diagram'],
  suggestedCompanions: ['arpg-tools-combat-choreography', 'arpg-combat-damage-calc', 'arpg-tools-combo-chain'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onStageSelect', type: 'string', description: 'Emits selected pipeline stage for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Zap icon with pipeline stage count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Pipeline stage list with multipliers' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full stage flow cards, multiplier breakdown, execution pipeline' },
  },
  component: DamagePipelinePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── DebugDashboardPanel registration ────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-tools-debug-dashboard',
  label: 'Debug Dashboard',
  icon: 'Activity',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-tools'],
  description: 'Performance debug dashboard with FPS, memory, draw calls, network latency, and triangle count monitoring',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Monitor runtime performance metrics', 'Inspect memory breakdown', 'Track network and draw call stats'],
  suggestedCompanions: ['arpg-tools-gas-blueprint', 'arpg-tools-genome-editor'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onMetricSelect', type: 'string', description: 'Emits selected metric for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Activity icon with FPS value badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Metric list with status indicators and values' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full metric gauge cards, memory breakdown, network telemetry' },
  },
  component: DebugDashboardPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── DodgeTimelinePanel registration ─────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-tools-dodge-timeline',
  label: 'Dodge Timeline',
  icon: 'Shield',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-tools'],
  description: 'Dodge chain timeline with i-frame windows, recovery phases, cancel points, and hit marker visualization',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Inspect dodge i-frame windows', 'View recovery and cancel timings', 'Overlay hit marker data'],
  suggestedCompanions: ['arpg-tools-combo-chain', 'arpg-tools-combat-choreography', 'arpg-tools-damage-pipeline'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onDodgeSelect', type: 'string', description: 'Emits selected dodge move for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Shield icon with dodge move count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Dodge move list with frame ranges' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full timeline bars with i-frame windows, recovery, hit markers' },
  },
  component: DodgeTimelinePanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── GenomeEditorPanel registration ──────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-tools-genome-editor',
  label: 'Genome Editor',
  icon: 'Dna',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-tools'],
  description: 'Character genome editor with trait definitions, power curves, growth rates, and live simulation controls',
  capabilities: ['viewing', 'status-tracking', 'chart-visualization'],
  useCases: ['Define character genome traits', 'View power curve projections', 'Run live trait simulations'],
  suggestedCompanions: ['arpg-tools-debug-dashboard', 'arpg-tools-gas-blueprint', 'arpg-combat-attributes'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onTraitSelect', type: 'string', description: 'Emits selected genome trait for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'Dna icon with trait count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Trait list with base values and growth bars' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full trait cards, power curves, simulation controls' },
  },
  component: GenomeEditorPanel as unknown as ComponentType<Record<string, unknown>>,
});

/* ── GasBlueprintPanel registration ──────────────────────────────────────── */

pofRegistry.register({
  type: 'arpg-tools-gas-blueprint',
  label: 'GAS Blueprint',
  icon: 'GitBranch',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'high',
  domains: ['arpg-tools'],
  description: 'GAS blueprint editor with node graph, wiring connections, and simulation status for abilities, effects, attributes, and cues',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: ['View GAS node graph layout', 'Inspect wiring connections between nodes', 'Run blueprint simulation'],
  suggestedCompanions: ['arpg-tools-ability-forge', 'arpg-tools-damage-pipeline', 'arpg-combat-core'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map<string, FeatureRow> mapping feature names to their status data', required: true },
    { name: 'defs', type: 'object', description: 'Array of feature definitions with featureName, description, and optional dependsOn', required: true },
  ],
  outputs: [{ name: 'onNodeSelect', type: 'string', description: 'Emits selected GAS node for cross-panel filtering' }],
  densityModes: {
    micro: { ...DENSITY_CONFIG.standard.micro, description: 'GitBranch icon with GAS node count badge' },
    compact: { ...DENSITY_CONFIG.standard.compact, description: 'Node type list with connection counts' },
    full: { ...DENSITY_CONFIG.standard.full, description: 'Full node cards, wiring graph, simulation status' },
  },
  component: GasBlueprintPanel as unknown as ComponentType<Record<string, unknown>>,
});
