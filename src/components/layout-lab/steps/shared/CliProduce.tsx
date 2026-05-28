'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  /**
   * Called on a successful dispatch; the step flips its derived Acceptance here.
   * Receives the user's typed `direction` + the built `prompt` so generative steps
   * can stamp the batch they produce with the art direction (optional — zero-arg
   * handlers stay valid).
   */
  onComplete: (ctx?: { direction: string; prompt: string }) => void;
  /** What the production writes (UE row / asset / DB). Shown on success. */
  note?: string;
  placeholder?: string;
  defaultDirection?: string;
  rows?: number;
  /** Optional structured inputs (numbers/selects) rendered above the direction text area. */
  fields?: ReactNode;
  /** Return an error reason to block dispatch and report it (Rule 4). */
  validate?: (direction: string) => string | null;
  /**
   * When set, dispatch becomes async: the button shows a disabled "Dispatching…"
   * state that guards against double-dispatch, awaits `onComplete` (which may
   * return a promise), surfaces a rejection as the error, and holds the in-flight
   * state at least this many ms. When omitted, dispatch is synchronous (legacy).
   */
  minDispatchMs?: number;
}

export function CliProduce({ t, label, buildPrompt, onComplete, note, placeholder, defaultDirection, rows = 4, fields, validate, minDispatchMs }: CliProduceProps) {
  const [direction, setDirection] = useState(defaultDirection ?? '');
  const [showPrompt, setShowPrompt] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dispatching, setDispatching] = useState(false);

  async function dispatch() {
    if (dispatching) return; // guard against double-dispatch while in flight
    const err = validate?.(direction);
    if (err) { setResult({ ok: false, msg: err }); return; }
    const ctx = { direction, prompt: buildPrompt(direction) };
    const successMsg = note ?? 'Dispatched · written to the UE project + DB.';

    if (!minDispatchMs) {
      // Legacy synchronous path (unchanged behavior).
      onComplete(ctx);
      setResult({ ok: true, msg: successMsg });
      return;
    }

    setDispatching(true);
    setResult(null);
    const started = Date.now();
    try {
      await Promise.resolve(onComplete(ctx));
      const remaining = minDispatchMs - (Date.now() - started);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setResult({ ok: true, msg: successMsg });
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Dispatch failed' });
    } finally {
      setDispatching(false);
    }
  }

  const btnLabel = dispatching ? `⏳ Dispatching ${label}` : minDispatchMs ? `⚡ ${label} (dispatch)` : `⚡ ${label}`;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {fields}
      <Lbl t={t}>Direction (your input)</Lbl>
      <LabTextarea t={t} value={direction} onChange={setDirection} rows={rows} placeholder={placeholder ?? 'Steer this step — tone, constraints, references…'} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <LabButton t={t} onClick={dispatch} disabled={dispatching}>{btnLabel}</LabButton>
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
      {dispatching ? (
        <div data-testid="cli-produce-dispatching" className={t.fontMono} style={{ fontSize: 14, color: t.muted, display: 'grid', gap: 2 }}>
          <span>Dispatching…</span>
          <span style={{ color: t.muted }}>CLI dispatch in flight…</span>
        </div>
      ) : (
      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.span
            key={`${result.ok ? 'ok' : 'err'}-${result.msg}`}
            data-testid="cli-produce-result"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={t.fontMono}
            style={{ fontSize: 14, color: result.ok ? t.ok : t.bad }}
          >
            {result.ok ? '✓ ' : '✗ '}{result.msg}
          </motion.span>
        ) : note ? (
          <motion.span
            key="note"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={t.fontMono}
            style={{ fontSize: 14, color: t.muted }}
          >
            {note}
          </motion.span>
        ) : null}
      </AnimatePresence>
      )}
    </div>
  );
}
