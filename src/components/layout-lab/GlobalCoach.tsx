'use client';

import { useState } from 'react';
import type { LabTheme } from './theme';
import { useGlobalCoach, GLOBAL_COACH_TOP_N } from './hooks/useGlobalCoach';
import { COACH_HINT, type CoachCandidate, type CoachPriority } from './globalCoachModel';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { retryArtifacts } from './labArtifactCache';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';

interface Props {
  t: LabTheme;
}

/** Priority tint — reinforces the glyph (never the only signal; WCAG 1.4.1). */
function priorityColor(p: CoachPriority, t: LabTheme): string {
  return p === 'fail' ? t.bad : p === 'deferred' || p === 'unproduced' ? t.muted : t.warn;
}

/**
 * Lab-level, cross-catalog next-step coach. Its per-entity sibling (`NextStepCoach`)
 * only coaches inside the open entity; this one answers "what should I do next
 * across the whole project?" — the highest-value moves across every catalog, ranked
 * by the ONE shared ladder in `coachLadder.ts` (fail > drift > pending > deferred >
 * unproduced), aggregated by `useGlobalCoach`/`globalCoachModel.ts`. Because both
 * coaches rank through that same module, they can never name different steps.
 *
 * Unobtrusive by default: one slim row showing the single most-urgent move, with a
 * disclosure that expands the next few (up to `GLOBAL_COACH_TOP_N`) and, when more
 * blockers exist beyond that cut, a "show all N blockers" expansion — the list is
 * never silently truncated. Clicking any entry navigates through the existing
 * one-shot `pendingNavigation` mechanism (LayoutLab's store subscription drives
 * catalog + entity + the flagged `stepIndex`).
 *
 * Distinct from the passive `/status` map: this is *guidance with a jump action*.
 */
export function GlobalCoach({ t }: Props) {
  const { candidates, failedCatalogs } = useGlobalCoach();
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const setPendingNavigation = useOneShotLabStore((s) => s.setPendingNavigation);

  // Nothing actionable AND nothing broken → stay out of the way. A failed fetch alone is
  // still worth the row: silence would read as "the project is clear", which it is not.
  if (candidates.length === 0 && failedCatalogs.length === 0) return null;

  // Carry the flagged step index so Baseline opens ON that step, not step 0.
  const jump = (c: CoachCandidate) => setPendingNavigation({ catalogId: c.catalogId, entityId: c.entityId, stepIndex: c.stepIndex });
  const [top, ...rest] = candidates;
  const failedNames = failedCatalogs.map((f) => f.label).join(', ');
  // Collapsed disclosure shows the rest of the top-N; everything past it is reachable
  // through the explicit "show all blockers" control (so the cap is stated, not hidden).
  const shown = showAll ? rest : rest.slice(0, GLOBAL_COACH_TOP_N - 1);
  const beyond = rest.length - shown.length;
  const moreCount = Math.min(rest.length, GLOBAL_COACH_TOP_N - 1);

  return (
    <section
      data-testid="global-coach"
      aria-label="Project next steps"
      className={t.fontBody}
      style={{
        flex: '0 0 auto',
        display: 'flex', flexDirection: 'column',
        background: 'var(--lab-panel)',
        borderBottom: '1px solid var(--lab-line)',
        borderLeft: `4px solid ${top ? priorityColor(top.priority, t) : t.bad}`,
        ...(t.glass ? { backdropFilter: 'blur(var(--lab-glass-blur))' } : {}),
      }}
    >
      {/* Compact default row: the single most-urgent move + a disclosure for the rest. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--lab-s3)', padding: 'var(--lab-s2) var(--lab-s4)', minWidth: 0 }}>
        <span
          className={t.fontMono}
          style={{ fontSize: 'var(--lab-fs-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--lab-muted)', flexShrink: 0 }}
        >
          Do next
        </span>
        {top ? (
          <CoachRow t={t} c={top} onJump={jump} testid="global-coach-item-0" compact />
        ) : (
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-muted)' }}>
            Nothing to advise — no catalog status could be read.
          </span>
        )}
        {moreCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="global-coach-list"
            data-testid="global-coach-toggle"
            className={`focus-ring ${t.fontMono}`}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--lab-s1)',
              fontSize: 'var(--lab-fs-xs)', padding: 'var(--lab-s1) var(--lab-s2)',
              border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)',
              background: 'transparent', color: 'var(--lab-muted)', cursor: 'pointer',
            }}
          >
            <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>{expanded ? 'less' : `${moreCount} more`}
          </button>
        )}
      </div>

      {/* Failed fetches are STATED, never folded into the advice: those catalogs' steps
          are unknown, not unproduced, so the coach declares the blind spot + a retry. */}
      {failedCatalogs.length > 0 && (
        <div data-testid="global-coach-failed" style={{ padding: '0 var(--lab-s4) var(--lab-s2)' }}>
          <InlineErrorRetry
            dense
            message={`Status unknown for ${failedCatalogs.length} catalog${failedCatalogs.length > 1 ? 's' : ''} (${failedNames}) — excluded from this advice: ${failedCatalogs[0].error}`}
            onRetry={() => { for (const f of failedCatalogs) retryArtifacts(f.catalogId); }}
          />
        </div>
      )}

      {/* Expanded list — the remaining ranked candidates. */}
      {expanded && moreCount > 0 && (
        <ul
          id="global-coach-list"
          data-testid="global-coach-list"
          style={{ listStyle: 'none', margin: 0, padding: '0 var(--lab-s4) var(--lab-s2)', display: 'flex', flexDirection: 'column', gap: 'var(--lab-s1)' }}
        >
          {shown.map((c, i) => (
            <li key={`${c.catalogId}:${c.entityId}`} style={{ display: 'flex', paddingLeft: 'var(--lab-s5, 40px)' }}>
              <CoachRow t={t} c={c} onJump={jump} testid={`global-coach-item-${i + 1}`} />
            </li>
          ))}
          {/* The top-N cut is stated, never silent: everything else is one click away. */}
          {(beyond > 0 || showAll) && (
            <li style={{ display: 'flex', paddingLeft: 'var(--lab-s5, 40px)' }}>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                data-testid="global-coach-show-all"
                className={`focus-ring ${t.fontMono}`}
                style={{
                  fontSize: 'var(--lab-fs-xs)', padding: 'var(--lab-s1) var(--lab-s2)',
                  border: '1px dashed var(--lab-line)', borderRadius: 'var(--lab-r-sm)',
                  background: 'transparent', color: 'var(--lab-muted)', cursor: 'pointer',
                }}
              >
                {showAll
                  ? `Show top ${Math.min(candidates.length, GLOBAL_COACH_TOP_N)} only`
                  : `Show all ${candidates.length} blockers (${beyond} more)`}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/** One clickable candidate row: status glyph + catalog · entity + action hint. */
function CoachRow({
  t, c, onJump, testid, compact,
}: { t: LabTheme; c: CoachCandidate; onJump: (c: CoachCandidate) => void; testid: string; compact?: boolean }) {
  const tint = priorityColor(c.priority, t);
  const hint = COACH_HINT[c.priority];
  // Prefer the concrete checker reason over the generic hint when one is available.
  const shownHint = c.reason ?? hint.hint;
  return (
    <button
      type="button"
      data-testid={testid}
      data-catalog={c.catalogId}
      data-entity={c.entityId}
      data-priority={c.priority}
      data-step-index={c.stepIndex}
      onClick={() => onJump(c)}
      aria-label={`${hint.actionWord}: ${c.entityName} in ${c.catalogLabel} — ${c.step}. ${shownHint}`}
      className={`focus-ring ${t.fontBody}`}
      style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)',
        textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--lab-text)', padding: compact ? 0 : 'var(--lab-s1) 0', fontSize: 'var(--lab-fs-sm)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}
    >
      <span aria-hidden="true" style={{ flexShrink: 0, color: tint, fontWeight: 700, width: 16, textAlign: 'center' }}>{hint.glyph}</span>
      <strong style={{ color: 'var(--lab-ink-deep)', fontWeight: 600, flexShrink: 0 }}>{hint.actionWord}:</strong>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span style={{ color: 'var(--lab-muted)' }}>{c.catalogLabel} · </span>
        <span data-testid={`${testid}-entity`}>{c.entityName}</span>
        <span style={{ color: 'var(--lab-muted)' }}> — {c.step}</span>
        {c.reason && (
          <span data-testid={`${testid}-reason`} style={{ color: 'var(--lab-muted)', fontStyle: 'italic' }}> · {c.reason}</span>
        )}
      </span>
    </button>
  );
}
