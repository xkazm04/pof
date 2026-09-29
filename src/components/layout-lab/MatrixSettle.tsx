'use client';

import { useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { StatusTag } from '@/components/ui/StatusTag';
import type { BindIconsSummary } from '@/lib/catalog/acceptance/bindIconsAll';
import type { SettlePassPlan, SettlePlan } from '@/lib/catalog/acceptance/settlePlan';
import type { LabTheme } from './theme';
import { Button } from './ui/Button';
import { describeBindOutcome } from './MatrixBindIcons';
import { invalidateArtifacts } from './labArtifactCache';

/**
 * Matrix header action: re-settle THIS catalog after a campaign — one preview, one confirmed apply.
 *
 * The idempotent filesystem passes (bind-icons → verify-static → verify-packaging) used to be
 * four separate acts: a bind button that POSTed '{}' (every catalog) from inside one catalog's
 * header, two curl-only routes, and every apply blind. **Preview** is
 * `GET /api/pipeline-artifacts/settle?catalogId=` (writes nothing): per pass, in order, how many
 * verdicts would LIFT and how many would DROP and why — a pass → deferred downgrade is a named
 * line before anything is written. **Apply** POSTs `{ catalogId, confirmDrops }` with the drop
 * count the operator just read; if the catalog moved since, the route refuses (409) and the stale
 * preview is dropped. What the editor-bound drains still owe is shown, never run.
 */
interface Remaining { drain?: number; drainPython?: number; needs: string }
interface SettleResponse {
  catalogId: string;
  plan: SettlePlan;
  bindIcons: BindIconsSummary;
  remaining: Remaining[];
  ran?: string[];
}

type Phase = 'idle' | 'previewing' | 'applying';

export function MatrixSettle({ t, catalogId }: { t: LabTheme; catalogId: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<SettleResponse | null>(null);
  const [applied, setApplied] = useState<SettleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    setPhase('previewing');
    setError(null);
    setApplied(null);
    const res = await tryApiFetch<SettleResponse>(`/api/pipeline-artifacts/settle?catalogId=${encodeURIComponent(catalogId)}`);
    setPhase('idle');
    if (!res.ok) { setPreview(null); setError(res.error); return; }
    setPreview(res.data);
  }

  async function runApply() {
    if (!preview) return;
    setPhase('applying');
    setError(null);
    const res = await tryApiFetch<SettleResponse>('/api/pipeline-artifacts/settle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ catalogId, confirmDrops: preview.plan.totals.drops }),
    });
    setPhase('idle');
    // A refusal means the preview on screen is no longer what an apply would do — drop it.
    setPreview(null);
    if (!res.ok) { setError(res.error); return; }
    setApplied(res.data);
    invalidateArtifacts(catalogId); // the grid and coach refetch the settled verdicts
  }

  const busy = phase !== 'idle';
  const shown = applied ?? preview;
  const drops = preview?.plan.totals.drops ?? 0;
  return (
    <div data-testid="matrix-settle" className={t.fontMono}
      style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: t.muted }}>
      <Button mono onClick={() => void runPreview()} disabled={busy} data-testid="settle-preview"
        ariaLabel={`Preview re-settling ${catalogId} — a dry run that writes nothing`}>
        {phase === 'previewing' ? '⏳ Previewing…' : '👁 Preview settle'}
      </Button>
      <Button mono variant="accent" onClick={() => void runApply()} disabled={busy || !preview} data-testid="settle-apply"
        ariaLabel={preview ? `Apply the settle to ${catalogId}, confirming ${drops} drop${drops === 1 ? '' : 's'}` : 'Preview first — apply confirms what the preview showed'}>
        {phase === 'applying' ? '⏳ Applying…' : drops > 0 ? `⚖ Apply · confirm ${drops} drop${drops === 1 ? '' : 's'}` : '⚖ Apply settle'}
      </Button>

      <span data-testid="settle-needs" style={{ flexBasis: '100%', fontSize: 12 }}>
        Re-runs bind-icons → verify-static → verify-packaging for <code>{catalogId}</code> only. Preview writes
        nothing; Apply writes through each pass&apos;s own writer and must confirm every drop the preview showed.
      </span>

      {error && (
        <span data-testid="settle-error" role="status" aria-live="polite" style={{ flexBasis: '100%', fontSize: 12, color: t.bad }}>
          Settle refused or failed — {error}
        </span>
      )}

      {shown && (
        <div data-testid={applied ? 'settle-applied' : 'settle-plan'} role="status" aria-live="polite"
          style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusTag level={shown.plan.totals.drops > 0 ? 'warn' : 'ok'} word={applied ? 'APPLIED' : 'DRY RUN'} />
            <span style={{ color: t.text }}>
              {shown.plan.totals.lifts} {applied ? 'lifted' : 'would lift'} · {shown.plan.totals.drops} {applied ? 'dropped' : 'would drop'}
            </span>
          </span>
          {shown.plan.passes.map((p) => (
            <PassLine key={p.pass} t={t} pass={p} bindHeadline={p.pass === 'bind-icons' ? describeBindOutcome(shown.bindIcons, !!applied).headline : null} />
          ))}
          <span data-testid="settle-remaining">
            Still owed by the editor (not run here):{' '}
            {shown.remaining.map((r) => `${r.drain ?? r.drainPython ?? 0} ${r.drain !== undefined ? 'deferred L3/L4 gates' : 'python steps'} — needs ${r.needs}`).join(' · ')}
          </span>
        </div>
      )}
    </div>
  );
}

/** One pass: its lifts, its drops (the loud half), the moves, and the cause when there is one. */
function PassLine({ t, pass: p, bindHeadline }: { t: LabTheme; pass: SettlePassPlan; bindHeadline: string | null }) {
  return (
    <span data-testid={`settle-pass-${p.pass}`} style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ color: t.inkDeep, fontWeight: 600 }}>{p.pass}</span>
      <span style={{ color: p.lifts ? t.ok : t.muted }}>{p.lifts} lift{p.lifts === 1 ? '' : 's'}</span>
      <span style={{ color: p.drops ? t.bad : t.muted }}>{p.drops} drop{p.drops === 1 ? '' : 's'}</span>
      {p.moves.map((mv) => <span key={mv.label}>{mv.count} × {mv.label}</span>)}
      {p.cause && <span style={{ color: t.warn }}>— {p.cause}{p.remedy ? ` (${p.remedy})` : ''}</span>}
      {bindHeadline && <span>{bindHeadline}</span>}
    </span>
  );
}
