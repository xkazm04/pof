import { Zap } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { BalanceAlert, CombatSummary, SimulationResult } from '@/types/combat-simulator';
import { AbilityHeatmap } from './AbilityHeatmap';
import { ThreatBreakdownPanel } from './ThreatBreakdownPanel';
import { DistributionChart } from './DistributionChart';
import { AlertsSection } from './AlertsSection';
import { MiniStat } from './StatCards';

// ── Advanced view: the full numeric breakdown. ──────────────────────────────

export function AdvancedResults({
  summary, alerts, result,
}: {
  summary: CombatSummary;
  alerts: BalanceAlert[];
  result: SimulationResult | null;
}) {
  return (
    <>
      {/* Ability Heatmap */}
      <AbilityHeatmap heatmap={summary.abilityHeatmap} />

      {/* Death Recap: Threat Breakdown */}
      <ThreatBreakdownPanel breakdown={summary.threatBreakdown} />

      {/* Distributions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DistributionChart title="Damage Dealt" buckets={summary.damageDealtBuckets} color="emerald" />
        <DistributionChart title="Damage Taken" buckets={summary.damageTakenBuckets} color="red" />
        <DistributionChart title="Fight Duration" buckets={summary.durationBuckets} color="blue" unit="s" />
      </div>

      {/* Extra stats */}
      <SurfaceCard className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <MiniStat label="Avg Crit Rate" metricId="avgCritRate" value={`${(summary.avgCritRate * 100).toFixed(1)}%`} />
          <MiniStat label="One-Shot Rate" metricId="oneShotRate" value={`${(summary.oneShotRate * 100).toFixed(1)}%`} alert={summary.oneShotRate > 0.05} />
          <MiniStat label="Avg HP Left" metricId="avgPlayerHealthRemaining" value={`${summary.avgPlayerHealthRemaining.toFixed(0)}`} />
          <MiniStat label="Median Duration" metricId="medianFightDurationSec" value={`${summary.medianFightDurationSec.toFixed(1)}s`} />
        </div>
      </SurfaceCard>

      {/* Balance Alerts */}
      <AlertsSection alerts={alerts} />

      {/* Sim meta */}
      {result && (
        <div className="flex items-center gap-2 text-2xs text-text-muted">
          <Zap className="w-3 h-3" />
          {result.config.iterations} iterations in {result.durationMs}ms · Seed: {result.config.seed}
        </div>
      )}
    </>
  );
}
