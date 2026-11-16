'use client';

/**
 * A casting round as a list: the open round takes every verdict as a toggle and sends the whole round with ONE
 * submit (all voices judged; at most one Cast). Submitted rounds render as compact, folded history.
 */
import { MicroLabel } from '@/components/ui/MicroLabel';
import { StatusTag } from '@/components/ui/StatusTag';
import { LabButton } from '@/components/layout-lab/steps/controls';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { RoundView } from '@/lib/voice/castingDb';
import { useRoundDraft } from './castingDraft';
import { CastingRow } from './castingRow';

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function RoundHead({ t, r, compact }: { t: LabTheme; r: RoundView; compact?: boolean }) {
  const { round } = r;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: compact ? 'var(--lab-fs-sm)' : 'var(--lab-fs-lg)', fontWeight: 700, color: t.inkDeep }}>Round {round.roundNo}</span>
        <StatusTag level={round.status === 'cast' ? 'ok' : round.status === 'open' ? 'warn' : 'bad'} word={round.status === 'open' ? 'your verdicts' : round.status} />
        <MicroLabel mono tone="muted">{when(round.createdAt)} · {r.candidates.length} voices</MicroLabel>
      </div>
      {!compact && <p style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.text, maxWidth: '80ch', lineHeight: 1.5 }}>{round.brief}</p>}
    </div>
  );
}

export function OpenRound({ t, r, gate, onChanged, lineageName }: {
  t: LabTheme; r: RoundView; gate: string | null; onChanged: () => void; lineageName: (id: string) => string | null;
}) {
  const d = useRoundDraft(r, gate, onChanged);
  const castLabel = d.castId ? r.candidates.find((c) => c.voice.id === d.castId)?.candidate.label : null;
  const counts = (['cast', 'iterate', 'decline'] as const).map((p) => [p, Object.values(d.draft.picks).filter((x) => x === p).length] as const).filter(([, n]) => n);
  return (
    <section data-testid="casting-round" data-round={r.round.roundNo} data-status="open" style={{ display: 'grid', gap: 12 }}>
      <RoundHead t={t} r={r} />
      <details>
        <summary style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, cursor: 'pointer' }}>What every voice says</summary>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--lab-fs-sm)', fontStyle: 'italic', color: t.text, maxWidth: '80ch' }}>&ldquo;{r.round.sampleText}&rdquo;</p>
      </details>
      <ul style={{ margin: 0, padding: 0, display: 'grid', borderTop: `1px solid ${t.line}` }}>
        {r.candidates.map((c, i) => (
          <CastingRow key={c.voice.id} t={t} c={c} index={i} pick={d.draft.picks[c.voice.id] ?? null} note={d.draft.notes[c.voice.id] ?? ''}
            heard={d.draft.heard.includes(c.voice.id)} onPick={(p) => d.pick(c.voice.id, p)} onNote={(v) => d.note(c.voice.id, v)} onHeard={() => d.heard(c.voice.id)}
            lineage={c.candidate.parentVoiceId ? lineageName(c.candidate.parentVoiceId) : null} />
        ))}
      </ul>
      <div data-testid="casting-submit-bar" style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <textarea aria-label="Comment for the next round" value={d.draft.comment} onChange={(e) => d.comment(e.target.value)} rows={2} data-testid="casting-round-note"
          placeholder={d.castId ? 'Optional: what made this the one' : 'Comment for the next round: where to move (younger, more metallic, keep #2 but faster…)'}
          className="focus-ring-inset" style={{ flex: '1 1 360px', fontSize: 'var(--lab-fs-sm)', padding: '8px 10px', borderRadius: 6, border: `1px solid ${t.line}`, background: 'transparent', color: t.text, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'grid', gap: 6, alignContent: 'center', flex: 'none' }}>
          <LabButton t={t} testId="casting-submit" disabled={!d.ready} onClick={() => void d.submit()}>
            {d.busy ? 'Sending…' : castLabel ? `Cast “${castLabel}” and submit` : 'Submit round'}
          </LabButton>
          <MicroLabel mono tone="muted">
            {d.judged}/{d.total} judged{counts.length ? ` · ${counts.map(([p, n]) => `${n} ${p}`).join(' · ')}` : ''}{!gate ? ' · waiting for the room token' : ''}
          </MicroLabel>
        </div>
      </div>
      {d.error && <span role="alert" style={{ fontSize: 'var(--lab-fs-sm)', color: t.bad }}>{d.error}</span>}
    </section>
  );
}

export function PastRound({ t, r, lineageName }: { t: LabTheme; r: RoundView; lineageName: (id: string) => string | null }) {
  return (
    <details data-testid="casting-round" data-round={r.round.roundNo} data-status={r.round.status} open={r.round.status === 'cast'}
      style={{ borderTop: `1px solid ${t.line}`, paddingTop: 8 }}>
      <summary style={{ cursor: 'pointer', listStyle: 'revert' }}><span style={{ display: 'inline-block', verticalAlign: 'middle' }}><RoundHead t={t} r={r} compact /></span></summary>
      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        <p style={{ margin: 0, fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{r.round.brief}</p>
        <ul style={{ margin: 0, padding: 0, display: 'grid' }}>
          {r.candidates.map((c, i) => <CastingRow key={c.voice.id} t={t} c={c} index={i} pick={null} note="" heard readOnly
            lineage={c.candidate.parentVoiceId ? lineageName(c.candidate.parentVoiceId) : null} />)}
        </ul>
        {r.round.ownerNote && <p style={{ margin: 0, fontSize: 'var(--lab-fs-sm)', color: t.text }}><strong>Your comment:</strong> {r.round.ownerNote}</p>}
      </div>
    </details>
  );
}
