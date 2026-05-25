/**
 * Suggestion actions — parse a `suggest_action` tool call's `compose_on_accept`
 * payload and replay it through the IntentBus.
 *
 * The advisor proposes a workspace composition alongside a suggestion. When the
 * user clicks "Apply", that composition is converted into an `apply-preset`
 * compose Intent and dispatched, giving full undo support. The payload mirrors
 * the `compose_workspace` argument shape (`{ action, panels, layout }`).
 */

import type { IntentBus, Intent } from '@/lib/dzin/core/intent';
import type { LayoutTemplateId, PanelDirective } from '@/lib/dzin/core/layout/types';
import type { PanelRole, PanelDensity } from '@/lib/dzin/core/types/panel';
import type { SuggestedCompose, SuggestedComposeAction, SuggestedPanel } from '@/lib/dzin/core/chat';

/* ── Constants ────────────────────────────────────────────────────────── */

const VALID_ACTIONS: ReadonlySet<string> = new Set<SuggestedComposeAction>([
  'show',
  'hide',
  'replace',
  'clear',
]);

const KNOWN_LAYOUTS: ReadonlySet<string> = new Set<LayoutTemplateId>([
  'single',
  'split-2',
  'split-3',
  'grid-4',
  'primary-sidebar',
  'triptych',
  'studio',
  'stack',
]);

let suggestionCounter = 0;
function nextSuggestionIntentId(): string {
  return `suggestion-${Date.now()}-${++suggestionCounter}`;
}

/* ── Parsing ──────────────────────────────────────────────────────────── */

/** Coerce a raw panels value (JSON string or array) into typed SuggestedPanels. */
function parsePanels(raw: unknown): SuggestedPanel[] {
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      arr = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];

  const panels: SuggestedPanel[] = [];
  for (const item of arr) {
    if (item && typeof item === 'object' && typeof (item as { type?: unknown }).type === 'string') {
      const p = item as Record<string, unknown>;
      panels.push({
        type: p.type as string,
        role: typeof p.role === 'string' ? p.role : undefined,
        density: typeof p.density === 'string' ? p.density : undefined,
      });
    }
  }
  return panels;
}

/**
 * Parse a `compose_on_accept` value (a JSON string or already-parsed object)
 * into a validated SuggestedCompose, or null if it is absent/malformed.
 *
 * Returns null when the action is unrecognized, or when a non-`clear` action
 * carries no usable panels — in those cases the caller should fall back to a
 * plain system message.
 */
export function parseComposeOnAccept(raw: unknown): SuggestedCompose | null {
  if (raw == null) return null;

  let obj: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (typeof obj !== 'object' || obj === null) return null;

  const record = obj as Record<string, unknown>;
  const action = typeof record.action === 'string' ? record.action.toLowerCase() : 'replace';
  if (!VALID_ACTIONS.has(action)) return null;

  const panels = parsePanels(record.panels);
  // Every action except `clear` needs at least one panel to be meaningful.
  if (action !== 'clear' && panels.length === 0) return null;

  const layout =
    typeof record.layout === 'string' && KNOWN_LAYOUTS.has(record.layout)
      ? (record.layout as LayoutTemplateId)
      : undefined;

  return { action: action as SuggestedComposeAction, panels, layout };
}

/* ── Intent construction ──────────────────────────────────────────────── */

function toDirective(panel: SuggestedPanel): PanelDirective {
  return {
    type: panel.type,
    role: panel.role as PanelRole | undefined,
    density: panel.density as PanelDensity | undefined,
  };
}

/**
 * Resolve the panel set the suggestion produces relative to the current
 * workspace, honoring show/hide/replace/clear semantics.
 */
function resolveDirectives(
  compose: SuggestedCompose,
  currentDirectives: PanelDirective[],
): PanelDirective[] {
  const suggested = compose.panels.map(toDirective);

  switch (compose.action) {
    case 'replace':
      return suggested;
    case 'clear':
      return [];
    case 'show': {
      const existingTypes = new Set(currentDirectives.map((d) => d.type));
      const additions = suggested.filter((d) => !existingTypes.has(d.type));
      return [...currentDirectives, ...additions];
    }
    case 'hide': {
      const hideTypes = new Set(suggested.map((d) => d.type));
      return currentDirectives.filter((d) => !hideTypes.has(d.type));
    }
    default:
      return currentDirectives;
  }
}

/**
 * Build the `apply-preset` compose Intent for a suggestion. Resolving the full
 * directive set up front lets a single bus dispatch handle every action while
 * recording one undo group.
 */
export function buildComposeSuggestionIntent(
  compose: SuggestedCompose,
  current: { directives: PanelDirective[]; template: LayoutTemplateId },
): Intent<'compose'> {
  return {
    id: nextSuggestionIntentId(),
    type: 'compose',
    payload: {
      action: 'apply-preset',
      presetId: 'advisor-suggestion',
      template: compose.layout ?? current.template,
      panels: resolveDirectives(compose, current.directives),
    },
    source: 'click',
    timestamp: Date.now(),
  };
}

/**
 * Dispatch a suggestion's composition through the IntentBus. Used by the
 * one-click "Apply" control on advisor suggestion cards.
 */
export function applyComposeSuggestion(
  compose: SuggestedCompose,
  ctx: { bus: IntentBus; currentDirectives: PanelDirective[]; currentTemplate: LayoutTemplateId },
): void {
  const intent = buildComposeSuggestionIntent(compose, {
    directives: ctx.currentDirectives,
    template: ctx.currentTemplate,
  });
  ctx.bus.dispatch(intent);
}

/**
 * Human-readable summary of what a suggestion will do, for the card UI.
 * e.g. "Replace with 3 panels · grid-4" or "Clear all panels".
 */
export function summarizeSuggestion(compose: SuggestedCompose): string {
  const count = compose.panels.length;
  const plural = count === 1 ? 'panel' : 'panels';
  const layoutSuffix = compose.layout ? ` · ${compose.layout}` : '';

  switch (compose.action) {
    case 'replace':
      return `Replace with ${count} ${plural}${layoutSuffix}`;
    case 'show':
      return `Add ${count} ${plural}${layoutSuffix}`;
    case 'hide':
      return `Hide ${count} ${plural}${layoutSuffix}`;
    case 'clear':
      return `Clear all panels${layoutSuffix}`;
    default:
      return `Apply composition${layoutSuffix}`;
  }
}
