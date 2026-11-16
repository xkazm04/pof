'use client';

/**
 * One voice of a round as one line: number, player, label (its design description folds out beneath),
 * the verdict toggles (Cast / Iterate / Decline: colour + icon + word, never hue alone) and a one-line note.
 * Read-only for a submitted round: the verdict and note as given.
 */
import { useState } from 'react';
import { Check, ChevronDown, RotateCw, X } from 'lucide-react';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { CandidateView } from '@/lib/voice/castingDb';
import type { Pick } from './castingDraft';
import { CastingPlayer } from './castingPlayer';
import { previewAudioUrl } from './voiceRoomData';

const PICKS: Array<{ id: Pick; word: string; Icon: typeof Check; tone: 'ok' | 'warn' | 'bad' }> = [
  { id: 'cast', word: 'Cast', Icon: Check, tone: 'ok' },
  { id: 'iterate', word: 'Iterate', Icon: RotateCw, tone: 'warn' },
  { id: 'decline', word: 'Decline', Icon: X, tone: 'bad' },
];

export function VerdictToggles({ t, value, onPick, castLocked, readOnly }: {
  t: LabTheme; value: Pick | null; onPick?: (p: Pick) => void; castLocked?: boolean; readOnly?: boolean;
}) {
  return (
    <div role="group" aria-label="Verdict" style={{ display: 'inline-flex', border: `1px solid ${t.line}`, borderRadius: 6, overflow: 'hidden', flex: 'none' }}>
      {PICKS.map(({ id, word, Icon, tone }, i) => {
        const on = value === id;
        const locked = readOnly || (id === 'cast' && castLocked && !on);
        return (
          <button key={id} type="button" className="focus-ring-inset" aria-pressed={on} disabled={locked} data-testid={`casting-${id}`}
            title={id === 'cast' && castLocked && !on ? 'Play it through first' : undefined} onClick={() => onPick?.(id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 'var(--lab-fs-xs)', fontWeight: on ? 700 : 500,
              borderLeft: i ? `1px solid ${t.line}` : 'none', cursor: locked ? 'default' : 'pointer', opacity: locked && !on ? 0.4 : 1,
              background: on ? `color-mix(in srgb, ${t[tone]} 20%, transparent)` : 'transparent', color: on ? t.inkDeep : t.muted,
              boxShadow: on ? `inset 0 -2px 0 ${t[tone]}` : 'none' }}>
            <Icon size={13} color={on ? t[tone] : 'currentColor'} />{word}
          </button>
        );
      })}
    </div>
  );
}

export function CastingRow({ t, c, index, pick, note, heard, onPick, onNote, onHeard, readOnly, lineage }: {
  t: LabTheme; c: CandidateView; index: number; pick: Pick | null; note: string; heard: boolean;
  onPick?: (p: Pick) => void; onNote?: (v: string) => void; onHeard?: () => void; readOnly?: boolean; lineage: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { voice, candidate } = c;
  return (
    <li data-testid="casting-candidate" data-voice={voice.id} data-verdict={readOnly ? candidate.verdict : pick ?? 'pending'}
      style={{ listStyle: 'none', padding: '8px 12px', borderBottom: `1px solid ${t.line}`,
        background: index % 2 ? `color-mix(in srgb, ${t.line} 18%, transparent)` : 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-sm)', color: t.muted, width: 22, flex: 'none' }}>{index + 1}</span>
        <button type="button" className="focus-ring" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Show the design description"
          style={{ flex: '1 1 170px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: t.inkDeep }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--lab-fs-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{candidate.label}</span>
          <ChevronDown size={14} color={t.muted} style={{ flex: 'none', transform: open ? 'rotate(180deg)' : 'none' }} />
        </button>
        <div style={{ flex: '2 1 240px', minWidth: 200 }}>
          {voice.previews[0]
            ? <CastingPlayer t={t} src={previewAudioUrl(voice.id, true)} fallbackSrc={previewAudioUrl(voice.id)} label={candidate.label} heard={heard || readOnly === true} onHeard={() => onHeard?.()} />
            : <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.bad }}>No preview audio</span>}
        </div>
        <VerdictToggles t={t} value={readOnly ? (candidate.verdict === 'pending' ? null : candidate.verdict) : pick} onPick={onPick} castLocked={!heard} readOnly={readOnly} />
        {readOnly
          ? <span style={{ flex: '2 1 200px', fontSize: 'var(--lab-fs-xs)', color: candidate.note ? t.text : t.muted }}>{candidate.note ?? 'no note'}</span>
          : <input aria-label={`Note on ${candidate.label}`} value={note} onChange={(e) => onNote?.(e.target.value)} placeholder="Note: what works, what is off" data-testid="casting-note"
              className="focus-ring-inset" style={{ flex: '2 1 200px', minWidth: 160, fontSize: 'var(--lab-fs-sm)', padding: '5px 8px', borderRadius: 4, border: `1px solid ${t.line}`, background: 'transparent', color: t.text }} />}
      </div>
      {open && (
        <p style={{ margin: '6px 0 2px 34px', fontSize: 'var(--lab-fs-xs)', lineHeight: 1.5, color: t.text }}>
          {voice.designPrompt}
          <span style={{ display: 'block', marginTop: 2, fontFamily: 'var(--lab-font-mono)', color: t.muted }}>seed {candidate.seed ?? 'unknown'}{lineage ? ` · iterates on ${lineage}` : ''}</span>
        </p>
      )}
    </li>
  );
}
