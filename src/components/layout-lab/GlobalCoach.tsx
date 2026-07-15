'use client';

import { useState } from 'react';
import type { LabTheme } from './theme';
import { useGlobalCoach } from './hooks/useGlobalCoach';
import { COACH_HINT, type CoachCandidate, type CoachPriority } from './globalCoachModel';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';

interface Props {
  t: LabTheme;
}

/** Priority tint — reinforces the glyph (never the only signal; WCAG 1.4.1). */
function priorityColor(p: CoachPriority, t: LabTheme): string {
  return p === 'fail' ? t.bad : p === 'deferred' ? t.muted : t.warn;
}

/**
 * Lab-level, cross-catalog next-step coach. Its per-entity sibling (`NextStepCoach`)
 * only coaches inside the open entity; this one answers "what should I do next
 * across the whole project?" — the top-N highest-value moves ranked fail > drift >
 * pending > deferred (see `globalCoach.ts` / `useGlobalCoach`).
 *
 * Unobtrusive by default: one slim row showing the single most-urgent move, with a
 * disclosure that expands the full top-N list. Clicking any entry navigates through
 * the existing one-shot `pendingNavigation` mechanism (LayoutLab's store subscription
 * drives catalog + entity) — entity-level, since that payload does not carry a step.
 *
 * Distinct from the passive `/status` map: this is *guidance with a jump action*.
 */
export function GlobalCoach({ t }: Props) {
  const candidates = useGlobalCoach();
  const [expanded, setExpanded] = useState(false);
  const setPendingNavigation = useOneShotLabStore((s) => s.setPendingNavigation);

  if (candidates.length === 0) return null; // nothing actionable project-wide — stay out of the way

  // Carry the flagged step index so Baseline opens ON that step, not step 0.
  const jump = (c: CoachCandidate) => setPendingNavigation({ catalogId: c.catalogId, entityId: c.entityId, stepIndex: c.stepIndex });
  const [top, ...rest] = candidates;
  const moreCount = rest.length;

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
        borderLeft: `4px solid ${priorityColor(top.priority, t)}`,
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
        <CoachRow t={t} c={top} onJump={jump} testid="global-coach-item-0" compact />
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

      {/* Expanded list — the remaining ranked candidates. */}
      {expanded && moreCount > 0 && (
        <ul
          id="global-coach-list"
          data-testid="global-coach-list"
          style={{ listStyle: 'none', margin: 0, padding: '0 var(--lab-s4) var(--lab-s2)', display: 'flex', flexDirection: 'column', gap: 'var(--lab-s1)' }}
        >
          {rest.map((c, i) => (
            <li key={`${c.catalogId}:${c.entityId}`} style={{ display: 'flex', paddingLeft: 'var(--lab-s5, 40px)' }}>
              <CoachRow t={t} c={c} onJump={jump} testid={`global-coach-item-${i + 1}`} />
            </li>
          ))}
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
