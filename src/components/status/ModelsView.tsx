'use client';

/**
 * Models panel (Quality Program WS3) — the model policy made visible on /status. Shows, per
 * task class, which Claude model + thinking effort is used, where that choice came from
 * (seed default / WS3 benchmark winner / manual pin), and the benchmark median score + cost
 * when a benchmark has run. This is the "which model for which item" answer the user asked to
 * see surfaced.
 *
 * Load states are honest: a failed policy fetch renders an error + Retry, never an empty
 * table (which would read as "no policy exists"), and a failed benchmark fetch marks the
 * Benchmark column "unavailable" rather than the lie "not benchmarked".
 */
import { useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { PolicyEntry } from '@/lib/model-policy';
import type { BenchmarkAgg } from '@/lib/benchmark-db';

const mono = 'var(--lab-font-mono)';
const cell = { padding: '6px 10px', borderBottom: '1px solid var(--lab-line)', fontSize: 'var(--lab-fs-xs)' } as const;
// 12px is the documented micro-text floor (see MicroLabel) — column heads used to sit at 11px.
const th = { ...cell, fontFamily: mono, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--lab-ink-deep)', textAlign: 'left' as const };

/** Provenance in words: the raw enum ('default') reads as "unset" when it means "seed default". */
const SOURCE_LABEL: Record<PolicyEntry['source'], string> = {
  default: 'seed default',
  benchmark: 'benchmark winner',
  manual: 'manual pin',
};

export function ModelsView() {
  const [policy, setPolicy] = useState<PolicyEntry[] | null>(null);
  const [bench, setBench] = useState<BenchmarkAgg[]>([]);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [benchError, setBenchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      const [p, b] = await Promise.all([
        tryApiFetch<PolicyEntry[]>('/api/model-policy'),
        tryApiFetch<BenchmarkAgg[]>('/api/model-benchmarks'),
      ]);
      if (!live) return;
      if (p.ok) setPolicy(p.data ?? []);
      else setPolicyError(p.error || 'Could not load the model policy.');
      if (b.ok) setBench(b.data ?? []);
      else setBenchError(b.error || 'Could not load benchmark results.');
    })();
    return () => { live = false; };
  }, [reloadKey]);

  const retry = () => {
    setPolicy(null);
    setPolicyError(null);
    setBenchError(null);
    setReloadKey((k) => k + 1);
  };

  // Best benchmark median for the chosen (taskClass, model, effort), if any.
  const benchFor = (p: PolicyEntry) => bench.find((b) => b.taskClass === p.taskClass && b.model === p.model && b.effort === p.effort);
  // Alternatives benchmarked for this task class (for the "why" column).
  const altsFor = (tc: string) => bench.filter((b) => b.taskClass === tc).sort((a, b) => b.medianScore - a.medianScore);

  /** Evidence for the chosen combo — "unknown" and "none run" are kept distinct. */
  const benchLabel = (p: PolicyEntry) => {
    if (benchError) return 'unavailable — load failed';
    const b = benchFor(p);
    if (b) return `median ${b.medianScore} · ${b.samples} run${b.samples === 1 ? '' : 's'}`;
    const alts = altsFor(p.taskClass);
    return alts.length
      ? `not benchmarked · ${alts.length} other combo${alts.length === 1 ? '' : 's'} tested`
      : 'not benchmarked';
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', marginBottom: 'var(--lab-s3)', maxWidth: 720 }}>
        Which Claude model + thinking effort powers each task class. Seed defaults until the WS3
        benchmark writes a data-driven winner. Judging runs strongest (opus/high) on purpose.
      </p>

      {policyError && (
        <div style={{ marginBottom: 'var(--lab-s3)' }}>
          <InlineErrorRetry message={`Model policy: ${policyError}`} onRetry={retry} />
        </div>
      )}

      {/* Live region so the load / empty transition is announced, not just drawn. */}
      <div role="status" aria-live="polite">
        {policy === null && !policyError && (
          <div style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)' }}>Loading policy…</div>
        )}
        {policy?.length === 0 && (
          <div style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', maxWidth: 620 }}>
            No task classes registered yet — the model policy is empty, so every call falls back to
            the CLI default model.
          </div>
        )}
      </div>

      {policy !== null && policy.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--lab-line)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', background: 'var(--lab-panel)' }}>
            <caption className="sr-only">
              Model policy by task class: chosen Claude model and thinking effort, where the choice
              came from, and the benchmark evidence behind it.
            </caption>
            <thead>
              <tr>
                <th scope="col" style={th}>Task class</th>
                <th scope="col" style={th}>Model</th>
                <th scope="col" style={th}>Effort</th>
                <th scope="col" style={th}>Source</th>
                <th scope="col" style={th}>Benchmark</th>
              </tr>
            </thead>
            <tbody>
              {policy.map((p) => (
                <tr key={p.taskClass}>
                  <th scope="row" style={{ ...cell, fontFamily: mono, fontWeight: 400, textAlign: 'left', color: 'var(--lab-text)' }}>{p.taskClass}</th>
                  <td style={{ ...cell, fontFamily: mono, fontWeight: 600, color: 'var(--lab-ink)' }}>{p.model}</td>
                  <td style={{ ...cell, fontFamily: mono, color: 'var(--lab-text)' }}>{p.effort}</td>
                  {/* The word carries the provenance; colour only reinforces it (never hue alone). */}
                  <td style={{ ...cell, color: p.source === 'benchmark' ? 'var(--lab-ok)' : 'var(--lab-muted)' }}>
                    {SOURCE_LABEL[p.source]}{p.benchmarkScore != null ? ` · score ${p.benchmarkScore}` : ''}
                  </td>
                  <td style={{ ...cell, color: 'var(--lab-muted)', fontFamily: mono, fontSize: 12 }}>
                    {benchLabel(p)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {benchError && policy !== null && (
        <div style={{ marginTop: 'var(--lab-s3)' }}>
          <InlineErrorRetry dense message={`Benchmark medians: ${benchError}`} onRetry={retry} />
        </div>
      )}

      {bench.length > 0 && (
        <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', marginTop: 'var(--lab-s3)' }}>
          {bench.length} benchmarked (taskClass × model × effort) combos. Run more with{' '}
          <code style={{ fontFamily: mono }}>npx tsx scripts/model-benchmark.ts</code>.
        </p>
      )}
    </div>
  );
}
