/**
 * Slash commands for the PoF advisor chat.
 *
 * Each command creates an Intent and dispatches it through the IntentBus,
 * or performs a direct action on the ChatStore.
 */

import type { SlashCommand } from '@/lib/dzin/core/chat';
import type { IntentBus } from '@/lib/dzin/core/intent';
import type { ChatStore } from '@/lib/dzin/core/chat';
import type { LayoutTemplateId } from '@/lib/dzin/core/layout/types';
import { COMPOSITION_PRESETS } from '@/lib/dzin/composition-presets';

/* ── Known panel types ────────────────────────────────────────────────── */

const PANEL_TYPE_ALIASES: Record<string, string> = {
  // Combat
  'core': 'arpg-combat-core',
  'attributes': 'arpg-combat-attributes',
  'tags': 'arpg-combat-tags',
  'abilities': 'arpg-combat-abilities',
  'effects': 'arpg-combat-effects',
  'timeline': 'arpg-combat-effect-timeline',
  'effect-timeline': 'arpg-combat-effect-timeline',
  'damage-calc': 'arpg-combat-damage-calc',
  'damage': 'arpg-combat-damage-calc',
  'tag-deps': 'arpg-combat-tag-deps',
  'tag-audit': 'arpg-combat-tag-audit',
  'loadout': 'arpg-combat-loadout',
  // Character
  'character': 'arpg-character-overview',
  'character-overview': 'arpg-character-overview',
  'movement': 'arpg-character-movement',
  'input': 'arpg-character-input',
  'state-machine': 'arpg-animation-state-machine',
  'montages': 'arpg-animation-montages',
  'blend-space': 'arpg-animation-blend-space',
  // Inventory & Loot
  'catalog': 'arpg-inventory-catalog',
  'equipment': 'arpg-inventory-equipment',
  'loot-table': 'arpg-loot-table',
  'loot': 'arpg-loot-table',
  'affix': 'arpg-loot-affix',
  'economy': 'arpg-item-economy',
  'item-dna': 'arpg-item-dna',
  // Enemies & World
  'bestiary': 'arpg-enemy-bestiary',
  'enemies': 'arpg-enemy-bestiary',
  'ai-tree': 'arpg-enemy-ai-tree',
  'zone-map': 'arpg-world-zone-map',
  'zones': 'arpg-world-zone-map',
  'encounters': 'arpg-world-encounters',
  'level-design': 'arpg-world-level-design',
  'progression': 'arpg-progression-curves',
  // UI & Save
  'hud': 'arpg-ui-hud-compositor',
  'screen-flow': 'arpg-ui-screen-flow',
  'menu-flow': 'arpg-ui-menu-flow',
  'save-schema': 'arpg-save-schema',
  'save-slots': 'arpg-save-slots',
  'save': 'arpg-save-schema',
  // Evaluator
  'quality': 'evaluator-quality',
  'deps': 'evaluator-deps',
  'insights': 'evaluator-insights',
  'project-health': 'evaluator-project-health',
  'feature-matrix': 'evaluator-feature-matrix',
  'eval': 'evaluator-quality',
  // Content
  'materials': 'content-material-preview',
  'audio': 'content-audio-spatial',
  'models': 'content-model-assets',
  'level-blockout': 'content-level-blockout',
  'vfx': 'content-vfx-particles',
};

/** All known panel type values for reverse lookup. */
const ALL_PANEL_TYPES = new Set(Object.values(PANEL_TYPE_ALIASES));

function resolvePanelType(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (PANEL_TYPE_ALIASES[normalized]) return PANEL_TYPE_ALIASES[normalized];
  // Try as a full panel type directly
  if (ALL_PANEL_TYPES.has(normalized)) return normalized;
  return null;
}

const VALID_LAYOUTS = new Set<string>([
  'single', 'split-2', 'split-3', 'grid-4', 'primary-sidebar', 'triptych', 'studio', 'stack',
]);

/* ── Command factory ──────────────────────────────────────────────────── */

let intentCounter = 0;
function nextIntentId(): string {
  return `slash-${Date.now()}-${++intentCounter}`;
}

/* ── Domain preset map — domain shortcut → preset id ─────────────────── */

const DOMAIN_PRESETS: Record<string, string> = {
  'character': 'character-debug',
  'loot': 'loot-analysis',
  'enemies': 'enemy-inspector',
  'world': 'world-overview',
  'save': 'save-inspector',
  'eval': 'full-evaluator',
  'materials': 'content-pipeline',
  'audio': 'content-pipeline',
  'combat': 'combat-debug',
  'ui': 'ui-flow',
  'animation': 'animation-suite',
  'inventory': 'inventory-overview',
  'tags': 'tag-inspector',
  'quality': 'quality-dashboard',
};

function applyPreset(presetId: string, bus: IntentBus, chatStore: ChatStore): boolean {
  const preset = COMPOSITION_PRESETS.find((p) => p.id === presetId);
  if (!preset) return false;
  bus.dispatch({
    id: nextIntentId(),
    type: 'compose',
    payload: { action: 'apply-preset', presetId: preset.id, template: preset.templateId, panels: preset.directives },
    source: 'slash-command',
    timestamp: Date.now(),
  });
  chatStore.addMessage('system', `Applying preset: ${preset.label}`);
  return true;
}

export function createPofSlashCommands(bus: IntentBus, chatStore: ChatStore): SlashCommand[] {
  /* ── Domain shortcut commands ─────────────────────────────────────── */

  const domainCommands: SlashCommand[] = Object.entries(DOMAIN_PRESETS).map(([domain, presetId]) => ({
    name: domain,
    description: `Open ${domain} workspace`,
    execute: () => {
      applyPreset(presetId, bus, chatStore);
    },
  }));

  return [
    {
      name: 'show',
      description: 'Open a panel (e.g. /show effects)',
      execute: (args: string) => {
        const panelType = resolvePanelType(args);
        if (!panelType) {
          chatStore.addMessage('system', `Unknown panel: "${args}". Try: ${Object.keys(PANEL_TYPE_ALIASES).join(', ')}`);
          return;
        }
        bus.dispatch({
          id: nextIntentId(),
          type: 'compose',
          payload: { action: 'open', panelType },
          source: 'slash-command',
          timestamp: Date.now(),
        });
        chatStore.addMessage('system', `Opening ${panelType}`);
      },
    },
    {
      name: 'preset',
      description: 'Apply a composition preset (e.g. /preset combat-debug)',
      execute: (args: string) => {
        const presetId = args.trim().toLowerCase();
        if (!applyPreset(presetId, bus, chatStore)) {
          const available = COMPOSITION_PRESETS.map((p) => p.id).join(', ');
          chatStore.addMessage('system', `Unknown preset: "${args}". Available: ${available}`);
        }
      },
    },
    {
      name: 'layout',
      description: 'Switch layout (e.g. /layout studio)',
      execute: (args: string) => {
        const template = args.trim().toLowerCase();
        if (!VALID_LAYOUTS.has(template)) {
          chatStore.addMessage('system', `Unknown layout: "${args}". Try: ${[...VALID_LAYOUTS].join(', ')}`);
          return;
        }
        bus.dispatch({
          id: nextIntentId(),
          type: 'compose',
          payload: { action: 'set-layout', template: template as LayoutTemplateId },
          source: 'slash-command',
          timestamp: Date.now(),
        });
        chatStore.addMessage('system', `Switching to ${template} layout`);
      },
    },
    {
      name: 'undo',
      description: 'Undo last workspace change',
      execute: () => {
        bus.dispatch({
          id: nextIntentId(),
          type: 'system',
          payload: { action: 'undo' },
          source: 'slash-command',
          timestamp: Date.now(),
        });
        chatStore.addMessage('system', 'Undone');
      },
    },
    {
      name: 'redo',
      description: 'Redo last undone change',
      execute: () => {
        bus.dispatch({
          id: nextIntentId(),
          type: 'system',
          payload: { action: 'redo' },
          source: 'slash-command',
          timestamp: Date.now(),
        });
        chatStore.addMessage('system', 'Redone');
      },
    },
    {
      name: 'clear',
      description: 'Clear chat history',
      execute: () => {
        chatStore.clear();
      },
    },
    {
      name: 'help',
      description: 'List available commands',
      execute: () => {
        chatStore.addMessage('system',
          'Available commands:\n' +
          '/show [panel] — Open a panel by alias\n' +
          '/preset [id] — Apply a composition preset\n' +
          '/layout [template] — Switch layout (single, split-2, split-3, grid-4, primary-sidebar, triptych, studio)\n' +
          '\nDomain shortcuts:\n' +
          '/character — Character debug workspace\n' +
          '/combat — Combat debug workspace\n' +
          '/loot — Loot analysis workspace\n' +
          '/inventory — Inventory overview\n' +
          '/enemies — Enemy inspector\n' +
          '/world — World overview\n' +
          '/animation — Animation suite\n' +
          '/ui — UI flow workspace\n' +
          '/save — Save inspector\n' +
          '/eval — Full evaluator\n' +
          '/materials — Content pipeline\n' +
          '/audio — Content pipeline\n' +
          '/tags — Tag inspector\n' +
          '/quality — Quality dashboard\n' +
          '\n/undo, /redo, /clear, /help',
        );
      },
    },
    ...domainCommands,
  ];
}
