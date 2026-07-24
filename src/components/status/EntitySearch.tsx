'use client';

/**
 * Global entity type-ahead for the Item Focus tab: matches any catalog's entity by
 * name or id and refocuses the view onto the pick. The whole entity universe is already
 * client-side in the catalog store (seeded from seedAllCatalogs), so this is a pure
 * in-memory filter — no API.
 *
 * Implemented as a WAI-ARIA combobox (input `role="combobox"` + `aria-activedescendant`
 * over non-focusable `role="option"` rows) so it is fully keyboard- and screen-reader-
 * operable: ↓/↑ walk the hits (wrapping), Home/End jump to the ends, Enter focuses the
 * highlighted entity, Escape clears. A query with no hits says so instead of silently
 * rendering nothing, and the hit count is announced via a live region.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalogStore } from '@/stores/catalogStore';

interface Hit {
  catalogId: string;
  entityId: string;
  name: string;
}

const MAX_HITS = 12;
const LISTBOX_ID = 'status-entity-search-listbox';
const optionId = (i: number) => `status-entity-search-option-${i}`;

export function EntitySearch({ onFocus }: { onFocus: (catalogId: string, entityId: string) => void }) {
  const [q, setQ] = useState('');
  // Highlighted option. Clamped during render (never reset from an effect) so the index
  // stays valid as the hit list shrinks under the user's typing.
  const [activeRaw, setActiveRaw] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Select the stable store slice, then flatten into a search index in a memo. (Selecting
  // a freshly-built array here would defeat useSyncExternalStore's snapshot caching.)
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const all = useMemo(() => {
    const out: Hit[] = [];
    for (const [catalogId, byId] of Object.entries(entitiesByCatalog)) {
      for (const e of Object.values(byId)) out.push({ catalogId, entityId: e.id, name: e.name });
    }
    return out;
  }, [entitiesByCatalog]);

  const needle = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!needle) return [];
    return all
      .filter((h) => h.name.toLowerCase().includes(needle) || h.entityId.toLowerCase().includes(needle))
      .slice(0, MAX_HITS);
  }, [needle, all]);

  const open = needle.length > 0;
  const hasHits = hits.length > 0;
  const active = hasHits ? Math.min(activeRaw, hits.length - 1) : 0;

  // Keep the highlighted row visible when arrowing past the popup's scroll edge.
  // (Guarded call — jsdom provides no scrollIntoView.)
  useEffect(() => {
    listRef.current?.querySelector('[role="option"][aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const select = (h: Hit) => {
    onFocus(h.catalogId, h.entityId);
    setQ('');
    setActiveRaw(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (q) e.preventDefault();
      setQ('');
      setActiveRaw(0);
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
    <div style={{ position: 'relative', maxWidth: 520, marginBottom: 'var(--lab-s4)' }}>
      <input
        type="text"
        role="combobox"
        value={q}
        onChange={(e) => { setQ(e.target.value); setActiveRaw(0); }}
        onKeyDown={onKeyDown}
        placeholder="Search any entity — name or id…"
        aria-label="Search entity to focus"
        aria-expanded={hasHits}
        aria-controls={hasHits ? LISTBOX_ID : undefined}
        aria-autocomplete="list"
        aria-activedescendant={hasHits ? optionId(active) : undefined}
        autoComplete="off"
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
      <span role="status" aria-live="polite" className="sr-only">
        {open ? (hits.length ? `${hits.length} entit${hits.length === 1 ? 'y' : 'ies'} match` : 'No entity matches') : ''}
      </span>

      {/* A query with no hits says so, rather than silently rendering nothing. Kept OUT of
          the listbox so the listbox only ever contains `option` children. */}
      {open && !hasHits && (
        <div
          style={{
            position: 'absolute',
            zIndex: 10,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            padding: 'var(--lab-s2)',
            fontSize: 'var(--lab-fs-xs)',
            color: 'var(--lab-muted)',
            background: 'var(--lab-bg)',
            border: '1px solid var(--lab-line)',
            borderRadius: 'var(--lab-r-sm)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          No entity matches “{q.trim()}” — try a shorter name, or search by id.
        </div>
      )}

      {hasHits && (
        <ul
          ref={listRef}
          id={LISTBOX_ID}
          role="listbox"
          aria-label="Matching entities"
          style={{
            position: 'absolute',
            zIndex: 10,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            margin: 0,
            padding: 'var(--lab-s1)',
            listStyle: 'none',
            background: 'var(--lab-bg)',
            border: '1px solid var(--lab-line)',
            borderRadius: 'var(--lab-r-sm)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {hits.map((h, i) => (
            <li
              key={`${h.catalogId}:${h.entityId}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
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
              <span style={{ fontSize: 'var(--lab-fs-sm)', fontWeight: 600 }}>{h.name}</span>
              <span style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)' }}>{h.catalogId}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
