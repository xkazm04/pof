'use client';

/**
 * The line queue: every line in chronological play order, grouped by quest, each with its state, and a
 * proven/total meter + Export per quest (export writes only proven lines; the server enforces it).
 */
import { StatusTag } from '@/components/ui/StatusTag';
import { MeterBar } from '@/components/ui/MeterBar';
import { MicroLabel } from '@/components/ui/MicroLabel';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { LineState, QueueEntry, QuestProgress } from '@/lib/voice/types';
import type { StatusLevel } from '@/lib/status-token';
import type { LineKey } from './voiceRoomData';

export const LINE_STATE: Record<LineState, { level: StatusLevel; word: string }> = {
  'no-takes': { level: 'warn', word: 'no takes' },
  'awaiting-verdict': { level: 'warn', word: 'awaiting verdict' },
  'all-rejected': { level: 'bad', word: 'all rejected' },
  proven: { level: 'ok', word: 'proven' },
};

/** Entries grouped by quest, in the queue's own (play) order. Exported for tests. */
export function groupByQuest(entries: readonly QueueEntry[]): Array<{ questId: string; lines: QueueEntry[] }> {
  const out: Array<{ questId: string; lines: QueueEntry[] }> = [];
  for (const e of entries) {
    const last = out[out.length - 1];
    if (last && last.questId === e.questId) last.lines.push(e);
    else out.push({ questId: e.questId, lines: [e] });
  }
  return out;
}

/** The next line with takes waiting for a verdict AFTER `sel` in play order (wrapping), or null when none wait. */
export function nextToJudge(entries: readonly QueueEntry[], sel: LineKey | null): QueueEntry | null {
  const waiting = (e: QueueEntry) => e.state === 'awaiting-verdict';
  const at = sel ? entries.findIndex((e) => e.questId === sel.questId && e.lineId === sel.lineId) : -1;
  return [...entries.slice(at + 1), ...entries.slice(0, at + 1)].find((e) => waiting(e) && !(sel && e.questId === sel.questId && e.lineId === sel.lineId)) ?? null;
}

export interface ExportNote { questId: string; text: string }

export function VoiceQueue({ t, queue, quests, selected, onSelect, onExport, exportNote }: {
  t: LabTheme; queue: QueueEntry[]; quests: QuestProgress[]; selected: LineKey | null;
  onSelect: (k: LineKey) => void; onExport: (questId: string) => void; exportNote: ExportNote | null;
}) {
  if (queue.length === 0) {
    return <p data-testid="voice-queue" style={{ color: t.muted }}>No quest lines yet: no ledger quest under games/gtai/quests has lines.</p>;
  }
  const progress = new Map(quests.map((q) => [q.questId, q]));
  return (
    <div data-testid="voice-queue" style={{ display: 'grid', gap: 'var(--lab-s4)', alignContent: 'start' }}>
      {groupByQuest(queue).map((g) => {
        const p = progress.get(g.questId);
        const proven = p?.proven ?? g.lines.filter((l) => l.state === 'proven').length;
        const total = p?.total ?? g.lines.length;
        return (
          <section key={g.questId} data-testid="voice-quest" data-quest={g.questId} style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
            <header style={{ display: 'grid', gap: 'var(--lab-s1)' }}>
              <div style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <strong style={{ fontFamily: 'var(--lab-font-mono)', color: t.inkDeep }}>{p?.title ?? g.questId}</strong>
                <MicroLabel mono tone="muted">{g.questId} · {proven}/{total} proven</MicroLabel>
                <button type="button" className="focus-ring" data-testid="voice-export" onClick={() => onExport(g.questId)}
                  title="Writes only the proven lines into the game"
                  style={{ marginLeft: 'auto', fontSize: 'var(--lab-fs-xs)', padding: '2px 8px', border: `1px solid ${t.line}`, borderRadius: 4, background: 'transparent', color: t.text, cursor: 'pointer' }}>
                  Export proven
                </button>
              </div>
              <MeterBar value={proven} max={Math.max(1, total)} color="var(--lab-ink)" ariaLabel={`${g.questId} proven lines`} valueText={`${proven} of ${total} proven`} />
              {exportNote?.questId === g.questId && <span data-testid="voice-export-note" style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{exportNote.text}</span>}
            </header>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
              {g.lines.map((l) => {
                const active = selected?.questId === l.questId && selected.lineId === l.lineId;
                const s = LINE_STATE[l.state];
                return (
                  <li key={l.lineId}>
                    <button type="button" className="focus-ring-inset" data-testid="voice-queue-line" data-line={l.lineId} aria-current={active ? 'true' : undefined}
                      onClick={() => onSelect({ questId: l.questId, lineId: l.lineId })}
                      style={{ width: '100%', textAlign: 'left', display: 'grid', gap: 2, padding: 'var(--lab-s2)', border: `1px solid ${active ? t.ink : t.line}`, borderRadius: 4, background: active ? t.accentBg : 'transparent', color: t.text, cursor: 'pointer' }}>
                      <span style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <MicroLabel mono tone="muted">{l.speaker}</MicroLabel>
                        <StatusTag level={s.level} word={s.word} />
                        {l.lineClass === 'bark' && <span data-testid="voice-line-class" title={`bark: ${l.when.join(', ')}`}><MicroLabel mono tone="muted">bark</MicroLabel></span>}
                        {l.takes > 0 && <MicroLabel mono tone="muted">{l.takes} takes{l.pending ? ` · ${l.pending} pending` : ''}</MicroLabel>}
                      </span>
                      <span style={{ fontSize: 'var(--lab-fs-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
