'use client';

/**
 * One `role="option"` row of {@link SearchCombobox} (badge · label · detail … meta).
 * Extracted so the combobox file holds the behaviour and this holds the row markup;
 * typed results and the recall ("Recent") list render through the same row.
 */

import type { SearchHit } from './SearchCombobox';

interface SearchOptionProps<P> {
  hit: SearchHit<P>;
  id: string;
  active: boolean;
  testId: string;
  onHover: () => void;
  onPick: () => void;
}

const SUBTLE_MONO: React.CSSProperties = { fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--text-subtle)' };

export function SearchOption<P>({ hit: h, id, active, testId, onHover, onPick }: SearchOptionProps<P>) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      data-testid={testId}
      // Keep focus in the input so aria-activedescendant stays authoritative.
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={onHover}
      onClick={onPick}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 'var(--lab-s2)',
        padding: 'var(--lab-s1) var(--lab-s2)',
        borderRadius: 'var(--lab-r-sm)',
        cursor: 'pointer',
        color: 'var(--lab-text)',
        background: active ? 'color-mix(in srgb, var(--lab-ink) 14%, transparent)' : 'transparent',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--lab-s2)', minWidth: 0 }}>
        {h.badge && (
          <span
            style={{
              ...SUBTLE_MONO, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.08em',
              border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)', padding: '0 4px',
            }}
          >
            {h.badge}
          </span>
        )}
        <span style={{ fontSize: 'var(--lab-fs-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.label}</span>
        {h.detail && <span style={{ ...SUBTLE_MONO, whiteSpace: 'nowrap' }}>{h.detail}</span>}
      </span>
      {h.meta && <span style={{ ...SUBTLE_MONO, flexShrink: 0 }}>{h.meta}</span>}
    </li>
  );
}
