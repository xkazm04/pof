'use client';

import { createRegistry } from '@/lib/dzin/core';
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
    micro: { minWidth: 80, minHeight: 60, description: 'Cpu icon with pipeline progress badge (e.g. 3/6)' },
    compact: { minWidth: 200, minHeight: 160, description: 'ASC feature status, 4 connection indicators, pipeline step count' },
    full: { minWidth: 400, minHeight: 300, description: 'Full CoreSection with feature card, connections grid, GAS pipeline, architecture explorer' },
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
    micro: { minWidth: 80, minHeight: 60, description: 'BarChart3 icon with attribute count badge' },
    compact: { minWidth: 200, minHeight: 160, description: 'Core vs derived attribute summary with status' },
    full: { minWidth: 400, minHeight: 300, description: 'Full attribute catalog, relationship web, growth projections' },
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
    micro: { minWidth: 80, minHeight: 60, description: 'Tags icon with total tag count' },
    compact: { minWidth: 200, minHeight: 120, description: 'Tag categories with child counts' },
    full: { minWidth: 400, minHeight: 280, description: 'Full tag hierarchy tree with category colors' },
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
    micro: { minWidth: 80, minHeight: 60, description: 'Sparkles icon with ability count' },
    compact: { minWidth: 200, minHeight: 160, description: 'Ability list with cooldown bars' },
    full: { minWidth: 400, minHeight: 300, description: 'Full ability radar, cooldown flow, feature cards' },
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
    micro: { minWidth: 80, minHeight: 60, description: 'Flame icon with effect count badge (4)' },
    compact: { minWidth: 200, minHeight: 160, description: 'Effect type list with colored dots and feature status indicators' },
    full: { minWidth: 400, minHeight: 300, description: 'Full effect type cards with stacking/calculation details and application pipeline' },
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
    micro: { minWidth: 80, minHeight: 60, description: 'Network icon with dependency edge count badge (6)' },
    compact: { minWidth: 200, minHeight: 120, description: 'Simplified dependency list showing blocking relationships' },
    full: { minWidth: 400, minHeight: 300, description: 'SVG network graph with nodes, edges, and category color coding' },
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
    micro: { minWidth: 80, minHeight: 60, description: 'Clock icon with timeline span badge (e.g. 0.5s - 10.5s)' },
    compact: { minWidth: 240, minHeight: 80, description: 'Condensed timeline bar with color-coded segments' },
    full: { minWidth: 500, minHeight: 120, description: 'Full interactive TimelineStrip with event details' },
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
    micro: { minWidth: 80, minHeight: 60, description: 'Calculator icon with step count badge' },
    compact: { minWidth: 200, minHeight: 200, description: 'Pipeline step list with colored dots' },
    full: { minWidth: 400, minHeight: 400, description: 'Full animated GAS execution sequence diagram' },
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
    micro: { minWidth: 80, minHeight: 60, description: 'ClipboardCheck icon with pass/fail score badge' },
    compact: { minWidth: 200, minHeight: 160, description: 'Audit category summary with status indicators' },
    full: { minWidth: 400, minHeight: 300, description: 'Full audit checklist, usage frequency, tag details' },
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
    micro: { minWidth: 80, minHeight: 60, description: 'Layers icon with slot count badge' },
    compact: { minWidth: 200, minHeight: 160, description: 'Loadout slots with ability names and score' },
    full: { minWidth: 400, minHeight: 300, description: 'Full loadout grid, radar chart, alternatives table' },
  },
  component: LoadoutPanel as unknown as ComponentType<Record<string, unknown>>,
});
