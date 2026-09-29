'use client';

/**
 * CalibrationLabelBar — the calibration bench, mounted under the Evidence modal's stored output.
 *
 * The operator labels the artifact they are LOOKING AT (fail / placeholder / shippable); the POST
 * carries the `stepContentHash` of that content so the server refuses a label for content that
 * moved since the modal opened, and stamps the rubric in force. Progress toward the enforcement
 * floor is split by band so a lopsided set is visible before an Opus `--calibrate` run is spent.
 *
 * ANTI-ANCHORING: the judge's band for this target is shown only once a human label exists.
 * Honest floor: a label is measurement of the judge — it never changes this step's grade.
 */
import { useEffect, useMemo, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { stepContentHash } from '@/lib/judge/contentHash';
import type { Band } from '@/lib/judge/calibration';
import type { CalibrationBenchRead } from '@/lib/judge/calibrationLabels';

const BAND_ORDER: readonly Band[] = ['fail', 'placeholder', 'shippable'];
const mono = 'var(--lab-font-mono)';
const bandColor: Record<Band, string> = { fail: 'var(--lab-bad)', placeholder: 'var(--lab-warn)', shippable: 'var(--lab-ok)' };

type Read = Required<Pick<CalibrationBenchRead, 'progress' | 'standing' | 'cell'>>;

/** A read is usable only when it carries the per-cell shape — anything else is a failed read. */
function asRead(d: unknown): Read | null {
  const r = d as Partial<CalibrationBenchRead> | null;
  return r && typeof r === 'object' && r.progress?.byBand && typeof r.standing === 'string' && r.cell ? (r as Read) : null;
}

export function CalibrationLabelBar({ catalogId, entityId, step, data }: {
  catalogId: string;
  entityId: string;
  step: string;
  /** The stored output on screen — its hash is what the label binds to. */
  data: Record<string, unknown>;
}) {
  const [read, setRead] = useState<Read | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const seenHash = useMemo(() => stepContentHash(data), [data]);

  useEffect(() => {
    let live = true;
    const q = `catalogId=${encodeURIComponent(catalogId)}&entityId=${encodeURIComponent(entityId)}&step=${encodeURIComponent(step)}`;
    tryApiFetch<unknown>(`/api/judge-calibration?${q}`).then((r) => {
      if (!live) return;
      const parsed = r.ok ? asRead(r.data) : null;
      setRead(parsed);
      setError(r.ok ? (parsed ? null : 'unexpected calibration read') : r.error);
    });
    return () => { live = false; };
  }, [catalogId, entityId, step, reload]);

  const submit = async (label: Band) => {
    setSaving(true);
    const r = await tryApiFetch<unknown>('/api/judge-calibration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogId, entityId, step, label, contentHash: seenHash }),
    });
    setSaving(false);
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setReload((n) => n + 1);
  };

  const cell = read?.cell;
  const current = cell?.label && !cell.issue ? cell.label.label : null;
  const p = read?.progress;
  const emptyBands = p ? BAND_ORDER.filter((b) => p.byBand[b] === 0) : [];

  return (
    <section data-testid="calibration-label-bar" aria-label="Judge calibration label"
      style={{ marginTop: 14, padding: '10px 12px', background: 'var(--lab-panel)', border: '1px solid var(--lab-line)', display: 'grid', gap: 8, fontSize: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontFamily: mono, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--lab-ink-deep)' }}>
          Calibration label
        </h3>
        <span style={{ color: 'var(--lab-muted)' }}>
          measures the judge — never changes this grade{read ? ` · judge calibration: ${read.standing}` : ''}
        </span>
      </div>

      {cell && (
        <div style={{ color: 'var(--lab-muted)', fontFamily: mono }}>
          rubric{cell.rubric.cls ? ` ${cell.rubric.cls}` : ''}: {cell.rubric.dimensions.join(' · ') || 'no judgeable class'} — shippable ≥{cell.rubric.bands.shippable} · placeholder {cell.rubric.bands.placeholder}–{cell.rubric.bands.shippable - 1} · fail &lt;{cell.rubric.bands.placeholder}
        </div>
      )}

      <div role="group" aria-label="Your band for this output" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {BAND_ORDER.map((b) => (
          <button key={b} type="button" aria-pressed={current === b} disabled={saving || !read} onClick={() => submit(b)} className="focus-ring"
            style={{ fontFamily: mono, fontSize: 12, padding: '3px 10px', borderRadius: 0, cursor: 'pointer',
              border: `1px solid ${current === b ? bandColor[b] : 'var(--lab-line)'}`,
              color: current === b ? bandColor[b] : 'var(--lab-ink)', background: 'var(--lab-bg)', fontWeight: current === b ? 700 : 400 }}>
            {b}
          </button>
        ))}
        <span style={{ color: 'var(--lab-muted)' }}>
          {!cell ? '' : !cell.label ? 'not labelled' : cell.issue ? `stale: ${cell.issue} (was ${cell.label.label})` : `your label: ${cell.label.label}`}
        </span>
      </div>

      {cell?.judge && current && (
        <div data-testid="calibration-judge" style={{ fontFamily: mono, color: cell.judge.band === current ? 'var(--lab-ok)' : 'var(--lab-bad)' }}>
          judge (last --calibrate run): {cell.judge.band} ({cell.judge.score}) — {cell.judge.band === current ? 'agrees' : 'disagrees with your label'}
        </div>
      )}

      {p && (
        <div data-testid="calibration-progress" style={{ fontFamily: mono, color: 'var(--lab-text)' }}>
          {p.confirmed} of {p.needed} confirmed — {BAND_ORDER.map((b) => `${b} ${p.byBand[b]}`).join(' / ')}
          {emptyBands.length > 0 && (
            <span style={{ color: 'var(--lab-warn)' }}> · no {emptyBands.join(' / ')} label yet — the set is lopsided</span>
          )}
        </div>
      )}

      {error && <div role="alert" style={{ color: 'var(--lab-bad)' }}>Calibration label: {error}</div>}
    </section>
  );
}
