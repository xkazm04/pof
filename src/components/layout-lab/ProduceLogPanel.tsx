'use client';

import { useState } from 'react';
import { StatusTag } from '@/components/ui/StatusTag';
import { buildProduceLog, summarizeProduceLog, type ProduceLogEntry, type ProduceLogOutcome } from './produceLog';
import type { LabStepArtifact } from './labPipelineStore';
import type { LabTheme } from './theme';

/** Glyph + word per outcome (colourblind-safe: never hue alone — WCAG 1.4.1). */
const OUTCOME_TAG: Record<ProduceLogOutcome, { level: 'ok' | 'warn' | 'bad'; word: string }> = {
  produced: { level: 'ok', word: 'PRODUCED' },
  failed: { level: 'bad', word: 'FAILED' },
  unsynced: { level: 'warn', word: 'NOT SAVED' },
};

/** ISO → a readable stamp. Derived from the artifact, never from a render-time clock
 *  (`Date.now()` in render is a react-hooks/purity error, and it would also lie on rehydrate). */
function stamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Per-entity produce log — the pipeline's own history, and the inbox for anything that
 * went wrong on a step nobody currently has open.
 *
 * Everything here was already persisted (`produceDirection`, `error`, `syncError`); it was
 * simply unreachable unless you clicked into the exact step and expanded the right panel.
 * The header count is the point: a failure two steps back is legible without opening it.
 *
 * Collapsed by default, and it never opens itself — but a needs-attention count is shown in
 * the summary line whether it is open or not, because a silent inbox is not an inbox.
 */
export function ProduceLogPanel({ t, steps, byStep, onJump }: {
  t: LabTheme;
  steps: readonly string[];
  byStep: Record<string, LabStepArtifact> | undefined;
  /** Jump to a step by pipeline index. Not offered for an orphaned (-1) entry. */
  onJump: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const log = buildProduceLog(steps, byStep);
  const sum = summarizeProduceLog(log);

  if (!sum.total) return null; // nothing has run — an empty log is noise, not information

  return (
    <div data-testid="produce-log" data-attention={sum.needsAttention} style={{ padding: '0 18px 10px' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="produce-log-body"
        data-testid="produce-log-toggle"
        className={`focus-ring ${t.fontMono}`}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, padding: '6px 10px', cursor: 'pointer',
          border: `1px solid ${sum.needsAttention ? t.bad : t.line}`,
          borderRadius: t.glass ? 6 : 0, background: 'transparent', color: t.text,
        }}
      >
        <span aria-hidden>{open ? '▴' : '▾'}</span>
        <span>Produce log · {sum.total}</span>
        {sum.needsAttention > 0 && (
          <span data-testid="produce-log-attention" style={{ marginLeft: 'auto', color: t.bad, fontWeight: 700 }}>
            {sum.needsAttention} need{sum.needsAttention === 1 ? 's' : ''} attention
          </span>
        )}
      </button>

      {open && (
        <ul
          id="produce-log-body"
          data-testid="produce-log-entries"
          style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {log.map((e) => <LogRow key={`${e.step}:${e.at}`} t={t} e={e} onJump={onJump} />)}
        </ul>
      )}
    </div>
  );
}

function LogRow({ t, e, onJump }: { t: LabTheme; e: ProduceLogEntry; onJump: (index: number) => void }) {
  const tag = OUTCOME_TAG[e.outcome];
  return (
    <li
      data-testid="produce-log-entry"
      data-step={e.step}
      data-outcome={e.outcome}
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '8px 10px', border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0,
        borderLeft: `3px solid ${e.outcome === 'failed' ? t.bad : e.outcome === 'unsynced' ? t.warn : t.line}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <StatusTag level={tag.level} word={tag.word} />
        {e.index >= 0 ? (
          <button
            type="button"
            onClick={() => onJump(e.index)}
            data-testid="produce-log-jump"
            className={`focus-ring ${t.fontMono}`}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: t.inkDeep, fontWeight: 600, textDecoration: 'underline' }}
          >
            {e.step}
          </button>
        ) : (
          // Orphaned: an artifact for a step this pipeline no longer declares. Shown, not
          // hidden — but with nowhere to jump, and said plainly rather than as a dead link.
          <span data-testid="produce-log-orphan" className={t.fontMono} style={{ fontSize: 13, color: t.muted }}>
            {e.step} · no longer in this pipeline
          </span>
        )}
        <span className={t.fontMono} style={{ marginLeft: 'auto', fontSize: 12, color: t.muted }}>{stamp(e.at)}</span>
      </div>

      {e.reason && (
        <span data-testid="produce-log-reason" style={{ fontSize: 13, color: e.outcome === 'failed' ? t.bad : t.warn, lineHeight: 1.45 }}>
          {e.reason}
          {e.outcome === 'failed' && e.hasContent && (
            <span style={{ color: t.muted }}> · the previous run’s content is still here.</span>
          )}
        </span>
      )}

      {/* What was actually ASKED for. An empty direction is stated as such — a produce
          dispatched on the step's default is not the same as one nobody recorded. */}
      <span data-testid="produce-log-direction" className={t.fontMono} style={{ fontSize: 12, color: t.muted, lineHeight: 1.45 }}>
        {e.direction
          ? `“${e.direction}”${e.hadPrompt ? '' : ' · no CLI prompt (deterministic produce)'}`
          : 'no direction recorded'}
        {e.status ? ` · server: ${e.status}${e.tier ? ` (${e.tier})` : ''}` : ''}
      </span>
    </li>
  );
}
