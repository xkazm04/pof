'use client';

import { useState, type ReactNode } from 'react';
import { Lbl, LabButton, LabTextarea } from '../controls';
import type { LabTheme } from '../../theme';

/**
 * Canonical "Produce" block shared by every pipeline step (CLAUDE.md → Shared Component Manifest).
 *
 * Rule 1 — every CLI/Produce component has a text area for user input + its OWN prompt logic
 * (the `buildPrompt` callback). Rule 4 — production reports a result, or the reason it failed
 * (`validate`), instead of silently doing nothing. Reuse this; do not hand-roll a Produce panel.
 */
export interface CliProduceProps {
  t: LabTheme;
  /** Dispatch button label (a ⚡ glyph is prefixed). */
  label: string;
  /** The step's own prompt logic — turns the user's direction into the CLI prompt. */
  buildPrompt: (direction: string) => string;
  /** Called on a successful dispatch; the step flips its derived Acceptance here. */
  onComplete: () => void;
  /** What the production writes (UE row / asset / DB). Shown on success. */
  note?: string;
  placeholder?: string;
  defaultDirection?: string;
  rows?: number;
  /** Optional structured inputs (numbers/selects) rendered above the direction text area. */
  fields?: ReactNode;
  /** Return an error reason to block dispatch and report it (Rule 4). */
  validate?: (direction: string) => string | null;
}

export function CliProduce({ t, label, buildPrompt, onComplete, note, placeholder, defaultDirection, rows = 4, fields, validate }: CliProduceProps) {
  const [direction, setDirection] = useState(defaultDirection ?? '');
  const [showPrompt, setShowPrompt] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function dispatch() {
    const err = validate?.(direction);
    if (err) { setResult({ ok: false, msg: err }); return; }
    onComplete();
    setResult({ ok: true, msg: note ?? 'Dispatched · written to the UE project + DB.' });
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {fields}
      <Lbl t={t}>Direction (your input)</Lbl>
      <LabTextarea t={t} value={direction} onChange={setDirection} rows={rows} placeholder={placeholder ?? 'Steer this step — tone, constraints, references…'} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <LabButton t={t} onClick={dispatch}>⚡ {label}</LabButton>
        <button onClick={() => setShowPrompt((v) => !v)} className={t.fontMono}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: t.muted, textDecoration: 'underline' }}>
          {showPrompt ? 'hide prompt' : 'view prompt'}
        </button>
      </div>
      {showPrompt && (
        <pre className={t.fontMono} style={{ fontSize: 14, color: t.muted, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.55, padding: 10, border: `1px solid ${t.line}`, borderRadius: t.glass ? 8 : 0 }}>
          {buildPrompt(direction)}
        </pre>
      )}
      {result
        ? <span className={t.fontMono} style={{ fontSize: 14, color: result.ok ? t.ok : t.bad }}>{result.ok ? '✓ ' : '✗ '}{result.msg}</span>
        : note && <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>{note}</span>}
    </div>
  );
}
