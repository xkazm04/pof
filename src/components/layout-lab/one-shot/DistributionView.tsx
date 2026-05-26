'use client';

import type { LabTheme } from '../theme';

export interface DistributionBucket {
  label: string;
  count: number;
  underRep: boolean;
}

interface Props {
  t: LabTheme;
  buckets: DistributionBucket[];
  total: number;
}

/**
 * Gap-analysis histogram — shows per-category counts; under-represented buckets
 * are highlighted via the theme warn token (no hard-coded hex).
 */
export function DistributionView({ t, buckets, total }: Props) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const underRep = buckets.filter((b) => b.underRep);

  return (
    <div>
      <div
        className={t.fontMono}
        style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.muted, marginBottom: 8 }}
      >
        Distribution · {total} entities
      </div>

      {/* histogram */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {buckets.map((b) => (
          <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              className={t.fontMono}
              style={{ width: 120, fontSize: 12, color: b.underRep ? t.warn : t.muted, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
            <span className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>{b.count}</span>
          </div>
        ))}
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
          </span>
        </div>
      )}
    </div>
  );
}
