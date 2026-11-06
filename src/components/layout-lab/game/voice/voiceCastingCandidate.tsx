'use client';

/**
 * One casting candidate: its preview (at the game's voice level), the description it was designed from, and the
 * owner's three verdicts: Cast (unlocks once heard through; a second click confirms, since it closes the round),
 * Iterate (keep this voice's identity, refine it next round) and Decline. The note says why; the next round is
 * written from it. Verdicts are sent only from these click handlers, with the page's gate token.
 */
import { useState } from 'react';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LabButton, LabTextarea } from '@/components/layout-lab/steps/controls';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { StatusLevel } from '@/lib/status-token';
import type { CandidateView, CastVerdict } from '@/lib/voice/castingDb';
import { fmtMs, postVoice, previewAudioUrl } from './voiceRoomData';
import { VoiceAudio } from './voiceAudio';

export const CAST_VERDICT: Record<CastVerdict, { level: StatusLevel; word: string }> = {
  pending: { level: 'warn', word: 'no verdict yet' },
  cast: { level: 'ok', word: 'cast' },
  iterate: { level: 'warn', word: 'iterate' },
  decline: { level: 'bad', word: 'declined' },
};

export function VoiceCastingCandidate({ t, c, index, open, gate, onChanged, lineage }: {
  t: LabTheme; c: CandidateView; index: number; open: boolean; gate: string | null; onChanged: () => void; lineage: string | null;
}) {
  const { voice, candidate } = c;
  const [note, setNote] = useState(candidate.note ?? '');
  const [heard, setHeard] = useState(false);
  const [confirmCast, setConfirmCast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const v = CAST_VERDICT[candidate.verdict];

  const judge = async (verdict: CastVerdict) => {
    setBusy(true);
    setMsg(null);
    const r = await postVoice<{ warning: string | null }>('/casting/verdict', { voiceId: voice.id, verdict, note }, gate);
    setBusy(false);
    setConfirmCast(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    if (r.data.warning) setMsg({ ok: false, text: r.data.warning });
    onChanged();
  };

  const can = open && !!gate && !busy;
  return (
    <li data-testid="casting-candidate" data-voice={voice.id} data-verdict={candidate.verdict}
      style={{ listStyle: 'none', display: 'grid', gap: 'var(--lab-s2)', alignContent: 'start', padding: 'var(--lab-s3)', borderRadius: 6,
        border: `${candidate.verdict === 'cast' ? 2 : 1}px solid ${candidate.verdict === 'cast' ? t.ink : t.line}` }}>
      <div style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontFamily: 'var(--lab-font-mono)', color: t.inkDeep }}>#{index + 1}</strong>
        <span style={{ fontSize: 'var(--lab-fs-sm)', color: t.text, fontWeight: 600 }}>{candidate.label}</span>
        <span style={{ marginLeft: 'auto' }}><StatusTag level={v.level} word={v.word} /></span>
      </div>
      {voice.previews[0]
        ? <VoiceAudio t={t} src={previewAudioUrl(voice.id, true)} fallbackSrc={previewAudioUrl(voice.id)}
            fallbackNote="Could not master it at the game's level: playing the design preview as delivered."
            label={`Candidate ${index + 1}, ${candidate.label}`} onHeard={() => setHeard(true)} />
        : <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.bad }}>No preview audio for this candidate.</span>}
      <MicroLabel mono tone="muted">
        {fmtMs(voice.previews[0]?.durationMs ?? null)} · seed {candidate.seed ?? 'unknown'}{lineage ? ` · iterates on ${lineage}` : ''}
      </MicroLabel>
      <details>
        <summary style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, cursor: 'pointer' }}>Design description</summary>
        <p style={{ fontSize: 'var(--lab-fs-xs)', margin: 0, color: t.text }}>{voice.designPrompt}</p>
      </details>
      {open ? (
        <div style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
          <LabTextarea t={t} rows={2} value={note} onChange={setNote} label="Your note on this voice"
            placeholder="What works, what is off (age, grit, pace, pitch, accent, energy)" testId="casting-note" />
          <div style={{ display: 'flex', gap: 'var(--lab-s2)', flexWrap: 'wrap' }}>
            {confirmCast
              ? <LabButton t={t} testId="casting-cast-confirm" disabled={!can} onClick={() => void judge('cast')}>Confirm cast: closes the round</LabButton>
              : <LabButton t={t} testId="casting-cast" disabled={!can || !heard} onClick={() => setConfirmCast(true)}>Cast</LabButton>}
            <LabButton t={t} testId="casting-iterate" disabled={!can} onClick={() => void judge('iterate')}>Iterate</LabButton>
            <LabButton t={t} testId="casting-decline" disabled={!can} onClick={() => void judge('decline')}>Decline</LabButton>
          </div>
          {!heard && <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>Cast unlocks once you have played the preview through.</span>}
          {candidate.verdict !== 'pending' && candidate.note && candidate.note !== note && (
            <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>Saved note: {candidate.note}</span>
          )}
        </div>
      ) : candidate.note && <div style={{ fontSize: 'var(--lab-fs-xs)', color: t.text }}><strong>Your note:</strong> {candidate.note}</div>}
      {msg && <span role={msg.ok ? 'status' : 'alert'} style={{ fontSize: 'var(--lab-fs-xs)', color: msg.ok ? t.ok : t.bad }}>{msg.text}</span>}
    </li>
  );
}
