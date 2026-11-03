'use client';

/**
 * One take: the player, its direction, what was sent, duration/loudness/cost, its verdict — and the
 * owner's Approve / Reject with a note. The verdict is sent ONLY from these click handlers, with the
 * page's gate token; without a token the buttons are disabled and say why.
 */
import { useState } from 'react';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LabButton, LabTextarea } from '@/components/layout-lab/steps/controls';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { TakeView } from '@/lib/voice/room';
import { SILENCE_FLAG_MS, type TakeVerdict } from '@/lib/voice/types';
import type { StatusLevel } from '@/lib/status-token';
import { fmtLufs, fmtMs, postVoice, takeAudioUrl } from './voiceRoomData';

const VERDICT: Record<TakeVerdict, { level: StatusLevel; word: string }> = {
  pending: { level: 'warn', word: 'pending' },
  approved: { level: 'ok', word: 'approved' },
  rejected: { level: 'bad', word: 'rejected' },
  superseded: { level: 'warn', word: 'superseded' },
};

export function VoiceTake({ t, take, voiceName, gate, onChanged }: {
  t: LabTheme; take: TakeView; voiceName: string; gate: { token: string | null; error: string | null }; onChanged: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = VERDICT[take.verdict];

  const judge = async (verdict: 'approved' | 'rejected') => {
    setBusy(true);
    setError(null);
    const r = await postVoice<unknown>('/takes/verdict', { takeId: take.id, verdict, note }, gate.token);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setNote('');
    onChanged();
  };

  const canJudge = !!gate.token && !busy && !take.stale;
  return (
    <li data-testid="voice-take" data-take={take.id} data-verdict={take.verdict}
      style={{ listStyle: 'none', display: 'grid', gap: 'var(--lab-s2)', padding: 'var(--lab-s3)', border: `1px solid ${t.line}`, borderRadius: 6, opacity: take.stale ? 0.7 : 1 }}>
      <div style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <StatusTag level={v.level} word={v.word} />
        {take.stale && <StatusTag level="bad" word="stale: older line text or not the cast voice" />}
        <MicroLabel mono tone="muted">{voiceName} · {take.settings.model} · {fmtMs(take.durationMs)} · {fmtLufs(take.loudnessLufs)} · {take.chars} chars · {take.maxSilenceMs === null ? 'silence unmeasured' : `longest pause ${fmtMs(take.maxSilenceMs)}`}</MicroLabel>
        {take.maxSilenceMs !== null && take.maxSilenceMs > SILENCE_FLAG_MS && <StatusTag level="warn" word={`long pause ${fmtMs(take.maxSilenceMs)}: listen for a dropout`} />}
      </div>
      <audio controls preload="none" src={takeAudioUrl(take.id)} style={{ width: '100%' }} aria-label={`Take ${take.id.slice(0, 8)}`} />
      <div style={{ fontSize: 'var(--lab-fs-sm)', color: t.text }}>
        <strong>Direction:</strong> {take.direction || <em style={{ color: t.muted }}>none</em>}
      </div>
      <details>
        <summary style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, cursor: 'pointer' }}>Sent text and settings</summary>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', margin: 0 }}>
          {take.sentText}{'\n'}stability {take.settings.stability} · style {take.settings.style} · speed {take.settings.speed} · similarity {take.settings.similarityBoost}
        </pre>
      </details>
      {take.verdictNote && <div style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>Note: {take.verdictNote}</div>}
      {take.verdict !== 'approved' && !take.stale && (
        <div style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
          <LabTextarea t={t} rows={2} value={note} onChange={setNote} label="Verdict note" placeholder="What works, what to change next round" testId="voice-verdict-note" />
          <div style={{ display: 'flex', gap: 'var(--lab-s2)', flexWrap: 'wrap' }}>
            <LabButton t={t} testId="voice-approve" disabled={!canJudge} onClick={() => void judge('approved')}>Approve</LabButton>
            <LabButton t={t} testId="voice-reject" disabled={!canJudge} onClick={() => void judge('rejected')}>Reject</LabButton>
          </div>
        </div>
      )}
      {take.verdict === 'approved' && (
        <LabButton t={t} testId="voice-unapprove" disabled={!canJudge} onClick={() => void judge('rejected')}>Reject this approved take</LabButton>
      )}
      {!gate.token && <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.warn }}>Verdicts are disabled: {gate.error ?? 'waiting for the room token'}</span>}
      {error && <span role="alert" style={{ fontSize: 'var(--lab-fs-xs)', color: t.bad }}>{error}</span>}
    </li>
  );
}
