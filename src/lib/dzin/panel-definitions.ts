'use client';

import { createRegistry } from '@/lib/dzin/core';
import { CorePanel } from '@/components/modules/core-engine/dzin-panels/CorePanel';
import { AttributesPanel } from '@/components/modules/core-engine/dzin-panels/AttributesPanel';
import { TagsPanel } from '@/components/modules/core-engine/dzin-panels/TagsPanel';
import { AbilitiesPanel } from '@/components/modules/core-engine/dzin-panels/AbilitiesPanel';
import { EffectsPanel } from '@/components/modules/core-engine/dzin-panels/EffectsPanel';
import { TagDepsPanel } from '@/components/modules/core-engine/dzin-panels/TagDepsPanel';
import { EffectTimelinePanel } from '@/components/modules/core-engine/dzin-panels/EffectTimelinePanel';
import type { ComponentType } from 'react';

/* ── PoF Panel Registry ─────────────────────────────────────────────────── */

export const pofRegistry = createRegistry();

/* ── CorePanel registration (gold standard template) ────────────────────── */

pofRegistry.register({
  // Identity
  type: 'arpg-combat-core',
  label: 'Core -- AbilitySystem',
  icon: 'Cpu',

  // Layout metadata
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-combat'],

  // LLM-readable manifest
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

  // IO schema
  inputs: [
    {
      name: 'featureMap',
      type: 'object',
      description:
        'Map<string, FeatureRow> mapping feature names to their status data',
      required: true,
    },
    {
      name: 'defs',
      type: 'object',
      description:
        'Array of feature definitions with featureName, description, and optional dependsOn',
      required: true,
    },
  ],
  outputs: [
    {
      name: 'onFeatureSelect',
      type: 'string',
      description:
        'Emits selected feature name when user clicks a feature card, for cross-panel filtering',
    },
  ],

  // Density
  densityModes: {
    micro: {
      minWidth: 80,
      minHeight: 60,
      description: 'Cpu icon with pipeline progress badge (e.g. 3/6)',
    },
    compact: {
      minWidth: 200,
      minHeight: 160,
      description:
        'ASC feature status, 4 connection indicators, pipeline step count',
    },
    full: {
      minWidth: 400,
      minHeight: 300,
      description:
        'Full CoreSection with feature card, connections grid, GAS pipeline, architecture explorer',
    },
  },

  // Component
  component: CorePanel as unknown as ComponentType<Record<string, unknown>>,
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

  description:
    'Gameplay effect types, application pipeline, and effect feature tracking for the ARPG combat system',
  capabilities: ['viewing', 'status-tracking', 'pipeline-visualization'],
  useCases: [
    'View effect type catalog',
    'Track GameplayEffect implementation',
    'Inspect effect application pipeline',
  ],
  suggestedCompanions: [
    'arpg-combat-effect-timeline',
    'arpg-combat-abilities',
    'arpg-combat-damage-calc',
  ],

  inputs: [
    {
      name: 'featureMap',
      type: 'object',
      description:
        'Map<string, FeatureRow> mapping feature names to their status data',
      required: true,
    },
    {
      name: 'defs',
      type: 'object',
      description:
        'Array of feature definitions with featureName, description, and optional dependsOn',
      required: true,
    },
  ],
  outputs: [
    {
      name: 'onEffectSelect',
      type: 'string',
      description:
        'Emits selected effect type for cross-panel filtering',
    },
  ],

  densityModes: {
    micro: {
      minWidth: 80,
      minHeight: 60,
      description: 'Flame icon with effect count badge (4)',
    },
    compact: {
      minWidth: 200,
      minHeight: 160,
      description:
        'Effect type list with colored dots and feature status indicators',
    },
    full: {
      minWidth: 400,
      minHeight: 300,
      description:
        'Full effect type cards with stacking/calculation details and application pipeline',
    },
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

  description:
    'Tag dependency network graph showing blocking and requirement relationships between gameplay tags',
  capabilities: ['viewing', 'graph-visualization'],
  useCases: [
    'Visualize tag blocking relationships',
    'Identify dependency chains',
    'Debug tag interaction conflicts',
  ],
  suggestedCompanions: [
    'arpg-combat-tags',
    'arpg-combat-tag-audit',
    'arpg-combat-effects',
  ],

  inputs: [
    {
      name: 'featureMap',
      type: 'object',
      description:
        'Map<string, FeatureRow> mapping feature names to their status data',
      required: true,
    },
    {
      name: 'defs',
      type: 'object',
      description:
        'Array of feature definitions with featureName, description, and optional dependsOn',
      required: true,
    },
  ],
  outputs: [
    {
      name: 'onTagDepSelect',
      type: 'string',
      description:
        'Emits selected tag dependency for cross-panel filtering',
    },
  ],

  densityModes: {
    micro: {
      minWidth: 80,
      minHeight: 60,
      description: 'Network icon with dependency edge count badge (6)',
    },
    compact: {
      minWidth: 200,
      minHeight: 120,
      description:
        'Simplified dependency list showing blocking relationships',
    },
    full: {
      minWidth: 400,
      minHeight: 300,
      description:
        'SVG network graph with nodes, edges, and category color coding',
    },
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

  description:
    'Temporal visualization of gameplay effect stacking, durations, and application sequence',
  capabilities: ['viewing', 'timeline-visualization'],
  useCases: [
    'Visualize effect timing',
    'Debug effect stacking order',
    'Inspect duration overlaps',
  ],
  suggestedCompanions: [
    'arpg-combat-effects',
    'arpg-combat-abilities',
    'arpg-combat-damage-calc',
  ],

  inputs: [
    {
      name: 'featureMap',
      type: 'object',
      description:
        'Map<string, FeatureRow> mapping feature names to their status data',
      required: true,
    },
    {
      name: 'defs',
      type: 'object',
      description:
        'Array of feature definitions with featureName, description, and optional dependsOn',
      required: true,
    },
  ],
  outputs: [
    {
      name: 'onTimelineEventSelect',
      type: 'string',
      description:
        'Emits selected timeline event for cross-panel filtering',
    },
  ],

  densityModes: {
    micro: {
      minWidth: 80,
      minHeight: 60,
      description: 'Clock icon with timeline span badge (e.g. 0.5s - 10.5s)',
    },
    compact: {
      minWidth: 240,
      minHeight: 80,
      description:
        'Condensed timeline bar with color-coded segments',
    },
    full: {
      minWidth: 500,
      minHeight: 120,
      description:
        'Full interactive TimelineStrip with event details',
    },
  },

  component: EffectTimelinePanel as unknown as ComponentType<Record<string, unknown>>,
});
