'use client';

import { Library, Wand2 } from 'lucide-react';
import { withOpacity, OPACITY_10, OPACITY_50 } from '@/lib/chart-colors';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { StatusTag } from '@/components/ui/StatusTag';
import type {
  EventSoundCoverage as Coverage, EventSoundOption, EventSoundSuggestions,
} from '@/lib/audio-event-sound';
import type { AudioEvent } from './types';
import { ACCENT } from './constants';

interface EventSoundCoverageProps {
  coverage: Coverage;
  suggestions: EventSoundSuggestions;
  events: readonly AudioEvent[];
  /** `null` while the library is loading or unreadable. */
  options: readonly EventSoundOption[] | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  /** Bind every confident suggestion in one step. */
  onApply: () => void;
  /** Open the editor's picker for an event whose best sets are tied. */
  onPick: (eventId: string) => void;
}

function summary(c: Coverage): string {
  if (c.state === 'unknown') {
    return `${c.bound} of ${c.total} bound (import status unknown) · ${c.unbound} unbound`;
  }
  const parts = [`${c.imported} of ${c.total} imported`];
  if (c.notImported) parts.push(`${c.notImported} bound, not imported`);
  if (c.setMissing) parts.push(`${c.setMissing} bound to a missing set`);
  parts.push(`${c.unbound} unbound`);
  return parts.join(' · ');
}

/**
 * Which event classes have a sound UE has imported — stated, not implied. An
 * unreadable library reads UNKNOWN, never "all unbound". Suggestions are
 * previewed before the one-click apply; tied matches are left to the user.
 * Reading and binding only: nothing here generates or plays audio.
 */
export function EventSoundCoverage({
  coverage, suggestions, events, options, isLoading, error, retry, onApply, onPick,
}: EventSoundCoverageProps) {
  const nameOf = (id: string) => events.find((e) => e.id === id)?.name ?? id;
  const setOf = (id: string) => options?.find((o) => o.id === id);
  const suggested = Object.entries(suggestions.suggested);
  const ambiguous = Object.entries(suggestions.ambiguous);

  return (
    <section aria-label="Event sound coverage" className="space-y-3 bg-surface p-4 rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="text-sm font-semibold text-text flex items-center gap-2">
          <Library className="w-4 h-4" style={{ color: ACCENT }} aria-hidden="true" />
          Library sounds
        </h4>
        <p className="text-sm text-text-muted" data-testid="event-sound-summary">
          {isLoading ? 'Reading the audio library…' : summary(coverage)}
        </p>
      </div>

      {error && (
        <InlineErrorRetry message={`${error} — sound coverage is UNKNOWN`} onRetry={retry} dense />
      )}

      {options && options.length === 0 && (
        <p className="text-xs text-text-muted">
          The library is empty — forge a set in the Sound Forge, then bind it here.
        </p>
      )}

      {suggested.length > 0 && (
        <div className="space-y-2">
          <ul className="space-y-1 text-xs text-text-muted" aria-label="Suggested bindings">
            {suggested.map(([eventId, setId]) => {
              const set = setOf(setId);
              return (
                <li key={eventId} className="flex items-center gap-2 min-w-0">
                  <span className="text-text font-semibold">{nameOf(eventId)}</span>
                  <span aria-hidden="true">→</span>
                  <span className="truncate">{set?.name ?? setId}</span>
                  {set?.cuePath
                    ? <StatusTag level="ok" word="imported" iconClassName="w-2.5 h-2.5" />
                    : <StatusTag level="warn" word="not imported" iconClassName="w-2.5 h-2.5" />}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onApply}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border focus-ring"
            style={{ color: ACCENT, backgroundColor: withOpacity(ACCENT, OPACITY_10), borderColor: withOpacity(ACCENT, OPACITY_50) }}
          >
            <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
            Apply {suggested.length} suggestion{suggested.length === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {ambiguous.length > 0 && (
        <ul className="space-y-1 text-xs text-text-muted" aria-label="Ambiguous matches">
          {ambiguous.map(([eventId, setIds]) => (
            <li key={eventId} className="flex items-center gap-2">
              <span className="text-text font-semibold">{nameOf(eventId)}</span>
              <span>{setIds.length} sets match equally — not picked for you.</span>
              <button
                type="button"
                onClick={() => onPick(eventId)}
                aria-label={`Pick a sound for ${nameOf(eventId)}`}
                className="px-2 py-0.5 rounded border border-border text-text hover:bg-surface-hover focus-ring"
              >
                Pick one
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
