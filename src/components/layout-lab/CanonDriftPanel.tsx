'use client';

import { useState } from 'react';
import type { LabTheme } from './theme';
import { useCanonStore } from './canonStore';
import { LabButton } from './steps/controls';
import { FINDING_VERDICTS, type CanonFinding, type FindingVerdict } from '@/lib/catalog/canon/canonSync';

/** What each verdict means to the operator — the closed vocabulary of `canonSync.ts`. */
const VERDICT_COPY: Record<FindingVerdict, { label: string; hint: string }> = {
  unrecorded: { label: 'Unrecorded', hint: 'Seeded before provenance was recorded: a stale seed or your own edit. Nothing on disk tells them apart, so you decide.' },
  conflict: { label: 'Conflict', hint: 'You edited this rule, and the shipped law has moved since.' },
  missing: { label: 'Missing', hint: 'Shipped, but never in this DB.' },
  orphaned: { label: 'Orphaned', hint: 'No longer shipped. Remove it with Delete in the canon list if it is retired.' },
};

/** A drift finding counts toward a profile's review. */
export function driftCount(byVerdict: Partial<Record<FindingVerdict, CanonFinding[]>> | undefined): number {
  return byVerdict ? Object.values(byVerdict).reduce((n, fs) => n + (fs?.length ?? 0), 0) : 0;
}

function SmallButton({ t, label, aria, onClick, tone }: { t: LabTheme; label: string; aria: string; onClick: () => void; tone?: string }) {
  return (
    <button onClick={onClick} aria-label={aria} className={t.fontMono}
      style={{ fontSize: 13, cursor: 'pointer', background: 'transparent', border: `1px solid ${tone ?? t.line}`, color: tone ?? t.text, padding: '3px 10px', borderRadius: t.glass ? 6 : 0 }}>
      {label}
    </button>
  );
}

function TextColumn({ t, heading, body }: { t: LabTheme; heading: string; body: string | null }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className={t.fontMono} style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted, marginBottom: 4 }}>{heading}</div>
      {body === null
        ? <p className={t.fontBody} style={{ fontSize: 14, color: t.muted, fontStyle: 'italic', margin: 0 }}>(none)</p>
        : <p className={t.fontBody} style={{ fontSize: 14, color: t.text, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{body}</p>}
    </div>
  );
}

function DriftRow({ t, f, onAdopt, onKeep }: { t: LabTheme; f: CanonFinding; onAdopt: () => void; onKeep: () => void }) {
  return (
    <div style={{ border: `1px solid ${t.line}`, borderRadius: t.glass ? 10 : 0, padding: '12px 14px', background: t.panel, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span className={t.fontBody} style={{ fontSize: 15, fontWeight: 600, color: t.inkDeep, flex: 1, minWidth: 160 }}>{f.title}</span>
        <span className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>{f.id}</span>
        {f.verdict !== 'orphaned' && <SmallButton t={t} label={f.verdict === 'missing' ? 'Add shipped' : 'Adopt shipped'} aria={`Adopt shipped ${f.id}`} onClick={onAdopt} tone={t.ink} />}
        {f.verdict !== 'orphaned' && <SmallButton t={t} label={f.verdict === 'missing' ? 'Dismiss' : 'Keep mine'} aria={`Keep mine ${f.id}`} onClick={onKeep} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <TextColumn t={t} heading="Your DB (cited in produce prompts)" body={f.dbBody} />
        <TextColumn t={t} heading="Shipped (graded by the checkers)" body={f.shippedBody} />
      </div>
    </div>
  );
}

/**
 * The canon drift review for one profile: every shipped/DB disagreement side by side, answered
 * per rule or in bulk. Nothing here writes without a click, the bulk adopt previews its count
 * first, and every adopt stays undoable (the replaced row is archived server-side).
 */
export function CanonDriftPanel({ t, profileId }: { t: LabTheme; profileId: string }) {
  const drift = useCanonStore((s) => s.drift);
  const adopt = useCanonStore((s) => s.adopt);
  const keep = useCanonStore((s) => s.keep);
  const undoAdopt = useCanonStore((s) => s.undoAdopt);
  const reviewError = useCanonStore((s) => s.reviewError);
  const [confirming, setConfirming] = useState(false);

  const byVerdict = drift?.byProfile[profileId];
  const unrecordedIds = (byVerdict?.unrecorded ?? []).map((f) => f.id);
  const adopted = (drift?.adopted ?? []).filter((a) => a.profile === profileId);

  return (
    <section aria-label="Canon drift review" style={{ border: `1px solid ${t.warn}`, borderRadius: t.glass ? 10 : 0, padding: '16px 18px', marginBottom: 28 }}>
      <p className={t.fontBody} style={{ fontSize: 14, color: t.text, margin: '0 0 12px' }}>
        {driftCount(byVerdict)} rule(s) need a decision. Produce prompts cite the DB text on the left; the checkers grade by the shipped law on the right.
      </p>
      {reviewError && <p role="alert" className={t.fontMono} style={{ fontSize: 13, color: t.bad, margin: '0 0 12px' }}>{reviewError}</p>}

      {unrecordedIds.length > 0 && (confirming ? (
        <div style={{ border: `1px solid ${t.ink}`, padding: '12px 14px', marginBottom: 16, borderRadius: t.glass ? 8 : 0 }}>
          <p className={t.fontBody} style={{ fontSize: 14, color: t.text, margin: '0 0 10px' }}>
            {unrecordedIds.length} rules will be overwritten with the shipped text. Each replaced row is archived and can be undone below.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <LabButton t={t} onClick={() => { setConfirming(false); void adopt(unrecordedIds); }}>{`Confirm adopt ${unrecordedIds.length}`}</LabButton>
            <SmallButton t={t} label="Cancel" aria="Cancel" onClick={() => setConfirming(false)} />
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <LabButton t={t} onClick={() => setConfirming(true)}>{`Adopt shipped for all ${unrecordedIds.length} unrecorded`}</LabButton>
        </div>
      ))}

      {FINDING_VERDICTS.map((verdict) => {
        const findings = byVerdict?.[verdict] ?? [];
        if (!findings.length) return null;
        return (
          <div key={verdict} style={{ marginBottom: 18 }}>
            <h4 className={t.fontMono} style={{ fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.ink, margin: '0 0 2px' }}>{VERDICT_COPY[verdict].label} ({findings.length})</h4>
            <p className={t.fontBody} style={{ fontSize: 13, color: t.muted, margin: '0 0 8px' }}>{VERDICT_COPY[verdict].hint}</p>
            {findings.map((f) => <DriftRow key={f.id} t={t} f={f} onAdopt={() => void adopt([f.id])} onKeep={() => void keep([f.id])} />)}
          </div>
        );
      })}

      {adopted.length > 0 && (
        <div>
          <h4 className={t.fontMono} style={{ fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.ink, margin: '0 0 8px' }}>Adopted (undoable)</h4>
          {adopted.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className={t.fontMono} style={{ fontSize: 13, color: t.text, flex: 1 }}>{a.id} <span style={{ color: t.muted }}>{a.adoptedAt}</span></span>
              <SmallButton t={t} label="Undo" aria={`Undo adopt ${a.id}`} onClick={() => void undoAdopt([a.id])} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
