'use client';

import type { LabTheme } from '../theme';
import type { DimensionLanding, ProposalLanding as Landing } from '@/lib/catalog/gap-analysis/landing';

interface Props {
  t: LabTheme;
  landing: Landing;
  /** Same cap as the free-text Refine (3 turns unless Force more). */
  refineDisabled: boolean;
  /** Present when the proposal is off (or missing) its target: one-click corrective refine. */
  onRefineToTarget?: () => void;
}

function gapNote(d: DimensionLanding): string {
  if (!d.gap) return '';
  if (d.gap.closes === true) return ` · closes gap ~${d.gap.expected}`;
  if (d.gap.closes === false) return ` · gap ~${d.gap.expected} still short`;
  return ` · gap ~${d.gap.expected}`;
}

function DimensionRow({ t, d }: { t: LabTheme; d: DimensionLanding }) {
  const label = (
    <span className={t.fontMono} style={{ width: 88, flexShrink: 0, fontSize: 12, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {d.attribute}
    </span>
  );
  if (d.state === 'missing') {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {label}
        <span className={t.fontMono} style={{ fontSize: 12, color: t.warn }}>
          carries no {d.attribute} — will not count toward any bucket
        </span>
      </div>
    );
  }
  const max = Math.max(1, ...d.buckets.map((b) => b.after));
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} data-testid={`landing-${d.attribute}`}>
      {label}
      <span className={t.fontMono} style={{ width: 80, flexShrink: 0, fontSize: 12, color: t.inkDeep, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {d.value}
      </span>
      <div style={{ flex: 1, display: 'flex', height: 10, minWidth: 40 }} aria-hidden="true">
        <div style={{ width: `${(d.before / max) * 100}%`, background: t.ink }} />
        <div style={{ width: `${(1 / max) * 100}%`, minWidth: 3, background: d.gap?.closes ? t.ok : t.warn }} />
      </div>
      <span className={t.fontMono} style={{ fontSize: 12, color: t.muted, whiteSpace: 'nowrap' }}>
        {d.before} → {d.after}{d.newBucket ? ' · new bucket' : ''}{gapNote(d)}
      </span>
    </div>
  );
}

function TargetRow({ t, landing, refineDisabled, onRefineToTarget }: Props) {
  const v = landing.target;
  if (v.state === 'none') return null;
  if (v.state === 'on') {
    const d = landing.dimensions[v.attribute];
    const counts = d ? ` (${d.before} → ${d.after}${d.gap ? ` of ~${d.gap.expected}` : ''})` : '';
    const verdict = d?.gap?.closes === true ? ' · gap closed' : d?.gap?.closes === false ? ' · gap still short' : '';
    return (
      <div className={t.fontMono} style={{ fontSize: 12, color: t.ok, marginBottom: 8 }}>
        on target · fills {v.attribute}={v.value}{counts}{verdict}
      </div>
    );
  }
  const carries = v.state === 'off' ? v.got : `no ${v.attribute}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
      <span className={t.fontMono} style={{ fontSize: 12, color: t.warn, flex: 1 }}>
        off target · aimed at {v.attribute}={v.want}, carries {carries}
      </span>
      {onRefineToTarget && (
        <button
          type="button"
          onClick={onRefineToTarget}
          disabled={refineDisabled}
          className={t.fontMono}
          style={{
            fontSize: 12, padding: '4px 10px', background: 'transparent', color: t.warn,
            border: `1px solid ${t.warn}`, cursor: refineDisabled ? 'not-allowed' : 'pointer', opacity: refineDisabled ? 0.5 : 1,
          }}
        >
          Refine to target
        </button>
      )}
    </div>
  );
}

/**
 * Where the proposal lands, shown at the 'Run pipeline' spend gate: the target verdict (on /
 * off / missing, with a one-click corrective refine) and, per measured dimension, the bucket it
 * joins with before → after, a new bucket, or the gap it closes. A warning, never a block.
 */
export function ProposalLanding(props: Props) {
  const { t, landing } = props;
  const dims = Object.values(landing.dimensions);
  return (
    <div data-testid="proposal-landing" style={{ border: `1px solid ${t.line}`, background: t.panel, padding: '10px 14px', marginBottom: 12 }}>
      <div className={t.fontMono} style={{ fontSize: 12, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        Where it lands
      </div>
      <TargetRow {...props} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {dims.map((d) => <DimensionRow key={d.attribute} t={t} d={d} />)}
      </div>
    </div>
  );
}
