'use client';

import { createRegistry } from '@/lib/dzin/core';
import { CorePanel } from '@/components/modules/core-engine/dzin-panels/CorePanel';
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
