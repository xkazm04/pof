'use client';

/**
 * The GTAI Decisions room: the design questions the day lanes ask while the owner is at the machine. Open
 * questions first (newest first), then the answered ones with the answer. Answers are clicks in this page (the
 * Voice room's human gate); the lanes re-read `answers.json` on their own schedule.
 */
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { LabTheme } from '@/components/layout-lab/theme';
import { DecisionCard } from './decisionCard';
import { useDecisionsBoard, useDecisionsGate } from './decisionsData';
import { openRoom } from '../voice/voiceRoomParam';

export function DecisionsRoom({ t, gameId }: { t: LabTheme; gameId: string }) {
  const { read, reread } = useDecisionsBoard(gameId);
  const gate = useDecisionsGate(gameId);
  const b = read.kind === 'ok' ? read.data : null;
  return (
    <section data-testid="decisions-room" aria-labelledby="decisions-title"
      style={{ flex: 1, minHeight: 0, maxWidth: '100vw', boxSizing: 'border-box', overflow: 'auto', color: t.text, padding: 'var(--lab-s4) var(--lab-s6)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignContent: 'start', gap: 'var(--lab-s4)' }}>
      <header style={{ display: 'grid', gap: 'var(--lab-s1)' }}>
        <button type="button" className="focus-ring" onClick={() => openRoom(null)}
          style={{ justifySelf: 'start', background: 'transparent', border: 'none', padding: 0, color: t.muted, cursor: 'pointer', fontSize: 'var(--lab-fs-xs)' }}>← Game home</button>
        <MicroLabel mono uppercase tone="muted">GTAI · Decisions</MicroLabel>
        <h2 id="decisions-title" style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xl)', color: t.inkDeep, margin: 0 }}>Design decisions</h2>
        {b && (
          <span data-testid="decisions-status" style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>
            {b.configured
              ? `${b.open.length} open · ${b.answered.length} answered · reading ${b.root ?? ''} · lanes pick your answers up within about 20 minutes`
              : b.reason}
          </span>
        )}
        {read.kind === 'ok' && read.staleError && <span role="status" style={{ fontSize: 'var(--lab-fs-xs)', color: t.warn }}>Showing the last read; the latest poll failed ({read.staleError}).</span>}
      </header>
      {read.kind === 'loading' && <LoadingRow variant="inline" label="Reading the asks…" />}
      {read.kind === 'error' && <InlineErrorRetry message={`decisions unavailable (${read.message})`} onRetry={reread} />}
      {b?.problems.map((p) => (
        <div key={p.file} role="alert" data-testid="decisions-problem" style={{ fontSize: 'var(--lab-fs-xs)', color: t.warn }}>
          {p.file} is not usable: {p.reason}
        </div>
      ))}
      {b?.configured && (
        <>
          <h3 style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.inkDeep }}>Open</h3>
          {b.open.length === 0
            ? <span data-testid="decisions-empty" style={{ fontSize: 'var(--lab-fs-sm)', color: t.muted }}>Nothing is waiting for you. A question from a lane appears here a few seconds after it writes the ask.</span>
            : b.open.map((d) => <DecisionCard key={d.id} t={t} gameId={gameId} d={d} gate={gate} onSaved={reread} />)}
          {b.answered.length > 0 && (
            <>
              <h3 style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.inkDeep }}>Answered</h3>
              {b.answered.map((d) => <DecisionCard key={d.id} t={t} gameId={gameId} d={d} gate={gate} onSaved={reread} />)}
            </>
          )}
        </>
      )}
    </section>
  );
}
