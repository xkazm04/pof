'use client';

import type { LabTheme } from '../theme';

interface Props {
  t: LabTheme;
  catalogInput: string;
  hintInput: string;
  onCatalogChange: (v: string) => void;
  onHintChange: (v: string) => void;
  onStart: () => void;
}

/**
 * Idle-phase form for picking a catalog and optional hint before starting a one-shot run.
 */
export function CatalogPickerForm({ t, catalogInput, hintInput, onCatalogChange, onHintChange, onStart }: Props) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: 14,
    padding: '7px 10px',
    background: t.panel,
    color: t.text,
    border: `1px solid ${t.line}`,
    outline: 'none',
    marginBottom: 10,
    boxSizing: 'border-box',
  };

  return (
    <div>
      <label
        htmlFor="oneshot-catalog"
        className={t.fontMono}
        style={{ display: 'block', fontSize: 12, color: t.muted, marginBottom: 4 }}
      >
        Catalog
      </label>
      <input
        id="oneshot-catalog"
        value={catalogInput}
        onChange={(e) => onCatalogChange(e.target.value)}
        aria-label="catalog"
        style={inputStyle}
      />
      <label
        htmlFor="oneshot-hint"
        className={t.fontMono}
        style={{ display: 'block', fontSize: 12, color: t.muted, marginBottom: 4 }}
      >
        Hint (optional)
      </label>
      <input
        id="oneshot-hint"
        value={hintInput}
        onChange={(e) => onHintChange(e.target.value)}
        placeholder="e.g. focus on under-represented archetypes"
        style={{ ...inputStyle, marginBottom: 12 }}
      />
      <button
        onClick={onStart}
        className={t.fontMono}
        style={{
          width: '100%',
          fontSize: 14,
          padding: '8px 16px',
          cursor: 'pointer',
          background: t.ink,
          color: t.onAccent,
          border: `1px solid ${t.ink}`,
          fontWeight: 600,
        }}
      >
        Analyze
      </button>
    </div>
  );
}
