'use client';

import { Activity } from 'lucide-react';

export type SourceState = 'ok' | 'empty' | 'failed';

const STATE_TEXT: Record<SourceState, string> = {
  ok: 'Data available',
  empty: 'No data',
  failed: 'Load failed',
};
// Non-colour cue (WCAG 1.4.1): a glyph beside the hue change.
const STATE_GLYPH: Record<SourceState, string> = { ok: '✓', empty: '–', failed: '!' };

/** Failure outranks emptiness: a source that failed to load is never reported as 'no data'. */
export function sourceState(hasData: boolean, failed: boolean): SourceState {
  if (failed && !hasData) return 'failed';
  return hasData ? 'ok' : 'empty';
}

export function SourceBadge({
  label,
  name,
  state,
  icon: Icon,
}: {
  label: string;
  /** Full source name for the accessible label ("Quality"). */
  name: string;
  state: SourceState;
  icon: typeof Activity;
}) {
  const active = state === 'ok';
  return (
    <div
      role="img"
      aria-label={`${name}: ${STATE_TEXT[state].toLowerCase()}`}
      className="relative flex items-center justify-center w-6 h-6 rounded-md transition-colors"
      style={{
        backgroundColor: active ? 'var(--border)' : 'var(--surface-deep)',
        border: `1px solid ${active ? 'var(--border-bright)' : 'var(--border)'}`,
      }}
      title={`${label}: ${STATE_TEXT[state]}`}
    >
      <Icon
        className="w-3 h-3"
        aria-hidden="true"
        style={{ color: active ? 'var(--text)' : 'var(--text-subtle)' }}
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-1 -right-1 text-2xs leading-none font-bold"
        style={{ color: state === 'failed' ? 'var(--text)' : 'var(--text-subtle)' }}
      >
        {STATE_GLYPH[state]}
      </span>
    </div>
  );
}
