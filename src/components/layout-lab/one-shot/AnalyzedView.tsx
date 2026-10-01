'use client';

import { useState } from 'react';
import type { LabTheme } from '../theme';
import { DistributionView, type DistributionBucket } from './DistributionView';
import { gapBasisOf, type CatalogDistribution } from '@/lib/catalog/gap-analysis';
import { gapTargetAction, type GapTarget } from '@/lib/catalog/gap-analysis/rankGaps';

/** One histogram per measured dimension — every dimension, not only the first key. */
function dimensionBuckets(d: CatalogDistribution, attr: string): DistributionBucket[] {
  const gaps = new Map(d.underrepresented.filter((u) => u.attribute === attr).map((u) => [u.value, u]));
  const buckets: DistributionBucket[] = Object.entries(d.byAttribute[attr]).map(([label, count]) => ({
    label, count, underRep: gaps.has(label), expected: gaps.get(label)?.expected,
  }));
  // A gap bucket with ZERO entities has no histogram key — it is still a gap, so show it.
  for (const [value, u] of gaps) {
    if (!(value in d.byAttribute[attr])) buckets.push({ label: value, count: u.count, underRep: true, expected: u.expected });
  }
  return buckets;
}

interface DimensionsProps {
  t: LabTheme;
  distribution: CatalogDistribution;
  onPick?: (target: GapTarget) => void;
}

export function DistributionDimensions({ t, distribution: d, onPick }: DimensionsProps) {
  const attrs = Object.keys(d.byAttribute);
  if (!attrs.length) {
    return <div className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>No distribution data yet</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {attrs.map((attr) => (
        <DistributionView
          key={attr}
          t={t}
          attribute={attr}
          buckets={dimensionBuckets(d, attr)}
          total={d.total}
          onPick={onPick && ((b) => onPick({
            catalogId: d.catalogId, attribute: attr, value: b.label,
            count: b.count, expected: b.expected ?? 0, deficit: (b.expected ?? 0) - b.count,
          }))}
        />
      ))}
      {gapBasisOf(d) === 'none' && (
        <div className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>
          Gaps not measured — this catalog declares no expected share (not a finding of balance).
        </div>
      )}
    </div>
  );
}

/** The gap the current proposal is aimed at, phrased as the action it was picked for. */
export function TargetLine({ t, target }: { t: LabTheme; target: GapTarget | null }) {
  if (!target) return null;
  return (
    <div className={t.fontMono} style={{ fontSize: 12, color: t.warn, marginBottom: 12 }}>
      Target · {gapTargetAction(target)}
    </div>
  );
}

interface AnalyzedProps {
  t: LabTheme;
  distribution: CatalogDistribution;
  onPick: (target: GapTarget, hint: string | undefined) => void;
  onPropose: (hint: string | undefined) => void;
  onBack: () => void;
}

/**
 * Resting `analyzed` phase: the whole distribution is on screen and nothing has been spent.
 * The operator clicks a gap bar, or proposes with an optional direction written against it.
 */
export function AnalyzedView({ t, distribution, onPick, onPropose, onBack }: AnalyzedProps) {
  const [hint, setHint] = useState('');
  const btn: React.CSSProperties = { fontSize: 13, padding: '7px 12px', cursor: 'pointer', fontWeight: 600 };
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <DistributionDimensions t={t} distribution={distribution} onPick={(g) => onPick(g, hint.trim() || undefined)} />
      </div>
      <label htmlFor="oneshot-hint" className={t.fontMono} style={{ display: 'block', fontSize: 12, color: t.muted, marginBottom: 4 }}>
        Direction (optional)
      </label>
      <input
        id="oneshot-hint"
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder="e.g. a caster that punishes stacking"
        className="focus-ring-inset"
        style={{
          width: '100%', fontSize: 14, padding: '7px 10px', marginBottom: 10, boxSizing: 'border-box',
          background: t.panel, color: t.text, border: `1px solid ${t.line}`,
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => onPropose(hint.trim() || undefined)}
          className={t.fontMono}
          style={{ ...btn, flex: 1, background: t.ink, color: t.onAccent, border: `1px solid ${t.ink}` }}
        >
          Propose (model picks the gap)
        </button>
        <button
          type="button"
          onClick={onBack}
          className={t.fontMono}
          style={{ ...btn, background: 'transparent', color: t.muted, border: `1px solid ${t.line}` }}
        >
          Back
        </button>
      </div>
    </div>
  );
}
