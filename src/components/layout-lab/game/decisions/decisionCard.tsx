'use client';

/**
 * One design question: its options side by side (label, trade-off, frames and clips), the lane's default marked, a
 * choice + note, and Save. An answered question shows the saved answer and can be changed (the old entry is kept in
 * the history file server-side). The answer is POSTed only from the Save click, with the page's gate token; with no
 * token Save is disabled and says why. Draft state lives here, keyed by ask id, so a poll never wipes a half-typed note.
 */
import { useState } from 'react';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LabButton, LabTextarea } from '@/components/layout-lab/steps/controls';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { DecisionOption, DecisionView } from '@/lib/games/decisions/decisionTypes';
import { postAnswer } from './decisionsData';
import { DecisionMediaItem } from './decisionMedia';

function OptionColumn({ t, o, group, checked, isDefault, onPick }: {
  t: LabTheme; o: DecisionOption; group: string; checked: boolean; isDefault: boolean; onPick: () => void;
}) {
  return (
    <div data-testid={`decision-option-${o.key}`} style={{ display: 'grid', gap: 'var(--lab-s2)', alignContent: 'start', minWidth: 0, padding: 'var(--lab-s3)',
      border: `1px solid ${checked ? t.ink : t.line}`, background: checked ? t.accentBg : 'transparent', borderRadius: 6 }}>
      <label style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="radio" name={group} value={o.key} checked={checked} onChange={onPick} style={{ flexShrink: 0, marginTop: 3 }} />
        <span style={{ display: 'flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
          <strong style={{ color: t.inkDeep, fontSize: 'var(--lab-fs-sm)' }}>{o.label}</strong>
          <MicroLabel mono tone="muted">{o.key}</MicroLabel>
          {isDefault && <StatusTag level="ok" word="lane's default" />}
        </span>
      </label>
      <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.text }}>{o.tradeoff || <em style={{ color: t.muted }}>no trade-off written</em>}</span>
      {o.media.length === 0
        ? <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>no frames or clips listed for this option</span>
        : o.media.map((m, i) => <DecisionMediaItem key={`${m.name}-${i}`} t={t} media={m} />)}
    </div>
  );
}

export function DecisionCard({ t, gameId, d, gate, onSaved }: {
  t: LabTheme; gameId: string; d: DecisionView; gate: { token: string | null; error: string | null }; onSaved: () => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const answered = d.answer !== undefined && !changing;
  const picked = choice ?? (changing ? d.answer?.choice ?? null : null);

  const save = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    const r = await postAnswer(gameId, { id: d.id, choice: picked, note }, gate.token);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setChanging(false);
    setChoice(null);
    setNote('');
    onSaved();
  };

  return (
    <article data-testid="decision-card" data-id={d.id} data-answered={d.answer ? 'true' : 'false'} aria-label={`${d.lane}: ${d.question}`}
      style={{ display: 'grid', gap: 'var(--lab-s3)', padding: 'var(--lab-s4)', border: `1px solid ${t.line}`, background: t.panel, borderRadius: 6, minWidth: 0 }}>
      <header style={{ display: 'grid', gap: 'var(--lab-s1)' }}>
        <MicroLabel mono uppercase tone="muted">{d.lane} · {d.id}{d.asked ? ` · asked ${d.asked}` : ''}</MicroLabel>
        <h3 style={{ margin: 0, fontSize: 'var(--lab-fs-md, 16px)', color: t.inkDeep }}>{d.question}</h3>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 'var(--lab-s3)' }}>
        {d.options.map((o) => (
          <OptionColumn key={o.key} t={t} o={o} group={`decision-${d.id}`} isDefault={d.default === o.key}
            checked={answered ? d.answer?.choice === o.key : picked === o.key} onPick={() => { if (!answered) setChoice(o.key); }} />
        ))}
      </div>
      {answered && d.answer ? (
        <div data-testid="decision-answer" style={{ display: 'flex', gap: 'var(--lab-s3)', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--lab-fs-sm)', color: t.text }}>
          <StatusTag level="ok" word={`answered: ${d.options.find((o) => o.key === d.answer?.choice)?.label ?? d.answer.choice}`} />
          <span>{d.answer.note || <em style={{ color: t.muted }}>no note</em>}</span>
          <MicroLabel mono tone="muted">{d.answer.at}</MicroLabel>
          <button type="button" className="focus-ring" onClick={() => setChanging(true)}
            style={{ background: 'none', border: 'none', color: t.muted, textDecoration: 'underline', cursor: 'pointer', fontSize: 'var(--lab-fs-xs)' }}>Change the answer</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--lab-s2)' }}>
          <LabTextarea t={t} value={note} onChange={setNote} rows={2} label="Note for the lane (optional)" placeholder="Anything the lane should know about this choice" testId="decision-note" />
          <div style={{ display: 'flex', gap: 'var(--lab-s3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <LabButton t={t} testId="decision-save" disabled={!picked || busy || !gate.token} onClick={() => void save()}>{busy ? 'Saving…' : 'Save answer'}</LabButton>
            {changing && <button type="button" className="focus-ring" onClick={() => { setChanging(false); setChoice(null); }} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer' }}>Cancel</button>}
            {!picked && <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>Pick an option first.</span>}
            {picked && !gate.token && <span role="status" style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{gate.error ? `No answer token (${gate.error}).` : 'Getting the answer token…'}</span>}
          </div>
          {error && <span role="alert" data-testid="decision-error" style={{ fontSize: 'var(--lab-fs-xs)', color: t.bad }}>Not saved: {error}</span>}
        </div>
      )}
    </article>
  );
}
