'use client';

/** The selected line: text, speaker, the speaker's voice bible (collapsible), its takes and the generate form. */
import { MicroLabel } from '@/components/ui/MicroLabel';
import { StatusTag } from '@/components/ui/StatusTag';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { LabTheme } from '@/components/layout-lab/theme';
import { LINE_STATE } from './voiceQueue';
import { VoiceTake } from './voiceTake';
import { VoiceGenerate } from './voiceGenerate';
import { VoiceLineContext } from './voiceLineContext';
import { useLineDetail, type LineKey } from './voiceRoomData';

export function VoiceLine({ t, sel, gate, onChanged }: {
  t: LabTheme; sel: LineKey | null; gate: { token: string | null; error: string | null }; onChanged: () => void;
}) {
  const { read, reload } = useLineDetail(sel);
  if (!sel) return <p data-testid="voice-line" style={{ color: t.muted }}>Pick a line from the queue.</p>;
  if (read.kind === 'loading') return <LoadingRow variant="inline" label="Reading the line…" />;
  if (read.kind === 'error') return <InlineErrorRetry message={`line unavailable (${read.reason})`} onRetry={reload} />;
  const d = read.data;
  const s = LINE_STATE[d.line.state];
  const nameOf = (voiceId: string) => d.voices.find((v) => v.id === voiceId)?.name ?? voiceId.slice(0, 8);
  const changed = () => { reload(); onChanged(); };
  return (
    <section data-testid="voice-line" data-line={d.line.lineId} style={{ display: 'grid', gap: 'var(--lab-s3)', alignContent: 'start', minWidth: 0 }}>
      <header style={{ display: 'grid', gap: 'var(--lab-s1)' }}>
        <div style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <MicroLabel mono uppercase tone="muted">{d.line.questId} · {d.line.lineId}</MicroLabel>
          <StatusTag level={s.level} word={s.word} />
        </div>
        <strong style={{ fontFamily: 'var(--lab-font-mono)', color: t.inkDeep }}>{d.line.speaker}</strong>
        <blockquote style={{ margin: 0, fontSize: 'var(--lab-fs-md, 1rem)', color: t.inkDeep, lineHeight: 1.5 }}>{d.line.text}</blockquote>
        {d.line.purpose.length > 0 && <MicroLabel mono tone="muted">purpose: {d.line.purpose.join(', ')}</MicroLabel>}
        <VoiceLineContext t={t} line={d.line} />
      </header>
      <details data-testid="voice-bible">
        <summary style={{ cursor: 'pointer', fontSize: 'var(--lab-fs-sm)', color: t.text }}>Voice bible: {d.line.speaker}</summary>
        {d.bible
          ? <pre style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', maxHeight: 320, overflow: 'auto' }}>{d.bible}</pre>
          : <p style={{ color: t.warn, fontSize: 'var(--lab-fs-xs)' }}>No voice bible at games/gtai/voices/{d.line.speaker}.md</p>}
      </details>
      <VoiceGenerate t={t} line={sel} voices={d.voices} onGenerated={changed} />
      <MicroLabel mono uppercase tone="muted">Takes ({d.takes.length})</MicroLabel>
      {d.takes.length === 0
        ? <p style={{ color: t.muted, fontSize: 'var(--lab-fs-sm)' }}>No takes yet for this line.</p>
        : (
          <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 'var(--lab-s2)' }}>
            {d.takes.map((take) => <VoiceTake key={take.id} t={t} take={take} voiceName={nameOf(take.voiceId)} gate={gate} onChanged={changed} />)}
          </ul>
        )}
    </section>
  );
}
