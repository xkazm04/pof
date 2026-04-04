import type { LayoutTemplateId, PanelDirective } from '@/lib/dzin/core/layout/types';

/**
 * A named composition preset — a saved layout + panel combination
 * that users can recall instantly.
 */
export interface CompositionPreset {
  /** Unique preset identifier. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Description of the preset's purpose. */
  description: string;
  /** Layout template to use. */
  templateId: LayoutTemplateId;
  /** Panel directives to place in the layout's slots. */
  directives: PanelDirective[];
}

/**
 * Built-in composition presets for the ARPG Combat module.
 */
export const COMPOSITION_PRESETS: CompositionPreset[] = [
  /* ── Combat ─────────────────────────────────────────────────────────── */
  {
    id: 'ability-overview',
    label: 'Ability Overview',
    description: 'Side-by-side view of core GAS setup and ability definitions',
    templateId: 'split-2',
    directives: [
      { type: 'arpg-combat-core' },
      { type: 'arpg-combat-abilities' },
    ],
  },
  {
    id: 'combat-debug',
    label: 'Combat Debug',
    description: 'Four-panel debug view for combat tuning and effect inspection',
    templateId: 'grid-4',
    directives: [
      { type: 'arpg-combat-core' },
      { type: 'arpg-combat-effects' },
      { type: 'arpg-combat-damage-calc' },
      { type: 'arpg-combat-effect-timeline' },
    ],
  },
  {
    id: 'full-spellbook',
    label: 'Full Spellbook',
    description: 'Studio layout with tags, core, attributes, and abilities for comprehensive ability authoring',
    templateId: 'studio',
    directives: [
      { type: 'arpg-combat-tags' },
      { type: 'arpg-combat-core' },
      { type: 'arpg-combat-attributes' },
      { type: 'arpg-combat-abilities' },
    ],
  },
  {
    id: 'tag-inspector',
    label: 'Tag Inspector',
    description: 'Deep-dive into gameplay tag hierarchy, dependencies, and audit results',
    templateId: 'split-3',
    directives: [
      { type: 'arpg-combat-tags' },
      { type: 'arpg-combat-tag-deps' },
      { type: 'arpg-combat-tag-audit' },
    ],
  },
  /* ── Character ──────────────────────────────────────────────────────── */
  {
    id: 'character-debug',
    label: 'Character Debug',
    description: 'Four-panel character inspection: overview, movement, input, and state machine',
    templateId: 'grid-4',
    directives: [
      { type: 'arpg-character-overview' },
      { type: 'arpg-character-movement' },
      { type: 'arpg-character-input' },
      { type: 'arpg-animation-state-machine' },
    ],
  },
  {
    id: 'animation-suite',
    label: 'Animation Suite',
    description: 'Studio layout for animation authoring: state machine, montages, blend spaces, and input mapping',
    templateId: 'studio',
    directives: [
      { type: 'arpg-animation-state-machine' },
      { type: 'arpg-animation-montages' },
      { type: 'arpg-animation-blend-space' },
      { type: 'arpg-character-input' },
    ],
  },
  /* ── Loot & Inventory ───────────────────────────────────────────────── */
  {
    id: 'loot-analysis',
    label: 'Loot Analysis',
    description: 'Four-panel loot system view: tables, affixes, economy balance, and item DNA',
    templateId: 'grid-4',
    directives: [
      { type: 'arpg-loot-table' },
      { type: 'arpg-loot-affix' },
      { type: 'arpg-item-economy' },
      { type: 'arpg-item-dna' },
    ],
  },
  {
    id: 'inventory-overview',
    label: 'Inventory Overview',
    description: 'Side-by-side inventory catalog and equipment loadout',
    templateId: 'split-2',
    directives: [
      { type: 'arpg-inventory-catalog' },
      { type: 'arpg-inventory-equipment' },
    ],
  },
  /* ── Enemies & World ────────────────────────────────────────────────── */
  {
    id: 'world-overview',
    label: 'World Overview',
    description: 'Four-panel world design view: zone map, encounters, level design, and progression',
    templateId: 'grid-4',
    directives: [
      { type: 'arpg-world-zone-map' },
      { type: 'arpg-world-encounters' },
      { type: 'arpg-world-level-design' },
      { type: 'arpg-progression-curves' },
    ],
  },
  {
    id: 'enemy-inspector',
    label: 'Enemy Inspector',
    description: 'Side-by-side enemy bestiary and AI behavior tree',
    templateId: 'split-2',
    directives: [
      { type: 'arpg-enemy-bestiary' },
      { type: 'arpg-enemy-ai-tree' },
    ],
  },
  /* ── UI & Save ──────────────────────────────────────────────────────── */
  {
    id: 'ui-flow',
    label: 'UI Flow',
    description: 'HUD compositor, screen flow, and menu navigation in one view',
    templateId: 'split-3',
    directives: [
      { type: 'arpg-ui-hud-compositor' },
      { type: 'arpg-ui-screen-flow' },
      { type: 'arpg-ui-menu-flow' },
    ],
  },
  {
    id: 'save-inspector',
    label: 'Save Inspector',
    description: 'Side-by-side save schema definition and slot management',
    templateId: 'split-2',
    directives: [
      { type: 'arpg-save-schema' },
      { type: 'arpg-save-slots' },
    ],
  },
  /* ── Evaluator ──────────────────────────────────────────────────────── */
  {
    id: 'full-evaluator',
    label: 'Full Evaluator',
    description: 'Studio layout with quality scores, dependencies, insights, and project health',
    templateId: 'studio',
    directives: [
      { type: 'evaluator-quality' },
      { type: 'evaluator-deps' },
      { type: 'evaluator-insights' },
      { type: 'evaluator-project-health' },
    ],
  },
  {
    id: 'quality-dashboard',
    label: 'Quality Dashboard',
    description: 'Side-by-side quality scores and feature matrix for quick project assessment',
    templateId: 'split-2',
    directives: [
      { type: 'evaluator-quality' },
      { type: 'evaluator-feature-matrix' },
    ],
  },
  {
    id: 'evaluator-deep-analysis',
    label: 'Deep Analysis',
    description: 'Four-panel deep evaluation: scan results, performance profiling, economy, and pattern library',
    templateId: 'grid-4',
    directives: [
      { type: 'evaluator-deep-scan' },
      { type: 'evaluator-performance' },
      { type: 'evaluator-economy' },
      { type: 'evaluator-pattern-library' },
    ],
  },
  {
    id: 'evaluator-planning',
    label: 'Evaluator Planning',
    description: 'Side-by-side roadmap and session analytics for project planning',
    templateId: 'split-2',
    directives: [
      { type: 'evaluator-roadmap' },
      { type: 'evaluator-session-analytics' },
    ],
  },
  {
    id: 'evaluator-full-studio',
    label: 'Evaluator Full Studio',
    description: 'Studio layout with deep scan, performance, session analytics, and pattern library',
    templateId: 'studio',
    directives: [
      { type: 'evaluator-deep-scan' },
      { type: 'evaluator-performance' },
      { type: 'evaluator-session-analytics' },
      { type: 'evaluator-pattern-library' },
    ],
  },
  /* ── Game Director ──────────────────────────────────────────────────── */
  {
    id: 'director-dashboard',
    label: 'Director Dashboard',
    description: 'Full game director view: overview, findings, regression tracking, and session detail',
    templateId: 'grid-4',
    directives: [
      { type: 'game-director-overview' },
      { type: 'game-director-findings' },
      { type: 'game-director-regression' },
      { type: 'game-director-session' },
    ],
  },
  {
    id: 'director-triage',
    label: 'Director Triage',
    description: 'Side-by-side findings and regression tracker for issue triage',
    templateId: 'split-2',
    directives: [
      { type: 'game-director-findings' },
      { type: 'game-director-regression' },
    ],
  },
  /* ── Game Systems ────────────────────────────────────────────────────── */
  {
    id: 'systems-overview',
    label: 'Systems Overview',
    description: 'Four-panel game systems view: AI sandbox, physics, multiplayer, and input',
    templateId: 'grid-4',
    directives: [
      { type: 'game-systems-ai-sandbox' },
      { type: 'game-systems-physics' },
      { type: 'game-systems-multiplayer' },
      { type: 'game-systems-input' },
    ],
  },
  {
    id: 'systems-infrastructure',
    label: 'Systems Infrastructure',
    description: 'Side-by-side save/load and build pipeline for infrastructure review',
    templateId: 'split-2',
    directives: [
      { type: 'game-systems-save-load' },
      { type: 'game-systems-build-pipeline' },
    ],
  },
  {
    id: 'systems-full-studio',
    label: 'Systems Studio',
    description: 'Studio layout with AI, physics, input, and build pipeline for comprehensive systems authoring',
    templateId: 'studio',
    directives: [
      { type: 'game-systems-ai-sandbox' },
      { type: 'game-systems-physics' },
      { type: 'game-systems-input' },
      { type: 'game-systems-build-pipeline' },
    ],
  },
  /* ── Project Setup ───────────────────────────────────────────────────── */
  {
    id: 'setup-overview',
    label: 'Setup Overview',
    description: 'Four-panel project setup view: wizard, status, remote, and blueprint inspector',
    templateId: 'grid-4',
    directives: [
      { type: 'project-setup-wizard' },
      { type: 'project-setup-status' },
      { type: 'project-setup-ue5-remote' },
      { type: 'project-setup-blueprint-inspector' },
    ],
  },
  {
    id: 'setup-devtools',
    label: 'Setup Dev Tools',
    description: 'Side-by-side UE5 remote controller and test harness for development workflow',
    templateId: 'split-2',
    directives: [
      { type: 'project-setup-ue5-remote' },
      { type: 'project-setup-test-harness' },
    ],
  },
  {
    id: 'setup-full-studio',
    label: 'Setup Studio',
    description: 'Studio layout with wizard, status, blueprint inspector, and test harness for comprehensive project setup',
    templateId: 'studio',
    directives: [
      { type: 'project-setup-wizard' },
      { type: 'project-setup-status' },
      { type: 'project-setup-blueprint-inspector' },
      { type: 'project-setup-test-harness' },
    ],
  },
  /* ── Visual Gen ──────────────────────────────────────────────────────── */
  {
    id: 'visual-gen-overview',
    label: 'Visual Gen Overview',
    description: 'Four-panel visual generation view: asset browser, forge, 3D viewer, and material lab',
    templateId: 'grid-4',
    directives: [
      { type: 'visual-gen-asset-browser' },
      { type: 'visual-gen-asset-forge' },
      { type: 'visual-gen-asset-viewer-3d' },
      { type: 'visual-gen-material-lab-pbr' },
    ],
  },
  {
    id: 'visual-gen-pipeline',
    label: 'Visual Pipeline',
    description: 'Side-by-side Blender pipeline and scene composer for content production workflow',
    templateId: 'split-2',
    directives: [
      { type: 'visual-gen-blender-pipeline' },
      { type: 'visual-gen-scene-composer' },
    ],
  },
  {
    id: 'visual-gen-full-studio',
    label: 'Visual Studio',
    description: 'Studio layout with asset browser, 3D viewer, material lab, and Blender pipeline for comprehensive visual authoring',
    templateId: 'studio',
    directives: [
      { type: 'visual-gen-asset-browser' },
      { type: 'visual-gen-asset-viewer-3d' },
      { type: 'visual-gen-material-lab-pbr' },
      { type: 'visual-gen-blender-pipeline' },
    ],
  },
  /* ── Content ────────────────────────────────────────────────────────── */
  {
    id: 'content-pipeline',
    label: 'Content Pipeline',
    description: 'Studio layout for content production: materials, audio, models, and VFX',
    templateId: 'studio',
    directives: [
      { type: 'content-material-preview' },
      { type: 'content-audio-spatial' },
      { type: 'content-model-assets' },
      { type: 'content-vfx-particles' },
    ],
  },
  {
    id: 'content-combat-feel',
    label: 'Combat Feel',
    description: 'Four-panel combat feel view: choreographer, damage numbers, health bars, and audio events',
    templateId: 'grid-4',
    directives: [
      { type: 'content-anim-choreographer' },
      { type: 'content-ui-damage-numbers' },
      { type: 'content-ui-health-bars' },
      { type: 'content-audio-event-catalog' },
    ],
  },
  {
    id: 'content-world-art',
    label: 'World Art',
    description: 'Side-by-side level flow editor and material patterns for world art authoring',
    templateId: 'split-2',
    directives: [
      { type: 'content-level-flow-editor' },
      { type: 'content-material-patterns' },
    ],
  },
  {
    id: 'content-full-studio',
    label: 'Content Studio',
    description: 'Studio layout with choreographer, level flow, material patterns, and health bars for comprehensive content authoring',
    templateId: 'studio',
    directives: [
      { type: 'content-anim-choreographer' },
      { type: 'content-level-flow-editor' },
      { type: 'content-material-patterns' },
      { type: 'content-ui-health-bars' },
    ],
  },
  /* ── ARPG Tools ──────────────────────────────────────────────────────── */
  {
    id: 'arpg-tools-combat-lab',
    label: 'Combat Lab',
    description: 'Four-panel combat authoring: ability forge, choreography, combo chains, and damage pipeline',
    templateId: 'grid-4',
    directives: [
      { type: 'arpg-tools-ability-forge' },
      { type: 'arpg-tools-combat-choreography' },
      { type: 'arpg-tools-combo-chain' },
      { type: 'arpg-tools-damage-pipeline' },
    ],
  },
  {
    id: 'arpg-tools-character-tuning',
    label: 'Character Tuning',
    description: 'Side-by-side genome editor and debug dashboard for character stat tuning',
    templateId: 'split-2',
    directives: [
      { type: 'arpg-tools-genome-editor' },
      { type: 'arpg-tools-debug-dashboard' },
    ],
  },
  {
    id: 'arpg-tools-full-studio',
    label: 'ARPG Tools Studio',
    description: 'Studio layout with ability forge, GAS blueprint, genome editor, and debug dashboard for comprehensive ARPG authoring',
    templateId: 'studio',
    directives: [
      { type: 'arpg-tools-ability-forge' },
      { type: 'arpg-tools-gas-blueprint' },
      { type: 'arpg-tools-genome-editor' },
      { type: 'arpg-tools-debug-dashboard' },
    ],
  },
];
