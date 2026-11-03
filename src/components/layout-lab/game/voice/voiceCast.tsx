'use client';

/**
 * Cast: per speaker in the queue, the cast voice and its candidates with their previews; "Design new
 * voice from bible" adds candidates; Cast is the owner's click (gated with the page token).
 */
import { useState } from 'react';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LabButton } from '@/components/layout-lab/steps/controls';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { QueueEntry, VoiceRow } from '@/lib/voice/types';
import { fmtMs, postVoice, previewAudioUrl } from './voiceRoomData';
import { VoiceAudio } from './voiceAudio';
import { NO_CLONE_NOTE } from './voiceGateClient';

/** Speakers in first-appearance (play) order. Exported for tests. */
export function speakersInOrder(queue: readonly QueueEntry[]): string[] {
  return [...new Set(queue.map((q) => q.speaker))];
}

function VoiceCard({ t, v, gate, onChanged }: { t: LabTheme; v: VoiceRow; gate: string | null; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const cast = async () => {
    setError(null);
    const r = await postVoice<unknown>('/voices/cast', { voiceId: v.id }, gate);
    if (r.ok) onChanged(); else setError(r.error);
  };
  const preview = v.previews[0];
  // With a preview, casting unlocks once it was played through (as Approve does for a take): no unheard cast.
  const [heard, setHeard] = useState(false);
  const mustListen = !!preview && !heard;
  return (
    <li data-testid="voice-candidate" data-voice={v.id} data-status={v.status}
      style={{ listStyle: 'none', display: 'grid', gap: 'var(--lab-s1)', padding: 'var(--lab-s2)', border: `1px solid ${v.status === 'cast' ? t.ink : t.line}`, borderRadius: 6 }}>
      <div style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <StatusTag level={v.status === 'cast' ? 'ok' : 'warn'} word={v.status} />
        <strong style={{ fontSize: 'var(--lab-fs-sm)' }}>{v.name}</strong>
        <MicroLabel mono tone="muted">{v.source}{v.providerVoiceId ? ` · ${v.providerVoiceId}` : ' · not created yet'}</MicroLabel>
      </div>
      {preview
        ? <VoiceAudio t={t} src={previewAudioUrl(v.id)} label={`Preview of ${v.name}`} onHeard={() => setHeard(true)} />
        : <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>No preview (stock voice): judge it by its takes.</span>}
      {preview && <MicroLabel mono tone="muted">preview {fmtMs(preview.durationMs)}</MicroLabel>}
      {v.designPrompt && (
        <details>
          <summary style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, cursor: 'pointer' }}>Design prompt</summary>
          <p style={{ fontSize: 'var(--lab-fs-xs)', margin: 0 }}>{v.designPrompt}</p>
        </details>
      )}
      {v.status !== 'cast' && <LabButton t={t} testId="voice-cast-btn" disabled={!gate || mustListen} onClick={() => void cast()}>Cast this voice</LabButton>}
      {v.status !== 'cast' && mustListen && <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>Cast unlocks once you have played the preview through.</span>}
      {error && <span role="alert" style={{ fontSize: 'var(--lab-fs-xs)', color: t.bad }}>{error}</span>}
    </li>
  );
}

function SpeakerCast({ t, speaker, voices, gate, onChanged }: { t: LabTheme; speaker: string; voices: VoiceRow[]; gate: string | null; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const design = async () => {
    setBusy(true);
    setMsg(null);
    const r = await postVoice<{ voices: VoiceRow[]; chars: number }>('/voices', { action: 'design', characterId: speaker, n: 3 });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: `${r.data.voices.length} candidates designed · ${r.data.chars} chars` });
    onChanged();
  };
  const cast = voices.find((v) => v.status === 'cast');
  return (
    <section data-testid="voice-cast-speaker" data-speaker={speaker} style={{ display: 'grid', gap: 'var(--lab-s2)', padding: 'var(--lab-s3)', border: `1px solid ${t.line}`, borderRadius: 6 }}>
      <div style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontFamily: 'var(--lab-font-mono)', color: t.inkDeep }}>{speaker}</strong>
        <MicroLabel mono tone="muted">{cast ? `cast: ${cast.name}` : 'no voice cast'} · {voices.length} voices</MicroLabel>
        <span style={{ marginLeft: 'auto' }}>
          <LabButton t={t} testId="voice-design" disabled={busy} onClick={() => void design()}>{busy ? 'Designing…' : 'Design new voice from bible'}</LabButton>
        </span>
      </div>
      {msg && <span role={msg.ok ? 'status' : 'alert'} style={{ fontSize: 'var(--lab-fs-xs)', color: msg.ok ? t.ok : t.bad }}>{msg.text}</span>}
      {voices.length > 0 && (
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 'var(--lab-s2)', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {voices.map((v) => <VoiceCard key={v.id} t={t} v={v} gate={gate} onChanged={onChanged} />)}
        </ul>
      )}
    </section>
  );
}

export function VoiceCast({ t, queue, voices, gate, onChanged }: { t: LabTheme; queue: QueueEntry[]; voices: VoiceRow[]; gate: string | null; onChanged: () => void }) {
  return (
    <div data-testid="voice-cast" style={{ display: 'grid', gap: 'var(--lab-s3)', alignContent: 'start' }}>
      <p data-testid="voice-gate-note" role="note" style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.text, padding: 'var(--lab-s2)', borderLeft: `3px solid ${t.warn}` }}>
        {NO_CLONE_NOTE} Casting is your click here; nothing headless casts a voice.
      </p>
      {speakersInOrder(queue).map((s) => (
        <SpeakerCast key={s} t={t} speaker={s} voices={voices.filter((v) => v.characterId === s)} gate={gate} onChanged={onChanged} />
      ))}
    </div>
  );
}
