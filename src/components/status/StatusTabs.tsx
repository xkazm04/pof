'use client';

/** The /status header tab switcher: Capability | Pipelines | Category | Item Focus |
 *  Models. Lab-token styled, and a real WAI-ARIA tablist: roving tabindex (only one tab
 *  is in the page tab order) with ←/→ to move between tabs (wrapping) and Home/End to
 *  jump to the ends. Activation is MANUAL (arrows move focus, Enter/Space — the native
 *  button activation — switches) because each switch is a pushState navigation; automatic
 *  activation would push a history entry per keystroke and break the Back button.
 *  Each tab points at its panel via `aria-controls` (StatusDashboard renders the matching
 *  `role="tabpanel"`). */
import { useRef, useState } from 'react';

export type StatusTab = 'capability' | 'pipelines' | 'category' | 'item' | 'models';

const TABS: { id: StatusTab; label: string }[] = [
  { id: 'capability', label: 'Capability' },
  { id: 'pipelines', label: 'Pipelines' },
  { id: 'category', label: 'Category' },
  { id: 'item', label: 'Item Focus' },
  { id: 'models', label: 'Models' },
];

/** Shared id scheme so the dashboard's panel can label itself from the active tab. */
export const statusTabId = (t: StatusTab) => `status-tab-${t}`;
export const statusPanelId = (t: StatusTab) => `status-panel-${t}`;

export function StatusTabs({ tab, onChange }: { tab: StatusTab; onChange: (t: StatusTab) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  // Which tab currently holds the roving tabindex. `null` = follow the selected tab, which
  // is also what we return to once focus leaves the tablist.
  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  const selectedIdx = Math.max(0, TABS.findIndex((t) => t.id === tab));
  const rovingIdx = focusIdx ?? selectedIdx;

  const moveFocus = (to: number) => {
    const i = (to + TABS.length) % TABS.length;
    setFocusIdx(i);
    listRef.current?.querySelector<HTMLButtonElement>(`#${statusTabId(TABS[i].id)}`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus(rovingIdx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus(rovingIdx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); moveFocus(0); }
    else if (e.key === 'End') { e.preventDefault(); moveFocus(TABS.length - 1); }
    // Enter/Space need no handling — they fire the focused <button>'s native click.
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Status view"
      onKeyDown={onKeyDown}
      // Focus left the tablist entirely → hand the tab stop back to the selected tab.
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusIdx(null); }}
      style={{ display: 'inline-flex', gap: 'var(--lab-s1)', border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)', padding: 2 }}
    >
      {TABS.map((t, i) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            id={statusTabId(t.id)}
            type="button"
            role="tab"
            aria-selected={active}
            // Only the selected tab's panel is rendered, so only it gets a live IDREF.
            aria-controls={active ? statusPanelId(t.id) : undefined}
            // Roving tabindex: Tab reaches the tablist once, arrows move within it.
            tabIndex={i === rovingIdx ? 0 : -1}
            className="focus-ring"
            onClick={() => { setFocusIdx(i); onChange(t.id); }}
            style={{
              padding: 'var(--lab-s1) var(--lab-s3)',
              fontSize: 'var(--lab-fs-xs)',
              fontFamily: 'var(--lab-font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: active ? 'var(--lab-bg)' : 'var(--lab-ink)',
              background: active ? 'var(--lab-ink)' : 'transparent',
              border: 'none',
              borderRadius: 'calc(var(--lab-r-sm) - 2px)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
