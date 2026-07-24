'use client';

import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import type { StepFact } from '@/lib/status/statusModel';
import { mirrorSupport, isPreviewHydratable } from '@/lib/preview/browser-mirror';
import type { LabTheme } from '../../theme';

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
export function ProvenanceStrip({ t, fact }: { t: LabTheme; fact: StepFact }) {
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
      </div>
      <details data-testid="provenance-note">
        <summary className={t.fontMono} style={{ cursor: 'pointer', color: t.muted, fontSize: 13 }}>
          Why this grade?
        </summary>
        <p style={{ margin: '6px 0 0', color: t.text, fontSize: 14, lineHeight: 1.5 }}>{fact.note}</p>
      </details>
    </div>
  );
}
