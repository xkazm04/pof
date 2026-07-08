'use client';

/**
 * Models panel (Quality Program WS3) — the model policy made visible on /status. Shows, per
 * task class, which Claude model + thinking effort is used, where that choice came from
 * (seed default / WS3 benchmark winner / manual pin), and the benchmark median score + cost
 * when a benchmark has run. This is the "which model for which item" answer the user asked to
 * see surfaced.
 */
import { useEffect, useState } from 'react';
import type { PolicyEntry } from '@/lib/model-policy';
import type { BenchmarkAgg } from '@/lib/benchmark-db';

const mono = 'var(--lab-font-mono)';
const cell = { padding: '6px 10px', borderBottom: '1px solid var(--lab-line)', fontSize: 13 } as const;
const th = { ...cell, fontFamily: mono, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--lab-ink-deep)', textAlign: 'left' as const };

export function ModelsView() {
  const [policy, setPolicy] = useState<PolicyEntry[] | null>(null);
  const [bench, setBench] = useState<BenchmarkAgg[]>([]);

  useEffect(() => {
    let live = true;
    fetch('/api/model-policy').then((r) => r.json()).then((j) => { if (live) setPolicy(j.data ?? []); }).catch(() => setPolicy([]));
    fetch('/api/model-benchmarks').then((r) => r.json()).then((j) => { if (live) setBench(j.data ?? []); }).catch(() => {});
    return () => { live = false; };
  }, []);

  // Best benchmark median for the chosen (taskClass, model, effort), if any.
  const benchFor = (p: PolicyEntry) => bench.find((b) => b.taskClass === p.taskClass && b.model === p.model && b.effort === p.effort);
  // Alternatives benchmarked for this task class (for the "why" column).
  const altsFor = (tc: string) => bench.filter((b) => b.taskClass === tc).sort((a, b) => b.medianScore - a.medianScore);

  return (
    <div style={{ maxWidth: 900 }}>
      <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', marginBottom: 'var(--lab-s3)', maxWidth: 720 }}>
        Which Claude model + thinking effort powers each task class. Seed defaults until the WS3
        benchmark writes a data-driven winner. Judging runs strongest (opus/high) on purpose.
      </p>
      {policy === null ? (
        <div style={{ fontSize: 13, color: 'var(--lab-muted)' }}>Loading policy…</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--lab-line)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', background: 'var(--lab-panel)' }}>
            <thead>
              <tr>
                <th style={th}>Task class</th>
                <th style={th}>Model</th>
                <th style={th}>Effort</th>
                <th style={th}>Source</th>
                <th style={th}>Benchmark</th>
              </tr>
            </thead>
            <tbody>
              {policy.map((p) => {
                const b = benchFor(p);
                const alts = altsFor(p.taskClass);
                return (
                  <tr key={p.taskClass}>
                    <td style={{ ...cell, fontFamily: mono, color: 'var(--lab-text)' }}>{p.taskClass}</td>
                    <td style={{ ...cell, fontFamily: mono, fontWeight: 600, color: 'var(--lab-ink)' }}>{p.model}</td>
                    <td style={{ ...cell, fontFamily: mono, color: 'var(--lab-text)' }}>{p.effort}</td>
                    <td style={{ ...cell, color: p.source === 'benchmark' ? 'var(--lab-ok)' : 'var(--lab-muted)' }}>
                      {p.source}{p.benchmarkScore != null ? ` (${p.benchmarkScore})` : ''}
                    </td>
                    <td style={{ ...cell, color: 'var(--lab-muted)', fontFamily: mono, fontSize: 12 }}>
                      {b ? `median ${b.medianScore} · n=${b.samples}` : alts.length ? `${alts.length} combos tested` : '— not benchmarked'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
