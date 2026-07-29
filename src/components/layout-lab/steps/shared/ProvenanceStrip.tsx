'use client';

import { useState } from 'react';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import type { StepFact } from '@/lib/status/statusModel';
import type { SelectionSource } from './genHistory';
import { mirrorSupport, isPreviewHydratable } from '@/lib/preview/browser-mirror';
import type { AcceptanceExplanation } from '@/lib/catalog/acceptance/explainAcceptance';
import type { JudgeAttribution, VerdictProvenance } from '@/lib/catalog/acceptance/types';
import type { LabTheme } from '../../theme';

/** Verdict-provenance chip copy. `current` is the only one that reads as settled. */
const VERDICT_CHIP: Record<VerdictProvenance, { level: 'ok' | 'warn'; word: string }> = {
  current: { level: 'ok', word: 'VERDICT: CURRENT' },
  stale: { level: 'warn', word: 'VERDICT: STALE' },
  unknown: { level: 'warn', word: 'VERDICT: UNVERIFIED' },
  superseded: { level: 'warn', word: 'VERDICT: SUPERSEDED' },
};

/**
 * Compact per-step PROVENANCE strip — surfaces the audited truth behind a step's
 * Acceptance banner (`step-facts.json`, the 2026-07-07 gap audit) so a green "pass"
 * can never hide a shape-only checker with no judge. It reads three signals from
 * {@link getStepFact}, each colorblind-safe (glyph + word, never hue alone — WCAG
 * 1.4.1) via the shared {@link StatusTag} / {@link MicroLabel} primitives:
 *
 *   • engine   — who ACTUALLY produces the artifact (`trueEngine`).
 *   • judge    — the grader that could prove professional quality, or a loud
 *                `JUDGE: NONE` warning when nothing can.
 *   • checker  — whether the acceptance checker meaningfully validates content,
 *                or is only shape-deep (character-count / field-presence). A
 *                `pass` from a shape-only checker reads visibly caveated.
 *
 * `generatorWired: false` adds a `GENERATOR: NOT WIRED` warning (the step claims a
 * media output no wired generator produces). The full honesty `note` is reachable
 * via an expandable `<details>` (keyboard + screen-reader friendly).
 *
 * DISPLAY ONLY — it never touches acceptance grading. Purely presentational so it
 * is unit-testable in isolation.
 */
export function ProvenanceStrip({ t, fact, selection, judge, explain }: {
  t: LabTheme;
  fact?: StepFact;
  /**
   * Selection provenance for an L1 human-selection (gallery) step. `auto` is the honest
   * reading of the ~47 `selected(...)` gates that the machine satisfies by auto-picking the
   * first candidate of a Produce batch; `human` only after someone actually clicked one.
   * `unrecorded` = a history persisted before the flag existed (never claimed as human).
   * Omit for non-selection steps.
   */
  selection?: SelectionSource;
  /**
   * The judge verdict behind (or NOT behind) this step's status, from
   * `AcceptanceResult.judge`. Rendered as a provenance chip — `stale`/`unknown` is the
   * honest reading of "condemned by a verdict nobody can bind to the content on record".
   */
  judge?: JudgeAttribution;
  /**
   * Lazily reconstruct the acceptance chain for the "Why this grade?" disclosure. Called
   * ONLY while the disclosure is open — it re-runs the step's checker, so it must never be a
   * per-render cost. Display only; it cannot change a verdict.
   */
  explain?: () => AcceptanceExplanation | undefined;
}) {
  // Controlled so `explain()` is invoked only while the reader is actually looking.
  const [openWhy, setOpenWhy] = useState(false);
  const explanation = openWhy ? explain?.() : undefined;
  const chip = judge ? VERDICT_CHIP[judge.provenance] : undefined;
  const chipStyle = {
    fontSize: 13,
    color: t.muted,
    border: `1px solid ${t.line}`,
    padding: '3px 8px',
    borderRadius: t.glass ? 6 : 0,
    whiteSpace: 'nowrap' as const,
  };
  return (
    <div
      data-testid="provenance-strip"
      style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <MicroLabel mono uppercase tone="muted">Provenance</MicroLabel>
        {/* Selection provenance — an L1 "a human chose this" gate must not read as human
            while the machine auto-picked. Glyph+word via StatusTag, never hue alone. */}
        {selection === 'auto' && <StatusTag level="warn" word="SELECTION: AUTO" />}
        {selection === 'human' && <StatusTag level="ok" word="SELECTION: HUMAN" />}
        {selection === 'unrecorded' && (
          <span data-testid="provenance-selection" className={t.fontMono} style={chipStyle}>
            selection: unrecorded
          </span>
        )}
        {fact && (
          <>
            <span data-testid="provenance-engine" className={t.fontMono} style={chipStyle}>
              engine: {fact.trueEngine}
            </span>
            {fact.judge === 'none' ? (
              <StatusTag level="warn" word="JUDGE: NONE" />
            ) : (
              <span data-testid="provenance-judge" className={t.fontMono} style={chipStyle}>
                judge: {fact.judge}
              </span>
            )}
            {fact.checkerMeaningful ? (
              <StatusTag level="ok" word="CHECKER: MEANINGFUL" />
            ) : (
              <StatusTag level="warn" word="CHECKER: SHAPE-ONLY" />
            )}
            {!fact.generatorWired && <StatusTag level="warn" word="GENERATOR: NOT WIRED" />}
            {/* Dual execution: this generated item's step class also runs in the browser
                preview. LIVE = its catalog hydrates the preview runtime today; READY =
                mirrorable class, preview scene not yet built for the catalog. */}
            {mirrorSupport(fact.deliverable, fact.step) !== 'none' && (
              isPreviewHydratable(fact.catalogId) ? (
                <StatusTag level="ok" word="BROWSER MIRROR: LIVE" />
              ) : (
                <span data-testid="provenance-browser" className={t.fontMono} style={chipStyle}>
                  browser mirror: {mirrorSupport(fact.deliverable, fact.step)}
                </span>
              )
            )}
          </>
        )}
        {/* No audited fact for this (catalog, step) — say so rather than rendering a strip
            that silently looks like a clean bill of health. The 2026-07-07 audit covers a
            subset of the fleet's steps; an un-audited step is UNKNOWN, not verified. */}
        {!fact && <StatusTag level="warn" word="PROVENANCE: UNAUDITED" />}
        {/* A recorded judge verdict speaks for this step only as far as it can be bound to
            the content on record. `STALE` / `UNVERIFIED` says so out loud, so a condemnation
            nobody can confirm never reads as settled fact. */}
        {chip && <StatusTag level={chip.level} word={chip.word} />}
      </div>
      {(fact || explain) && (
        <details
          data-testid="provenance-note"
          open={openWhy}
        >
          <summary
            data-testid="provenance-why"
            onClick={(e) => { e.preventDefault(); setOpenWhy((o) => !o); }}
            className={t.fontMono}
            style={{ cursor: 'pointer', color: t.muted, fontSize: 13 }}
          >
            Why this grade?
          </summary>
          {/* The audited note stays in the DOM whether or not the disclosure is open (it is
              static text). Only the CHAIN is deferred — reconstructing it re-runs the
              step's checker, which must be a reader's cost, never a per-render one. */}
          {fact && <p style={{ margin: '6px 0 0', color: t.text, fontSize: 14, lineHeight: 1.5 }}>{fact.note}</p>}
          {explanation && <AcceptanceChain t={t} explanation={explanation} />}
        </details>
      )}
    </div>
  );
}

/**
 * The acceptance chain, inside the strip's existing "Why this grade?" disclosure — no new
 * panel and no new visual language: the same `MicroLabel` / `StatusTag` vocabulary the strip
 * already speaks. Each layer states what it received, what it emitted, and whether it WON;
 * an `allOf` step also names the member that produced the reported status.
 */
function AcceptanceChain({ t, explanation }: { t: LabTheme; explanation: AcceptanceExplanation }) {
  const rowStyle = {
    display: 'grid', gap: 2, padding: '6px 0',
    borderTop: `1px solid ${t.line}`,
  } as const;
  return (
    <div data-testid="acceptance-chain" style={{ marginTop: 8 }}>
      <MicroLabel mono uppercase tone="muted">
        Acceptance chain — decided by {explanation.decidedBy}
      </MicroLabel>
      {explanation.layers.map((l) => (
        <div key={l.id} data-testid={`chain-layer-${l.id}`} data-won={l.won || undefined} style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span className={t.fontMono} style={{ fontSize: 13, color: t.inkDeep, fontWeight: 600 }}>{l.label}</span>
            <span className={t.fontMono} style={{ fontSize: 13, color: t.muted }}>{l.input} → {l.output}</span>
            {l.won && <StatusTag level="warn" word="DECIDED IT" />}
          </div>
          <span style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>{l.note}</span>
          {l.members && (
            <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, display: 'grid', gap: 2 }}>
              {l.members.map((m) => (
                <li key={m.index} data-testid={`chain-member-${m.index}`} data-spoke={m.spoke || undefined}
                  className={t.fontMono} style={{ fontSize: 13, color: m.spoke ? t.inkDeep : t.muted }}>
                  {m.spoke ? '▸ ' : '· '}{m.label} — {m.status} · {m.tier}{m.reason ? ` — ${m.reason}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
