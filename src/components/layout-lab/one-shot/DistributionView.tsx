'use client';

import type { LabTheme } from '../theme';

export interface DistributionBucket {
  label: string;
  count: number;
  underRep: boolean;
  /** Expected count, when the bucket is an under-represented (measured) gap. */
  expected?: number;
}

interface Props {
  t: LabTheme;
  buckets: DistributionBucket[];
  total: number;
  /** The dimension this histogram measures (e.g. `rarity`). */
  attribute?: string;
  /** When set, under-represented buckets are buttons that propose aimed at that gap. */
  onPick?: (bucket: DistributionBucket) => void;
}

/**
 * Gap-analysis histogram for one dimension — per-bucket counts; under-represented buckets are
 * highlighted via the theme warn token (no hard-coded hex) and, with `onPick`, are clickable.
 */
export function DistributionView({ t, buckets, total, attribute, onPick }: Props) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const underRep = buckets.filter((b) => b.underRep);

  const row = (b: DistributionBucket) => (
    <>
      <div
        className={t.fontMono}
        style={{ width: 120, fontSize: 12, color: b.underRep ? t.warn : t.muted, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}
      >
        {b.label}
      </div>
      <div
        style={{
          height: 10,
          width: `${Math.round((b.count / max) * 100)}%`,
          minWidth: 2,
          background: b.underRep ? t.warn : t.ink,
          transition: 'width 0.2s',
        }}
      />
      <span className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>
        {b.count}{b.expected !== undefined ? `/~${b.expected}` : ''}
      </span>
    </>
  );

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <div>
      <div
        className={t.fontMono}
        style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.muted, marginBottom: 8 }}
      >
        {attribute ? `by ${attribute}` : 'Distribution'} · {total} entities
      </div>

      {/* histogram */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {buckets.map((b) => (onPick && b.underRep ? (
          <button
            key={b.label}
            type="button"
            onClick={() => onPick(b)}
            aria-label={`Propose ${attribute ?? ''}=${b.label} (have ${b.count}, expected ~${b.expected ?? '?'})`}
            style={{ ...rowStyle, width: '100%', padding: 0, cursor: 'pointer', background: 'transparent', border: `1px dashed ${t.warn}` }}
          >
            {row(b)}
          </button>
        ) : (
          <div key={b.label} style={rowStyle}>{row(b)}</div>
        )))}
      </div>

      {/* under-rep block */}
      {underRep.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            border: `1px solid ${t.warn}`,
            background: 'transparent',
          }}
        >
          <span className={t.fontMono} style={{ fontSize: 12, color: t.warn }}>
            Under-represented: {underRep.map((b) => b.label).join(', ')}
            {onPick ? ' — click a highlighted bar to propose for it' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
