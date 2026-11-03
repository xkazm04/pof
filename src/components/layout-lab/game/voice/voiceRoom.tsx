'use client';

/**
 * The GTAI Voice room (lane pof-voice): the owner listens and judges here while the `/gta --voice` CLI
 * generates takes. Queue (lines in play order) beside the selected line; Cast (voices per character).
 * Human gated: verdicts and casting are clicks in this page, carrying its gate token.
 */
import { useState } from 'react';
import { TabBar } from '@/components/ui/TabBar';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { QueueEntry } from '@/lib/voice/types';
import { VoiceQueue, nextToJudge, type ExportNote } from './voiceQueue';
import { VoiceLine } from './voiceLine';
import { VoiceCast } from './voiceCast';
import { postVoice, useGateToken, useVoiceRoom, type LineKey } from './voiceRoomData';
import { openRoom } from './voiceRoomParam';
import { useExclusivePlayback } from './voiceExclusivePlay';

type Tab = 'queue' | 'cast';
const TABS = [{ id: 'queue' as const, label: 'Queue' }, { id: 'cast' as const, label: 'Cast' }];

interface ExportReport { written: unknown[]; skipped: unknown[] }

export function VoiceRoom({ t }: { t: LabTheme }) {
  const { read, reload } = useVoiceRoom();
  const gate = useGateToken();
  const roomRef = useExclusivePlayback<HTMLElement>();
  const [tab, setTab] = useState<Tab>('queue');
  const [picked, setPicked] = useState<LineKey | null>(null);
  const [exportNote, setExportNote] = useState<ExportNote | null>(null);

  const doExport = async (questId: string) => {
    setExportNote({ questId, text: 'Exporting…' });
    const r = await postVoice<ExportReport>('/export', { questId });
    setExportNote({ questId, text: r.ok ? `${r.data.written.length} written · ${r.data.skipped.length} skipped (not proven)` : `Export refused: ${r.error}` });
  };

  const data = read.kind === 'ready' ? read.data : null;
  const sel = picked ?? (data?.status.next[0] ? { questId: data.status.next[0].questId, lineId: data.status.next[0].lineId } : data?.queue[0] ? { questId: data.queue[0].questId, lineId: data.queue[0].lineId } : null);

  return (
    <section ref={roomRef} data-testid="voice-room" aria-labelledby="voice-room-title"
      style={{ flex: 1, minHeight: 0, maxWidth: '100vw', boxSizing: 'border-box', overflow: 'auto', color: t.text, padding: 'var(--lab-s4) var(--lab-s6)', display: 'grid', alignContent: 'start', gap: 'var(--lab-s4)' }}>
      <header style={{ display: 'grid', gap: 'var(--lab-s1)' }}>
        <button type="button" className="focus-ring" onClick={() => openRoom(null)}
          style={{ justifySelf: 'start', background: 'transparent', border: 'none', padding: 0, color: t.muted, cursor: 'pointer', fontSize: 'var(--lab-fs-xs)' }}>
          ← Game home
        </button>
        <MicroLabel mono uppercase tone="muted">GTAI · Voice room</MicroLabel>
        <h2 id="voice-room-title" style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xl)', color: t.inkDeep, margin: 0 }}>Voice</h2>
        {data && (
          <span data-testid="voice-status" style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
            {data.status.proven} / {data.status.total} lines proven · {data.status.chars} characters spent on takes · a line is proven only by your approval
          </span>
        )}
      </header>
      {/* TabBar colours labels with the app theme's --text / --color-text (dark-theme light text); scope it to the lab theme. */}
      <div style={{ ['--text' as string]: t.inkDeep, ['--text-muted' as string]: t.muted, ['--color-text' as string]: t.inkDeep, ['--color-text-muted' as string]: t.muted }}>
        <TabBar tabs={TABS} activeId={tab} onChange={setTab} layoutId="voice-room-tabs" accent="var(--lab-ink)" ariaLabel="Voice room sections" />
      </div>
      {read.kind === 'loading' && <LoadingRow variant="inline" label="Reading the line queue…" />}
      {read.kind === 'error' && <InlineErrorRetry message={`voice room unavailable (${read.reason})`} onRetry={reload} />}
      {data && tab === 'queue' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--lab-s4)', alignItems: 'start' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <VoiceQueue t={t} queue={data.queue} quests={data.status.quests} selected={sel} onSelect={setPicked} onExport={(q) => void doExport(q)} exportNote={exportNote} />
          </div>
          <div style={{ flex: '2 1 420px', minWidth: 0, display: 'grid', gap: 'var(--lab-s2)', alignContent: 'start' }}>
            <NextToJudge t={t} queue={data.queue} sel={sel} onSelect={setPicked} />
            <VoiceLine t={t} sel={sel} gate={gate} onChanged={reload} />
          </div>
        </div>
      )}
      {data && tab === 'cast' && <VoiceCast t={t} queue={data.queue} voices={data.voices} gate={gate.token} onChanged={reload} />}
    </section>
  );
}

/** Jump to the next line whose takes wait for a verdict (fewer clicks per verdict, not fewer verdicts). */
function NextToJudge({ t, queue, sel, onSelect }: { t: LabTheme; queue: QueueEntry[]; sel: LineKey | null; onSelect: (k: LineKey) => void }) {
  const waiting = queue.filter((e) => e.state === 'awaiting-verdict').length;
  const next = nextToJudge(queue, sel);
  return (
    <div style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <MicroLabel mono tone="muted">{waiting} {waiting === 1 ? 'line waits' : 'lines wait'} for your verdict</MicroLabel>
      <button type="button" className="focus-ring" data-testid="voice-next-to-judge" disabled={!next}
        onClick={() => next && onSelect({ questId: next.questId, lineId: next.lineId })}
        style={{ fontSize: 'var(--lab-fs-xs)', padding: '2px 8px', border: `1px solid ${t.line}`, borderRadius: 4, background: 'transparent', color: next ? t.text : t.muted, cursor: next ? 'pointer' : 'default' }}>
        {next ? `Next to judge: ${next.lineId} →` : 'Nothing else waiting'}
      </button>
    </div>
  );
}
