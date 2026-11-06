'use client';

/**
 * One casting round: its brief (what it tries), the sample text every candidate speaks, the candidates, and,
 * while open, the owner's round comment + "Close round" (refused while a candidate has no verdict). A closed or
 * cast round renders read-only, as history.
 */
import { useState } from 'react';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LabButton, LabTextarea } from '@/components/layout-lab/steps/controls';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { RoundView } from '@/lib/voice/castingDb';
import { postVoice } from './voiceRoomData';
import { VoiceCastingCandidate } from './voiceCastingCandidate';

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

export function VoiceCastingRound({ t, r, gate, onChanged, lineageName }: {
  t: LabTheme; r: RoundView; gate: string | null; onChanged: () => void; lineageName: (voiceId: string) => string | null;
}) {
  const { round, candidates } = r;
  const open = round.status === 'open';
  const [note, setNote] = useState(round.ownerNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = candidates.filter((c) => c.candidate.verdict === 'pending').length;
  const iterating = candidates.filter((c) => c.candidate.verdict === 'iterate').length;

  const close = async () => {
    setBusy(true);
    setError(null);
    const res = await postVoice<unknown>('/casting/close', { roundId: round.id, note }, gate);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onChanged();
  };

  return (
    <section data-testid="casting-round" data-round={round.roundNo} data-status={round.status}
      style={{ display: 'grid', gap: 'var(--lab-s3)', padding: 'var(--lab-s3)', border: `1px solid ${open ? t.ink : t.line}`, borderRadius: 6 }}>
      <div style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-lg)', color: t.inkDeep }}>Round {round.roundNo}</strong>
        <StatusTag level={round.status === 'cast' ? 'ok' : open ? 'warn' : 'bad'} word={round.status === 'cast' ? 'cast' : open ? 'open: your verdicts' : 'closed'} />
        <MicroLabel mono tone="muted">{when(round.createdAt)} · {candidates.length} voices · {round.model}</MicroLabel>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.text }}><strong>This round tries:</strong> {round.brief}</p>
      <details>
        <summary style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, cursor: 'pointer' }}>What every candidate says</summary>
        <p style={{ margin: 0, fontSize: 'var(--lab-fs-xs)', color: t.text, fontStyle: 'italic' }}>&ldquo;{round.sampleText}&rdquo;</p>
      </details>
      <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 'var(--lab-s2)', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {candidates.map((c, i) => (
          <VoiceCastingCandidate key={c.voice.id} t={t} c={c} index={i} open={open} gate={gate} onChanged={onChanged}
            lineage={c.candidate.parentVoiceId ? lineageName(c.candidate.parentVoiceId) : null} />
        ))}
      </ul>
      {open ? (
        <div data-testid="casting-close" style={{ display: 'grid', gap: 'var(--lab-s2)', borderTop: `1px solid ${t.line}`, paddingTop: 'var(--lab-s3)' }}>
          <LabTextarea t={t} rows={3} value={note} onChange={setNote} label="Comment for the next round (if none was cast)"
            placeholder="Where the next round should move: e.g. younger, more metallic, keep #2's crack but faster" testId="casting-round-note" />
          <div style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <LabButton t={t} testId="casting-close-btn" disabled={!gate || busy || pending > 0} onClick={() => void close()}>
              {busy ? 'Closing…' : 'Close round: ask for the next one'}
            </LabButton>
            <MicroLabel mono tone="muted">
              {pending > 0 ? `${pending} without a verdict yet` : `${iterating} to iterate on`} · Claude writes the next 5 from your verdicts and this comment
            </MicroLabel>
          </div>
          {!gate && <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.warn }}>Verdicts are disabled: waiting for the room token.</span>}
          {error && <span role="alert" style={{ fontSize: 'var(--lab-fs-xs)', color: t.bad }}>{error}</span>}
        </div>
      ) : round.ownerNote && (
        <p style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.text }}><strong>Your comment:</strong> {round.ownerNote}</p>
      )}
    </section>
  );
}
