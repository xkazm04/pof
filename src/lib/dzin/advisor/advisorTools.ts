/**
 * Advisor Tool Declarations — Gemini function declarations for the PoF workspace advisor.
 *
 * These tools let Gemini compose/recompose the Dzin workspace panels
 * and send proactive suggestions to the user.
 */

import { Type, type FunctionDeclaration } from '@google/genai';

/* ── Panel type enum for compose_workspace ────────────────────────────── */

const POF_PANEL_TYPES = [
  'arpg-combat-core',
  'arpg-combat-attributes',
  'arpg-combat-tags',
  'arpg-combat-abilities',
  'arpg-combat-effects',
  'arpg-combat-effect-timeline',
  'arpg-combat-damage-calc',
  'arpg-combat-tag-deps',
  'arpg-combat-tag-audit',
  'arpg-combat-loadout',
] as const;

export type PofPanelType = (typeof POF_PANEL_TYPES)[number];

/* ── Function declarations for Gemini ─────────────────────────────────── */

export const POF_ADVISOR_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'compose_workspace',
    description:
      'Rearrange workspace panels for UE5 ARPG combat development. ' +
      'Composition patterns: debug effects -> effects + effect-timeline + damage-calc (grid-4). ' +
      'Ability authoring -> core + abilities + tags (studio). ' +
      'Quick overview -> core + abilities (split-2). ' +
      'Tag audit -> tags + tag-deps + tag-audit (split-3). ' +
      'Balance tuning -> abilities + attributes + loadout + damage-calc (grid-4).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description:
            'show: add panels without removing existing. hide: remove specific panels. replace: clear all and set new panels. clear: remove all panels.',
          enum: ['show', 'hide', 'replace', 'clear'],
        },
        layout: {
          type: Type.STRING,
          description: 'Optional layout preset. Omit unless a specific structure is clearly needed.',
          enum: ['stack', 'single', 'split-2', 'split-3', 'grid-4', 'primary-sidebar', 'triptych', 'studio'],
        },
        panels: {
          type: Type.STRING,
          description:
            `JSON array of panel objects: [{"type":"panel-type","role":"primary|secondary|tertiary|sidebar","density":"full|compact|micro"}]. ` +
            `Recommended 1-3 panels (max 5) with one primary panel. ` +
            `Panel types: ${POF_PANEL_TYPES.join(', ')}. ` +
            `Panel descriptions: ` +
            `arpg-combat-core: GAS pipeline status, AbilitySystemComponent connections. ` +
            `arpg-combat-attributes: Attribute catalog, relationship web, growth curves. ` +
            `arpg-combat-tags: Gameplay tag hierarchy viewer. ` +
            `arpg-combat-abilities: Ability radar comparison, cooldown flow. ` +
            `arpg-combat-effects: GameplayEffect types, application pipeline. ` +
            `arpg-combat-effect-timeline: Temporal effect stacking visualization. ` +
            `arpg-combat-damage-calc: Step-by-step damage execution pipeline. ` +
            `arpg-combat-tag-deps: Tag dependency network graph. ` +
            `arpg-combat-tag-audit: Tag quality audit dashboard. ` +
            `arpg-combat-loadout: Ability loadout optimizer with balance radar.`,
        },
        reasoning: {
          type: Type.STRING,
          description: 'Brief explanation of why these panels were chosen. Shown to the user.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'suggest_action',
    description:
      'Send a proactive suggestion to the user. The suggestion appears as a system message in chat. ' +
      'Use for workflow tips, debugging advice, or composition recommendations.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: {
          type: Type.STRING,
          description: 'The suggestion text. Keep it concise (1-3 sentences).',
        },
        compose_on_accept: {
          type: Type.STRING,
          description:
            'Optional JSON for a compose_workspace call to execute if the user accepts. ' +
            'Format: {"action":"replace","panels":[...],"layout":"..."}',
        },
      },
      required: ['content'],
    },
  },
];

/* ── System instruction ───────────────────────────────────────────────── */

export const POF_ADVISOR_SYSTEM_INSTRUCTION = `You are the Workspace Advisor for Pillars of Fortune (PoF), an AI-powered UE5 C++ game development assistant with a dynamic panel-based workspace.

## Your Role
You dynamically arrange workspace panels so the developer sees relevant UE5 ARPG combat system content. You respond to user questions about GAS (Gameplay Ability System) architecture and suggest optimal panel compositions for their current task.

## Available Panels (use compose_workspace to arrange)

### Core
- arpg-combat-core [primary/standard]: GAS pipeline status, AbilitySystemComponent connections, architecture explorer
- arpg-combat-attributes [secondary/standard]: Attribute catalog, relationship web, growth projections (Warrior/Mage/Rogue builds)

### Tags
- arpg-combat-tags [secondary/standard]: Gameplay tag hierarchy (Ability, State, Damage, Input categories)
- arpg-combat-tag-deps [secondary/standard]: Tag dependency network graph (blocks/requires relationships)
- arpg-combat-tag-audit [secondary/standard]: Tag quality audit — duplicate detection, naming conventions, unused tags

### Abilities & Effects
- arpg-combat-abilities [secondary/standard]: Ability radar comparison (Damage/Range/AOE/Speed/Efficiency), cooldown flow
- arpg-combat-effects [secondary/standard]: GameplayEffect types (GE_Damage, GE_Heal, GE_Buff, GE_Regen), application pipeline
- arpg-combat-effect-timeline [secondary/wide]: Temporal visualization of effect stacking, durations, application sequence
- arpg-combat-damage-calc [secondary/standard]: 7-step GAS damage execution pipeline (ASC → AttributeSet → Tags → GA → GE → Execution → Callbacks)

### Loadout
- arpg-combat-loadout [secondary/standard]: Ability loadout optimizer with slot assignments, balance radar, alternatives

## Layouts
single, split-2, split-3, grid-4, primary-sidebar, triptych, studio

## Density Modes
- full (default): All features visible — for primary work area
- compact: Key info only — ideal for sidebars
- micro: Badge/chip view (~48px) — reference only

## Composition Patterns

When user wants to debug effects / damage:
- grid-4: effects + effect-timeline + damage-calc + core

When user wants ability overview:
- split-2: core + abilities

When user wants comprehensive authoring:
- studio: tags + core + attributes + abilities

When user discusses tag quality:
- split-3: tags + tag-deps + tag-audit

When user wants to tune balance:
- grid-4: abilities + attributes + loadout + damage-calc

When user focuses on the GAS pipeline:
- primary-sidebar: core (primary) + effects (sidebar, compact)

## Composition Policy
- Default to 1-3 panels; use 4+ only if user explicitly needs multi-view
- Include one primary panel maximum
- Sidebar role is for compact/context panels
- Omit layout unless a specific arrangement is clearly needed
- Use "show" for additive, "replace" for domain shifts

## Response Style
- Keep responses concise (1-3 sentences)
- When the user asks about UE5/GAS, respond conversationally AND compose relevant panels
- Offer workflow suggestions when the workspace seems unfocused`;
