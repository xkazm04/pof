import { motion } from 'framer-motion';
import { BarChart3, Target, Play, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { PlaytestSession, PlaytestFinding, FindingSeverity, FindingCategory } from '@/types/game-director';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MeterBar } from '@/components/ui/MeterBar';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  statusBg, statusBorder,
} from '@/lib/chart-colors';
import {
  SEVERITY_TOKENS, CATEGORY_LABELS, severitySurface, NOT_MEASURED, resolveSessionSource,
} from '@/lib/game-director-styles';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProvenanceNotice } from '../ProvenanceNotice';
import { ACCENT } from './constants';

/** Coverage threshold coloring: green ≥80%, amber ≥50%, red below. */
const coverageBand = (pct: number): string =>
  pct >= 80 ? STATUS_SUCCESS : pct >= 50 ? STATUS_WARNING : STATUS_ERROR;

export function CoverageView({ session, findings, onSimulate }: { session: PlaytestSession; findings: PlaytestFinding[]; onSimulate?: () => Promise<void> }) {
  if (!session.summary) {
    return (
      <EmptyState
        icon={BarChart3}
        iconColor={ACCENT}
        satelliteIcons={[Target, CheckCircle2]}
        title="Coverage data not yet available"
        description="Coverage shows how thoroughly each game system was tested and breaks down findings by severity and category. Complete a playtest to generate coverage data for this session. The built-in simulator does not measure coverage — only a real harness can fill it in."
        action={onSimulate ? { label: 'Simulate Playtest', onClick: () => { void onSimulate(); }, icon: Play } : undefined}
      />
    );
  }

  const categories = Object.entries(session.summary.testCoverage) as Array<[string, number | null]>;
  const source = resolveSessionSource(session);
  const anyMeasured = categories.some(([, pct]) => pct != null);

  // Count findings per severity
  const severityCounts: Record<string, number> = {};
  for (const f of findings) {
    severityCounts[f.severity] = (severityCounts[f.severity] ?? 0) + 1;
  }

  // Count findings per category
  const categoryCounts: Record<string, number> = {};
  for (const f of findings) {
    categoryCounts[f.category] = (categoryCounts[f.category] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <ProvenanceNotice
        source={source}
        findingsCount={source === 'simulated' ? findings.length : undefined}
        detail={
          anyMeasured
            ? undefined
            : 'Coverage was not measured for this session, so no percentage is shown.'
        }
      />

      {/* Test Coverage Bars. A null percentage renders as words, never as a bar:
          the bars used to be fed `Math.floor(60 + Math.random() * 40)` and were
          banded green/amber/red, so a random number carried a verdict. */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          Test Coverage by Category
        </h3>
        <div className="space-y-2.5">
          {categories.map(([cat, pct], idx) => (
            <motion.div
              key={cat}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: idx * 0.05 }}
              className="flex items-center gap-3"
            >
              <span className="text-sm text-text-muted-hover w-28 capitalize">{cat.replace(/-/g, ' ')}</span>
              {pct != null ? (
                <>
                  <MeterBar
                    value={pct}
                    color={coverageBand}
                    height={8}
                    delayMs={300 + idx * 50}
                    ariaLabel={`${cat.replace(/-/g, ' ')} test coverage`}
                    valueText={`${pct}%`}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-text w-8 text-right">{pct}%</span>
                </>
              ) : (
                <>
                  <div
                    className="flex-1 rounded-full border border-dashed border-border"
                    style={{ height: 8 }}
                    aria-hidden="true"
                  />
                  <span className="text-2xs italic text-text-muted whitespace-nowrap">
                    {NOT_MEASURED}
                  </span>
                </>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Severity breakdown */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          Findings by Severity
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {(['critical', 'high', 'medium', 'low', 'positive'] as FindingSeverity[]).map((sev) => {
            const token = SEVERITY_TOKENS[sev];
            const count = severityCounts[sev] ?? 0;
            return (
              <div
                key={sev}
                className="p-3 rounded-lg border text-center"
                style={severitySurface(sev)}
              >
                <span className="text-lg font-bold block" style={{ color: token.color }}>{count}</span>
                <span className="text-2xs text-text-muted">{token.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          Findings by Category
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
            <SurfaceCard
              key={cat}
              className="flex items-center justify-between px-3 py-2"
            >
              <span className="text-sm text-text-muted-hover capitalize">{CATEGORY_LABELS[cat as FindingCategory] ?? cat}</span>
              <span className="text-sm font-semibold text-text">{count}</span>
            </SurfaceCard>
          ))}
        </div>
      </div>

      {/* Summary callouts */}
      {session.summary.topIssue && (
        <div className="p-3 rounded-lg" style={{ backgroundColor: statusBg(STATUS_ERROR), border: `1px solid ${statusBorder(STATUS_ERROR)}` }}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3 h-3" style={{ color: STATUS_ERROR }} />
            <span className="text-2xs uppercase tracking-wider font-semibold" style={{ color: STATUS_ERROR }}>Top Issue</span>
          </div>
          <p className="text-sm text-text">{session.summary.topIssue}</p>
        </div>
      )}
      {session.summary.topPraise && (
        <div className="p-3 rounded-lg" style={{ backgroundColor: statusBg(STATUS_SUCCESS), border: `1px solid ${statusBorder(STATUS_SUCCESS)}` }}>
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
            <span className="text-2xs uppercase tracking-wider font-semibold" style={{ color: STATUS_SUCCESS }}>Top Praise</span>
          </div>
          <p className="text-sm text-text">{session.summary.topPraise}</p>
        </div>
      )}
    </div>
  );
}
