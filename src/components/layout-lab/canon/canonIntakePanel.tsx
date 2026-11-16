'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LabTheme } from '../theme';
import type { GameId } from '@/lib/games/types';
import type { IntakeDecision, IntakeProposalKind, StoredIntakeProposal } from '@/lib/games/intake/types';
import { GAMES } from '@/lib/games/registry';
import { tryApiFetch } from '@/lib/api-utils';
import type { Result } from '@/types/result';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { LabButton } from '../steps/controls';
import { useCanonStore } from '../canonStore';
import { CanonIntakeRow } from './canonIntakeRow';

/** `GET /api/games/<id>/intake` payload. */
export interface IntakeView {
  proposals: StoredIntakeProposal[];
  pending: number;
  pitch: { placeholder: boolean };
}

const KINDS: { kind: IntakeProposalKind; label: string }[] = [{ kind: 'rule', label: 'Proposed rules' }, { kind: 'entity', label: 'Proposed entities' }];
const base = (gameId: GameId) => `/api/games/${gameId}/intake`;
const jsonInit = (method: string, body?: unknown): RequestInit =>
  ({ method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

/** Reason the Run button is disabled, or null when a run may start. */
export function runBlockedReason(gameId: GameId, view: IntakeView | null): string | null {
  if (!view) return 'loading the intake';
  return view.pitch.placeholder ? `no pitch yet: games/${gameId}/pitch.md is a placeholder` : null;
}

/**
 * The active game's pitch-intake review (spark gtai-uprising-project, WP3): proposals grouped by kind,
 * each with the pitch quote it came from and accept/reject; a confirmed bulk "accept all rules"; and
 * "Run intake", which dispatches a server-side CLI session (the one-shot seam) and stores its reply as
 * pending proposals. Nothing reaches the canon or the catalogs without an accept.
 */
export function CanonIntakePanel({ t, gameId }: { t: LabTheme; gameId: GameId }) {
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; result: Result<IntakeView, string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<{ msg: string; retry: () => void } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const key = `${gameId}:${version}`;

  useEffect(() => {
    let live = true;
    void tryApiFetch<IntakeView>(base(gameId)).then((result) => { if (live) setLoaded({ key: `${gameId}:${version}`, result }); });
    return () => { live = false; };
  }, [gameId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const view = loaded?.result.ok ? loaded.result.data : null;

  const act = useCallback((run: () => Promise<Result<unknown, string>>, label: string, rulesTouched: boolean): Promise<void> => {
    // Retry re-runs THIS attempt (same request), so the closure names itself rather than `act`.
    const attempt = async (): Promise<void> => {
      setBusy(true);
      setActionError(null);
      const r = await run();
      setBusy(false);
      if (!r.ok) setActionError({ msg: `${label} failed: ${r.error}`, retry: () => { void attempt(); } });
      if (rulesTouched) void useCanonStore.getState().hydrate();
      reload();
    };
    return attempt();
  }, [reload]);

  const decide = (id: string, decision: IntakeDecision) =>
    void act(() => tryApiFetch(base(gameId), jsonInit('PATCH', { id, decision })), decision === 'accept' ? 'Accept' : 'Reject', decision === 'accept');
  const runIntake = () => void act(() => tryApiFetch(`${base(gameId)}/run`, jsonInit('POST')), 'Run intake', false);

  const pendingRules = (view?.proposals ?? []).filter((p) => p.kind === 'rule' && p.status === 'pending');
  const acceptAllRules = async () => {
    for (const p of pendingRules) {
      const r = await tryApiFetch(base(gameId), jsonInit('PATCH', { id: p.id, decision: 'accept' }));
      if (!r.ok) { void useCanonStore.getState().hydrate(); reload(); throw new Error(`${p.rule?.id ?? p.id}: ${r.error}`); }
    }
    void useCanonStore.getState().hydrate();
    reload();
  };

  const blocked = runBlockedReason(gameId, view);
  return (
    <section aria-label="Pitch intake" data-testid="canon-intake-panel" style={{ borderBottom: `1px solid ${t.line}`, paddingBottom: 20, marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <h3 className={t.fontMono} style={{ fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink, fontWeight: 600, margin: 0, flex: 1 }}>
          Pitch intake · {GAMES[gameId].title}
        </h3>
        <LabButton t={t} onClick={runIntake} disabled={busy || blocked !== null} testId="canon-intake-run">Run intake</LabButton>
        {pendingRules.length > 0 && (
          <LabButton t={t} onClick={() => setConfirmBulk(true)} disabled={busy} testId="canon-intake-accept-rules">Accept all rules ({pendingRules.length})</LabButton>
        )}
      </div>
      <p data-testid="canon-intake-run-note" className={t.fontBody} style={{ fontSize: 14, color: t.muted, margin: '0 0 12px' }}>
        {blocked ?? 'Run intake spends model budget: a Claude session reads the pitch and proposes rules + starter entities for review.'}
      </p>
      {busy && <LoadingRow label="Working on the intake…" variant="inline" />}
      {actionError && <InlineErrorRetry message={actionError.msg} onRetry={actionError.retry} onDismiss={() => setActionError(null)} />}
      {(!loaded || (loaded.key !== key && !loaded.result.ok)) && <LoadingRow label="Loading intake proposals…" variant="inline" />}
      {loaded && !loaded.result.ok && <InlineErrorRetry message={`Intake unavailable: ${loaded.result.error}`} onRetry={reload} />}
      {view && view.proposals.length === 0 && (
        <p data-testid="canon-intake-empty" className={t.fontBody} style={{ fontSize: 14, color: t.muted, fontStyle: 'italic' }}>no proposals</p>
      )}
      {view && KINDS.map(({ kind, label }) => {
        const rows = view.proposals.filter((p) => p.kind === kind);
        if (rows.length === 0) return null;
        return (
          <div key={kind} data-testid={`canon-intake-group-${kind}`} style={{ marginTop: 12 }}>
            <div className={t.fontMono} style={{ fontSize: 13, color: t.muted, margin: '0 0 8px' }}>{label} · {rows.length}</div>
            {rows.map((p) => <CanonIntakeRow key={p.id} t={t} proposal={p} busy={busy} onDecide={decide} />)}
          </div>
        );
      })}
      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={acceptAllRules}
        title={`Accept all ${pendingRules.length} proposed rules?`}
        description={`Each rule is written to games/${gameId}/canon.json and the canon DB, and enters every ${GAMES[gameId].title} produce prompt.`}
        confirmLabel="Accept all"
        destructive={false}
      />
    </section>
  );
}
