'use client';

/**
 * Shared type-ahead combobox for the lab + `/status` search surfaces.
 *
 * Extracted from `status/EntitySearch` (which was the ONLY search in the app) so the
 * lab-wide search and the Item-Focus entity search share one accessible implementation
 * instead of two. It owns everything that is not domain-specific:
 *
 * - WAI-ARIA combobox wiring: input `role="combobox"` + `aria-activedescendant` over
 *   non-focusable `role="option"` rows, so it is keyboard- AND screen-reader-operable.
 * - Keys: ↓/↑ walk the hits (wrapping), Home/End jump to the ends, Enter selects,
 *   Escape clears the query (and calls `onDismiss` when it is already empty).
 * - Honest empty states: "no match" vs "nothing loaded yet" are different situations
 *   and are worded differently; the hit count is announced through a live region.
 * - The `maxHits` cap is never silent — the footer states "Showing N of M".
 *
 * The caller supplies only the domain: a pure `search(needle)` returning the FULL match
 * set (the cap is applied here) and what to do with the chosen hit.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchHit<P = unknown> {
  /** Stable identity — React key + option id base. */
  key: string;
  /** Primary text. */
  label: string;
  /** Secondary text beside the label (e.g. the id that actually matched). */
  detail?: string;
  /** Right-aligned context (e.g. the catalog id). */
  meta?: string;
  /** Small leading kind tag ("catalog" / "entity" / "step"). */
  badge?: string;
  /** Whatever the caller needs back on select. */
  payload: P;
}

export interface SearchComboboxProps<P> {
  /** Pure filter over the caller's universe; returns EVERY match (uncapped). */
  search: (needle: string) => SearchHit<P>[];
  onSelect: (hit: SearchHit<P>) => void;
  placeholder: string;
  /** Accessible name for the input. */
  ariaLabel: string;
  /** Unique prefix for the listbox/option ids (two comboboxes can coexist). */
  idPrefix: string;
  maxHits?: number;
  /** True when there is nothing to search at all (unseeded store) — a different
   *  message from "your query matched nothing". */
  emptyUniverse?: boolean;
  /** Escape on an already-empty query (or a click-away owner) — e.g. close the overlay. */
  onDismiss?: () => void;
  autoFocus?: boolean;
  /** Footer key hint; defaults to the keys this component actually handles. */
  hintKeys?: string;
  /** Noun used in the empty-state copy ("entity", "result"). */
  noun?: string;
}

const DEFAULT_MAX_HITS = 12;

// Popup chrome shared by the listbox and the no-match message so both hang off the input
// identically (one source of truth for the overlay's box).
const POPUP_SHELL: React.CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  background: 'var(--lab-bg)',
  border: '1px solid var(--lab-line)',
  borderRadius: 'var(--lab-r-sm)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
};

export function SearchCombobox<P>({
  search,
  onSelect,
  placeholder,
  ariaLabel,
  idPrefix,
  maxHits = DEFAULT_MAX_HITS,
  emptyUniverse = false,
  onDismiss,
  autoFocus,
  hintKeys = '↑↓ browse · ↵ open · esc close',
  noun = 'result',
}: SearchComboboxProps<P>) {
  const [q, setQ] = useState('');
  // Highlighted option. Clamped during render (never reset from an effect) so the index
  // stays valid as the hit list shrinks under the user's typing.
  const [activeRaw, setActiveRaw] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const needle = q.trim().toLowerCase();
  // Full match set first, capped list second — so the cap can be reported rather than hidden.
  const matches = useMemo(() => (needle ? search(needle) : []), [needle, search]);
  const hits = useMemo(() => matches.slice(0, maxHits), [matches, maxHits]);

  const open = needle.length > 0;
  const hasHits = hits.length > 0;
  const hidden = matches.length - hits.length;
  const active = hasHits ? Math.min(activeRaw, hits.length - 1) : 0;
  const optionId = (i: number) => `${idPrefix}-option-${i}`;
  const listboxId = `${idPrefix}-listbox`;

  const liveText = !open
    ? ''
    : hasHits
      ? `${matches.length} ${noun}${matches.length === 1 ? '' : 's'} match${hidden > 0 ? `, showing first ${hits.length}` : ''}`
      : emptyUniverse
        ? 'Nothing loaded yet'
        : `No ${noun} matches`;

  // Keep the highlighted row visible when arrowing past the popup's scroll edge.
  // (Guarded call — jsdom provides no scrollIntoView.)
  useEffect(() => {
    listRef.current?.querySelector('[role="option"][aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const select = (h: SearchHit<P>) => {
    onSelect(h);
    setQ('');
    setActiveRaw(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // A non-empty query "eats" the first Escape: stop it reaching an owning overlay
      // (Modal closes on Escape) so clearing the query never also closes the search.
      if (q) { e.stopPropagation(); setQ(''); setActiveRaw(0); return; }
      onDismiss?.();
      return;
    }
    if (!hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveRaw((i) => (Math.min(i, hits.length - 1) + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveRaw((i) => (Math.min(i, hits.length - 1) + hits.length - 1) % hits.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveRaw(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveRaw(hits.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(hits[active]);
    }
  };

  return (
    <div style={{ position: 'relative' }} data-testid={`${idPrefix}-root`}>
      <input
        type="text"
        role="combobox"
        value={q}
        onChange={(e) => { setQ(e.target.value); setActiveRaw(0); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={hasHits}
        aria-controls={hasHits ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={hasHits ? optionId(active) : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        data-testid={`${idPrefix}-input`}
        className="focus-ring"
        style={{
          width: '100%',
          padding: 'var(--lab-s2) var(--lab-s3)',
          fontSize: 'var(--lab-fs-sm)',
          fontFamily: 'var(--lab-font-mono)',
          color: 'var(--lab-text)',
          background: 'color-mix(in srgb, var(--lab-ink) 6%, transparent)',
          border: '1px solid var(--lab-line)',
          borderRadius: 'var(--lab-r-sm)',
        }}
      />

      {/* Result count for screen readers — the visual popup is the sighted equivalent. */}
      <span role="status" aria-live="polite" className="sr-only">{liveText}</span>

      {/* A query with no hits says so, rather than silently rendering nothing. Kept OUT of
          the listbox so the listbox only ever contains `option` children. */}
      {open && !hasHits && (
        <div
          data-testid={`${idPrefix}-empty`}
          style={{ ...POPUP_SHELL, padding: 'var(--lab-s2)', fontSize: 'var(--lab-fs-xs)', color: 'var(--text-subtle)' }}
        >
          {emptyUniverse
            ? 'Nothing is loaded yet — nothing to search.'
            : `No ${noun} matches “${q.trim()}” — try a shorter name, or search by id.`}
        </div>
      )}

      {hasHits && (
        <div style={POPUP_SHELL}>
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            style={{ margin: 0, padding: 'var(--lab-s1)', listStyle: 'none', maxHeight: 320, overflowY: 'auto' }}
          >
            {hits.map((h, i) => (
              <li
                key={h.key}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                data-testid={`${idPrefix}-option`}
                // Keep focus in the input so aria-activedescendant stays authoritative.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveRaw(i)}
                onClick={() => select(h)}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 'var(--lab-s2)',
                  padding: 'var(--lab-s1) var(--lab-s2)',
                  borderRadius: 'var(--lab-r-sm)',
                  cursor: 'pointer',
                  color: 'var(--lab-text)',
                  background: i === active ? 'color-mix(in srgb, var(--lab-ink) 14%, transparent)' : 'transparent',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--lab-s2)', minWidth: 0 }}>
                  {h.badge && (
                    <span
                      style={{
                        flexShrink: 0, fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)',
                        textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)',
                        border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)', padding: '0 4px',
                      }}
                    >
                      {h.badge}
                    </span>
                  )}
                  <span style={{ fontSize: 'var(--lab-fs-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.label}</span>
                  {h.detail && (
                    <span style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>{h.detail}</span>
                  )}
                </span>
                {h.meta && (
                  <span style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--text-subtle)', flexShrink: 0 }}>{h.meta}</span>
                )}
              </li>
            ))}
          </ul>

          {/* Footer: the cap is stated (never a silent truncation) and the keys that drive
              this combobox are discoverable without a screen reader. */}
          <div
            style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--lab-s2)',
              padding: 'var(--lab-s1) var(--lab-s2)', borderTop: '1px solid var(--lab-line)',
              fontSize: 'var(--lab-fs-xs)', color: 'var(--text-subtle)',
            }}
          >
            <span>{hintKeys}</span>
            {hidden > 0 && (
              <span style={{ flexShrink: 0 }}>Showing {hits.length} of {matches.length} — keep typing to narrow</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
