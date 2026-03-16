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

/* ── Known panel types ────────────────────────────────────────────────── */

const PANEL_TYPE_ALIASES: Record<string, string> = {
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
};

function resolvePanelType(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (PANEL_TYPE_ALIASES[normalized]) return PANEL_TYPE_ALIASES[normalized];
  // Try prefixed
  const prefixed = `arpg-combat-${normalized}`;
  if (Object.values(PANEL_TYPE_ALIASES).includes(prefixed)) return prefixed;
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

export function createPofSlashCommands(bus: IntentBus, chatStore: ChatStore): SlashCommand[] {
  return [
    {
      name: 'show',
      description: 'Open a panel (e.g. /show effects)',
      execute: (args: string) => {
        const panelType = resolvePanelType(args);
        if (!panelType) {
          chatStore.addMessage('system', `Unknown panel: "${args}". Try: core, attributes, tags, abilities, effects, timeline, damage-calc, tag-deps, tag-audit, loadout`);
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
          '/show [panel] — Open a panel (core, attributes, tags, abilities, effects, timeline, damage-calc, tag-deps, tag-audit, loadout)\n' +
          '/layout [template] — Switch layout (single, split-2, split-3, grid-4, primary-sidebar, triptych, studio)\n' +
          '/undo — Undo last change\n' +
          '/redo — Redo last change\n' +
          '/clear — Clear chat\n' +
          '/help — Show this list',
        );
      },
    },
  ];
}
