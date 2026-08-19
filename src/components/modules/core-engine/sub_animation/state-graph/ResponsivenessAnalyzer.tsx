'use client';

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  withOpacity, OPACITY_8, OPACITY_20, OPACITY_25, GLOW_SM,
} from '@/lib/chart-colors';
import { useManifest } from '@/hooks/useManifest';
import { BlueprintPanel, SectionHeader, GlowStat } from '../../unique-tabs/_design';
import {
  ACCENT, getGrade, computeResponsiveness, timingsFromManifest,
  type AnimStateName, type ResponsivenessResult, type ManifestTimingRead,
} from '../_shared/data';

const SUMMARY_STATES: AnimStateName[] = ['Locomotion', 'Attacking', 'Dodging', 'HitReact'];

/**
 * Predictive Responsiveness Analyzer.
 *
 * Every second on this panel is read from the PoF bridge manifest — montage
 * durations and cancel notifies. When the bridge has given us nothing, the panel
 * renders no latency, no grade and no genre-norm comparison, and says so: it
 * used to print per-transition milliseconds and letter grades against a project
 * it had never opened.
 */
export function ResponsivenessAnalyzer() {
  const { manifest, isConnected } = useManifest();

  const read: ManifestTimingRead = useMemo(
    () => timingsFromManifest(isConnected ? manifest?.animAssets : null),
    [isConnected, manifest],
  );
  const results = useMemo(() => computeResponsiveness(read.timings), [read.timings]);
  const measured = results.length > 0;

  return (
    <BlueprintPanel color={ACCENT} className="p-4 col-span-full">
      <SectionHeader label="Predictive Responsiveness Analyzer" color={ACCENT} />
      <SourceStatement
        measured={measured}
        isConnected={isConnected}
        projectName={manifest?.projectName}
        read={read}
      />
      {measured && (
        <div className="space-y-3">
          <SummaryGauges results={results} />
          <ResponsivenessTable results={results} />
          <LatencyBarChart results={results} />
        </div>
      )}
    </BlueprintPanel>
  );
}

/* ── Provenance statement ──────────────────────────────────────────────────── */

function SourceStatement({ measured, isConnected, projectName, read }: {
  measured: boolean; isConnected: boolean; projectName?: string; read: ManifestTimingRead;
}) {
  const skipped = read.withoutDuration.length + read.unclassified.length;

  return (
    <p
      data-testid="responsiveness-source"
      data-measured={measured ? 'true' : 'false'}
      className="text-xs font-mono text-text-muted mt-1 mb-3 leading-relaxed"
    >
      {measured ? (
        <>
          <span className="font-bold" style={{ color: STATUS_SUCCESS }}>SOURCE: PoF bridge manifest</span>
          {projectName ? <> ({projectName})</> : null} — montage durations and cancel notifies, in seconds,
          for {read.timings.length} of {read.montages} montage{read.montages === 1 ? '' : 's'} it carried.
          {skipped > 0 && <> {skipped} skipped: {describeSkipped(read)}.</>}
          {' '}Transition topology is PoF&apos;s declared ARPG state machine, not a scan of your AnimBP.
          Blend-in time is not carried by the manifest, so none is added.
        </>
      ) : (
        <>
          <span className="font-bold" style={{ color: STATUS_WARNING }}>NOT MEASURED</span>
          {' — '}
          {!isConnected
            ? 'the PoF bridge is not connected, so no montage duration has been read from your project.'
            : read.montages === 0
              ? 'the bridge manifest carried no AnimMontage entry, so there is no duration to derive latency from.'
              : `the bridge manifest carried ${read.montages} montage${read.montages === 1 ? '' : 's'}, none usable — ${describeSkipped(read)}.`}
          {' '}No latency, no letter grade and no genre-norm comparison is shown below. That is an absence
          of measurement, not a verdict on how your game feels.
        </>
      )}
    </p>
  );
}

function describeSkipped(read: ManifestTimingRead): string {
  const parts: string[] = [];
  if (read.withoutDuration.length > 0) parts.push(`${read.withoutDuration.length} with no duration`);
  if (read.unclassified.length > 0) {
    parts.push(`${read.unclassified.length} whose name maps to no state (${read.unclassified.slice(0, 4).join(', ')})`);
  }
  return parts.join('; ');
}

/* ── Summary gauges ────────────────────────────────────────────────────────── */

function SummaryGauges({ results }: { results: ResponsivenessResult[] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {SUMMARY_STATES.map((state, idx) => {
        const stateResults = results.filter(r => r.from === state);
        if (stateResults.length === 0) return null;
        const avgAll = stateResults.reduce((s, r) => s + r.avgCase, 0) / stateResults.length;
        const grade = getGrade(avgAll);
        return (
          <GlowStat
            key={state}
            label={state}
            value={`${(avgAll * 1000).toFixed(0)}ms`}
            unit={grade.label}
            color={grade.color}
            delay={idx * 0.05}
          />
        );
      })}
    </div>
  );
}

/* ── Detail Table ──────────────────────────────────────────────────────────── */

function ResponsivenessTable({ results }: { results: ResponsivenessResult[] }) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-1.5 pr-3 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Action</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center">Best</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center">Avg</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center">Worst</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center">Grade</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Read from</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Gate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/20">
          {results.map((r, i) => {
            const grade = getGrade(r.avgCase);
            return (
              <tr
                key={`${r.from}-${r.to}-${r.action}-${i}`}
                data-testid="responsiveness-row"
                data-avg-ms={(r.avgCase * 1000).toFixed(0)}
                className="hover:bg-surface/30 transition-colors"
              >
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    {r.exceedsNorm && <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_WARNING }} />}
                    <span className="font-mono text-text">{r.action}</span>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-center font-mono" style={{ color: getGrade(r.bestCase).color }}>
                  {(r.bestCase * 1000).toFixed(0)}ms
                </td>
                <td className="py-1.5 px-2 text-center font-mono font-bold" style={{ color: grade.color }}>
                  {(r.avgCase * 1000).toFixed(0)}ms
                </td>
                <td className="py-1.5 px-2 text-center font-mono" style={{ color: getGrade(r.worstCase).color }}>
                  {(r.worstCase * 1000).toFixed(0)}ms
                </td>
                <td className="py-1.5 px-2 text-center">
                  <span
                    data-testid="responsiveness-grade"
                    className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-md"
                    style={{ backgroundColor: withOpacity(grade.color, OPACITY_8), color: grade.color, border: `1px solid ${withOpacity(grade.color, OPACITY_20)}` }}
                  >
                    {grade.label}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-xs font-mono text-text-muted" title={r.sourcePath}>{r.derivedFrom}</td>
                <td className="py-1.5 px-2">
                  <span className="text-xs font-mono px-1 py-0.5 rounded bg-surface-deep border border-border/30 text-text-muted">
                    {r.gateBool}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Latency Bar Chart ─────────────────────────────────────────────────────── */

function LatencyBarChart({ results }: { results: ResponsivenessResult[] }) {
  const maxMs = Math.max(600, ...results.map(r => r.worstCase * 1000));
  return (
    <div className="space-y-1">
      <div className="text-xs font-mono font-bold text-text-muted uppercase tracking-[0.15em]">
        Response Latency Comparison
      </div>
      {results.map((r, i) => {
        const barPct = Math.min((r.avgCase * 1000 / maxMs) * 100, 100);
        const bestPct = Math.min((r.bestCase * 1000 / maxMs) * 100, 100);
        const worstPct = Math.min((r.worstCase * 1000 / maxMs) * 100, 100);
        const normPct = Math.min((r.normThreshold * 1000 / maxMs) * 100, 100);
        const grade = getGrade(r.avgCase);
        return (
          <div key={`${r.from}-${r.to}-${r.action}-${i}`} className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-muted w-36 truncate" title={r.action}>{r.action}</span>
            <div className="flex-1 relative h-4 rounded bg-surface-deep">
              <div
                className="absolute top-0 h-full rounded opacity-20"
                style={{ left: `${bestPct}%`, width: `${worstPct - bestPct}%`, backgroundColor: grade.color }}
              />
              <div
                className="absolute top-0.5 h-3 rounded-sm"
                style={{ width: `${barPct}%`, backgroundColor: grade.color, boxShadow: `${GLOW_SM} ${withOpacity(grade.color, OPACITY_25)}` }}
              />
              <div
                className="absolute top-0 w-[2px] h-full"
                style={{ left: `${normPct}%`, backgroundColor: STATUS_WARNING }}
                title={`Genre norm: ${r.normThreshold * 1000}ms`}
              />
            </div>
            <span className="text-xs font-mono w-12 text-right" style={{ color: grade.color }}>
              {(r.avgCase * 1000).toFixed(0)}ms
            </span>
          </div>
        );
      })}
      {/* Legend */}
      <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_SUCCESS }} /> &lt;100ms
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_WARNING }} /> 100-250ms
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_ERROR }} /> &gt;500ms
        </span>
        <span className="flex items-center gap-1">
          <span className="w-[2px] h-3" style={{ backgroundColor: STATUS_WARNING }} /> Genre norm
        </span>
      </div>
    </div>
  );
}
