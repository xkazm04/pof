'use client';

/**
 * Global entity type-ahead for the Item Focus tab: matches any catalog's entity by
 * name or id and refocuses the view onto the pick. The whole entity universe is already
 * client-side in the catalog store (seeded from seedAllCatalogs), so this is a pure
 * in-memory filter — no API.
 */
import { useMemo, useState } from 'react';
import { useCatalogStore } from '@/stores/catalogStore';

interface Hit {
  catalogId: string;
  entityId: string;
  name: string;
}

const MAX_HITS = 12;

export function EntitySearch({ onFocus }: { onFocus: (catalogId: string, entityId: string) => void }) {
  const [q, setQ] = useState('');

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

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return all
      .filter((h) => h.name.toLowerCase().includes(needle) || h.entityId.toLowerCase().includes(needle))
      .slice(0, MAX_HITS);
  }, [q, all]);

  return (
    <div style={{ position: 'relative', maxWidth: 520, marginBottom: 'var(--lab-s4)' }}>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search any entity — name or id…"
        aria-label="Search entity to focus"
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
      {hits.length > 0 && (
        <ul
          role="listbox"
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
          {hits.map((h) => (
            <li key={`${h.catalogId}:${h.entityId}`}>
              <button
                type="button"
                onClick={() => { onFocus(h.catalogId, h.entityId); setQ(''); }}
                className="focus-ring"
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 'var(--lab-s2)',
                  padding: 'var(--lab-s1) var(--lab-s2)',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--lab-r-sm)',
                  cursor: 'pointer',
                  color: 'var(--lab-text)',
                }}
              >
                <span style={{ fontSize: 'var(--lab-fs-sm)', fontWeight: 600 }}>{h.name}</span>
                <span style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)' }}>{h.catalogId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
