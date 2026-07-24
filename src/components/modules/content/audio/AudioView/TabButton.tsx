'use client';
import { Music } from 'lucide-react';
import type { TabId } from './types';

/** Stable DOM id for a tab, so its panel can point back at it via aria-labelledby. */
export function tabDomId(id: TabId): string {
  return `audio-tab-${id}`;
}

/** The single rendered tab panel (only the active tab's content is mounted). */
export const AUDIO_TABPANEL_ID = 'audio-tabpanel';

export function TabButton({
  id,
  label,
  icon: Icon,
  active,
  onClick,
  accent,
}: {
  /** Tab identity — also drives the DOM id used by the panel's aria-labelledby. */
  id: TabId;
  label: string;
  icon: typeof Music;
  active: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      id={tabDomId(id)}
      role="tab"
      aria-selected={active}
      // Only the active panel is mounted, so only the selected tab can point at it.
      aria-controls={active ? AUDIO_TABPANEL_ID : undefined}
      // Roving tabindex: the tablist is one tab stop, arrows move between tabs.
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative focus-ring-inset rounded-t ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
      )}
    </button>
  );
}
