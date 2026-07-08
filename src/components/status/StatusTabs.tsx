'use client';

/** The /status header tab switcher: Pipelines (pipeline-centric map) | Item Focus
 *  (entity-centric view). Lab-token styled, keyboard-navigable tablist. */
export type StatusTab = 'pipelines' | 'category' | 'item';

const TABS: { id: StatusTab; label: string }[] = [
  { id: 'pipelines', label: 'Pipelines' },
  { id: 'category', label: 'Category' },
  { id: 'item', label: 'Item Focus' },
];

export function StatusTabs({ tab, onChange }: { tab: StatusTab; onChange: (t: StatusTab) => void }) {
  return (
    <div role="tablist" aria-label="Status view" style={{ display: 'inline-flex', gap: 'var(--lab-s1)', border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)', padding: 2 }}>
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            className="focus-ring"
            onClick={() => onChange(t.id)}
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
