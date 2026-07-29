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
 * (`validate` / a rejecting `onComplete`), instead of silently doing nothing. Reuse this; do
 * not hand-roll a Produce panel.
 *
 * Dispatch is ASYNC by default: the button shows an in-flight "Dispatching…" state that guards
 * against double-dispatch, awaits `onComplete` (which may return a promise), and surfaces a
 * rejection/throw as the inline error reason — plus a "Retry with same prompt" affordance that
 * re-dispatches the exact prompt that just failed. This is the real enforcement path for Rule 4;
 * `sync` is an explicit opt-out kept only for legacy/test call sites. `onComplete` is still
 * INVOKED synchronously inside the click (the store write happens on the event), so a stub-mode
 * produce that writes its artifact synchronously still flips Acceptance immediately — only the
 * success/error message resolves on the microtask.
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
  onComplete: (ctx?: { direction: string; prompt: string }) => void | Promise<void>;
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
   * Explicit opt-out to the legacy SYNCHRONOUS dispatch: no in-flight state, no
   * rejection surfacing. Async is the default (the real Rule 4 enforcement path);
   * `sync` is reserved for legacy/test call sites.
   */
  sync?: boolean;
  /**
   * Minimum time (ms) to hold the async in-flight "Dispatching…" state, so a fast
   * dispatch still reads as work happening. Async only; default 0 (resolve as soon
   * as `onComplete` does).
   */
  minDispatchMs?: number;
}

export function CliProduce({ t, label, buildPrompt, onComplete, note, placeholder, defaultDirection, rows = 4, fields, validate, sync, minDispatchMs }: CliProduceProps) {
  const [direction, setDirection] = useState(defaultDirection ?? '');
  const [showPrompt, setShowPrompt] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dispatching, setDispatching] = useState(false);
  // The last dispatched context, so "Retry with same prompt" re-runs the EXACT prompt
  // that failed (not a rebuild from the — possibly since-edited — direction field).
  const [lastCtx, setLastCtx] = useState<{ direction: string; prompt: string } | null>(null);

  const successMsg = note ?? 'Recorded · step config + prompt saved to the pipeline.';

  async function runAsync(ctx: { direction: string; prompt: string }) {
    setDispatching(true);
    setResult(null);
    const started = Date.now();
    try {
      await Promise.resolve(onComplete(ctx));
      const remaining = (minDispatchMs ?? 0) - (Date.now() - started);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setResult({ ok: true, msg: successMsg });
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Dispatch failed' });
    } finally {
      setDispatching(false);
    }
  }

  function dispatch() {
    if (dispatching) return; // guard against double-dispatch while in flight
    const err = validate?.(direction);
    if (err) { setResult({ ok: false, msg: err }); return; }
    const ctx = { direction, prompt: buildPrompt(direction) };
    setLastCtx(ctx);

    if (sync) {
      // Legacy synchronous opt-out: still catches a throw so it never dies silently.
      try {
        onComplete(ctx);
        setResult({ ok: true, msg: successMsg });
      } catch (e) {
        setResult({ ok: false, msg: e instanceof Error ? e.message : 'Dispatch failed' });
      }
      return;
    }
    void runAsync(ctx);
  }

  function retry() {
    if (dispatching || !lastCtx) return;
    void runAsync(lastCtx);
  }

  const btnLabel = dispatching ? `⏳ Dispatching ${label}` : `⚡ ${label}`;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {fields}
      <Lbl t={t}>Direction (your input)</Lbl>
      <LabTextarea t={t} value={direction} onChange={setDirection} rows={rows} testId="cli-produce-direction"
        placeholder={placeholder ?? 'Steer this step — tone, constraints, references…'} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <LabButton t={t} onClick={dispatch} disabled={dispatching} testId="cli-produce-run">{btnLabel}</LabButton>
        <button onClick={() => setShowPrompt((v) => !v)} className={t.fontMono}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: t.muted, textDecoration: 'underline' }}>
          {showPrompt ? 'hide prompt' : 'view prompt'}
        </button>
      </div>
      {/* Honesty note (functional-honesty): the lab is the design/config surface — it records the
          step config + the exact prompt that drives Acceptance. The real asset is produced by a CLI
          session or the gate drain, not synchronously here. Keeps the UI from overclaiming. */}
      <span className={t.fontMono} style={{ fontSize: 13, color: t.muted, lineHeight: 1.5 }}>
        Records this step&apos;s config + the exact prompt that drives Acceptance. The asset itself is produced by a CLI session or the gate drain — not in this panel.
      </span>
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
      <>
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
      {/* Rule 4 — a failed dispatch can be retried with the EXACT prompt that failed. */}
      {result && !result.ok && lastCtx && (
        <button
          data-testid="cli-produce-retry"
          onClick={retry}
          className={t.fontMono}
          style={{
            justifySelf: 'start', marginTop: 2,
            background: 'none', border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0,
            cursor: 'pointer', fontSize: 13, color: t.text, padding: '4px 10px',
          }}
        >
          ↻ Retry with same prompt
        </button>
      )}
      </>
      )}
    </div>
  );
}
