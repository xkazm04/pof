import type { SearchResult } from '@/lib/search-index';
import type { ActivityEvent } from '@/stores/activityFeedStore';
import type { SubModuleId } from '@/types/modules';
import type { RunIntent } from './searchIntents';

// ── Palette home ─────────────────────────────────────────────────────────────
// What the palette offers before anything is typed: unread, actionable feed
// events (each carries a Fix prompt) first, then the user's recent places.

export const MAX_ALERTS = 3;

export type HomeRowKind = 'alert' | 'recent';

export interface HomeRow {
  kind: HomeRowKind;
  /** Shaped like a search hit so rows reuse the result keyboard/click model. */
  result: SearchResult;
  /** Alerts only: the Fix prompt, dispatched on an explicit Shift+Enter / Run click. */
  run: RunIntent | null;
}

export const ALERT_ID_PREFIX = 'alert-';

function toAlert(e: ActivityEvent): HomeRow | null {
  const prompt = e.meta?.prompt;
  if (e.type !== 'evaluator-recommendation' || e.dismissed || !e.moduleId || !prompt) return null;
  return {
    kind: 'alert',
    result: {
      id: `${ALERT_ID_PREFIX}${e.id}`,
      type: 'finding',
      moduleId: e.moduleId,
      moduleLabel: '',
      title: e.title,
      snippet: e.description,
      rank: 0,
    },
    run: { kind: 'run', moduleId: e.moduleId as SubModuleId, prompt },
  };
}

export function buildHome(input: { recents: SearchResult[]; events: ActivityEvent[] }): HomeRow[] {
  const alerts: HomeRow[] = [];
  for (const e of input.events) {
    if (alerts.length >= MAX_ALERTS) break;
    const row = toAlert(e);
    if (row) alerts.push(row);
  }
  const recents: HomeRow[] = input.recents.map((result) => ({ kind: 'recent', result, run: null }));
  return [...alerts, ...recents];
}
