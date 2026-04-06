/**
 * useMultimodalInput — Merges text (and eventually voice) input into Intents.
 *
 * Tries local intent resolution first via pattern matching.
 * Falls through to LLM if no local pattern matches.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Intent, IntentBus } from '@/lib/dzin/core/intent';
import type { LayoutTemplateId } from '@/lib/dzin/core/layout/types';

/* ── Known panel types for local resolution ───────────────────────────── */

const PANEL_ALIASES: Record<string, string> = {
  'core': 'arpg-combat-core',
  'attributes': 'arpg-combat-attributes',
  'tags': 'arpg-combat-tags',
  'abilities': 'arpg-combat-abilities',
  'effects': 'arpg-combat-effects',
  'timeline': 'arpg-combat-effect-timeline',
  'effect timeline': 'arpg-combat-effect-timeline',
  'effect-timeline': 'arpg-combat-effect-timeline',
  'damage calc': 'arpg-combat-damage-calc',
  'damage-calc': 'arpg-combat-damage-calc',
  'damage calculator': 'arpg-combat-damage-calc',
  'tag deps': 'arpg-combat-tag-deps',
  'tag dependencies': 'arpg-combat-tag-deps',
  'tag-deps': 'arpg-combat-tag-deps',
  'tag audit': 'arpg-combat-tag-audit',
  'tag-audit': 'arpg-combat-tag-audit',
  'loadout': 'arpg-combat-loadout',
};

const KNOWN_LAYOUTS = new Set<string>([
  'single', 'split-2', 'split-3', 'grid-4', 'primary-sidebar', 'triptych', 'studio', 'stack',
]);

/* ── Intent creation helper ───────────────────────────────────────────── */

let counter = 0;

function makeIntent<T extends Intent['type']>(
  type: T,
  payload: Intent<T>['payload'],
  source: Intent['source'],
): Intent {
  return {
    id: `mm-${Date.now()}-${++counter}`,
    type,
    payload,
    source,
    timestamp: Date.now(),
  } as Intent;
}

/* ── Local intent resolution ──────────────────────────────────────────── */

function parseTextToIntent(text: string): Intent | null {
  const normalized = text.trim().toLowerCase();

  // undo / redo
  if (normalized === 'undo') return makeIntent('system', { action: 'undo' }, 'keyboard');
  if (normalized === 'redo') return makeIntent('system', { action: 'redo' }, 'keyboard');

  // show / open [panel]
  const showMatch = normalized.match(/^(?:show|open)\s+(.+)$/);
  if (showMatch) {
    const panelType = PANEL_ALIASES[showMatch[1].trim()];
    if (panelType) {
      return makeIntent('compose', { action: 'open', panelType }, 'keyboard');
    }
  }

  // close / hide [panel]
  const closeMatch = normalized.match(/^(?:close|hide)\s+(.+)$/);
  if (closeMatch) {
    const panelType = PANEL_ALIASES[closeMatch[1].trim()];
    if (panelType) {
      return makeIntent('compose', { action: 'close', panelType }, 'keyboard');
    }
  }

  // layout [template] / switch to [template]
  const layoutMatch = normalized.match(/^(?:layout|switch\s+to)\s+(.+)$/);
  if (layoutMatch) {
    const template = layoutMatch[1].trim();
    if (KNOWN_LAYOUTS.has(template)) {
      return makeIntent('compose', { action: 'set-layout', template: template as LayoutTemplateId }, 'keyboard');
    }
  }

  return null; // falls through to LLM
}

/* ── Hook ─────────────────────────────────────────────────────────────── */

interface UseMultimodalInputOptions {
  bus: IntentBus;
  /** Called when text can't be resolved locally and should go to the LLM */
  onLLMFallback: (text: string) => void;
}

export function useMultimodalInput({ bus, onLLMFallback }: UseMultimodalInputOptions) {
  const busRef = useRef(bus);
  useEffect(() => { busRef.current = bus; }, [bus]);

  const handleTextInput = useCallback(
    (text: string) => {
      const intent = parseTextToIntent(text);
      if (intent) {
        const result = busRef.current.dispatch(intent);
        if (result.status === 'resolved') return;
      }
      // Not locally resolvable — send to LLM
      onLLMFallback(text);
    },
    [onLLMFallback],
  );

  const handleTranscription = useCallback(
    (text: string) => {
      const intent = parseTextToIntent(text);
      if (intent) {
        intent.source = 'voice' as Intent['source'];
        const result = busRef.current.dispatch(intent);
        if (result.status === 'resolved') return;
      }
      // Voice transcription not locally resolvable — Gemini Live handles it
    },
    [],
  );

  return { handleTextInput, handleTranscription };
}

export { parseTextToIntent };
