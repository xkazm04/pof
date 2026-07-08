import { Skull, Flame } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ChartLegend } from '@/components/ui/ChartLegend';
import { MetricLabel } from '@/components/ui/MetricLabel';
import { STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';
import type { ThreatBreakdown } from '@/types/combat-simulator';
import { pct, formatNumber } from './helpers';

// ── Threat Breakdown (Death Recap) ──────────────────────────────────────────

export function ThreatBreakdownPanel({ breakdown }: { breakdown: ThreatBreakdown }) {
  const { bySource, byEnemy, totalDeaths, totalDamageTaken } = breakdown;

  if (totalDamageTaken === 0 && bySource.length === 0) return null;

  const topSource = bySource[0];

  const headline = totalDeaths > 0 && topSource && topSource.killShare > 0
    ? `${pct(topSource.killShare)} of deaths came from the ${topSource.enemy} ${topSource.ability.toLowerCase()}`
    : topSource && topSource.damageShare > 0
      ? `${pct(topSource.damageShare)} of damage taken came from the ${topSource.enemy} ${topSource.ability.toLowerCase()}`
      : 'No threats recorded';

  const topSources = bySource.slice(0, 5);
  const topEnemies = byEnemy.slice(0, Math.min(4, byEnemy.length));

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Skull className="w-4 h-4 text-red-400" />
        <h2 className="text-sm font-medium text-text">Death Recap & Threat Breakdown</h2>
        <span className="text-2xs text-text-muted">
          {totalDeaths} death{totalDeaths === 1 ? '' : 's'} · {formatNumber(totalDamageTaken)} dmg taken
        </span>
      </div>

      {/* Headline */}
      <div className="mb-3 px-3 py-2 rounded-lg bg-status-red-subtle border border-status-red-strong">
        <div className="flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-xs text-text">{headline}</span>
        </div>
        {topSource && topSource.nerfSuggestion !== 'Within tolerance.' && (
          <div className="mt-1 ml-5 text-2xs text-text-muted/90 italic">
            Nerf hint: {topSource.nerfSuggestion}
          </div>
        )}
      </div>

      {/* Key for the dual-bar encoding — kill share (red) over damage share (amber). */}
      <ChartLegend
        className="mb-3"
        dense
        ariaLabel="Threat bar legend"
        items={[
          {
            color: STATUS_ERROR,
            label: 'Kill share',
            labelNode: <MetricLabel metricId="killShare" label="Kill share" className="text-2xs font-medium text-text" />,
            description: '% of deaths',
          },
          {
            color: STATUS_WARNING,
            label: 'Damage share',
            labelNode: <MetricLabel metricId="damageShare" label="Damage share" className="text-2xs font-medium text-text" />,
            description: '% of damage taken',
          },
        ]}
      />

      {/* Per-enemy ranking */}
      {topEnemies.length > 0 && (
        <div className="mb-4">
          <div className="text-2xs text-text-muted font-medium uppercase tracking-wide mb-1.5">
            By enemy
          </div>
          <div className="space-y-1.5">
            {topEnemies.map((e) => (
              <ThreatRow
                key={e.enemy}
                label={e.enemy}
                killShare={e.killShare}
                damageShare={e.damageShare}
                killCount={e.killCount}
                nerfSuggestion={e.nerfSuggestion}
              />
            ))}
          </div>
        </div>
      )}

      {/* Per-source ranking (enemy → ability) */}
      {topSources.length > 0 && (
        <div>
          <div className="text-2xs text-text-muted font-medium uppercase tracking-wide mb-1.5">
            By ability
          </div>
          <div className="space-y-1.5">
            {topSources.map((s) => (
              <ThreatRow
                key={`${s.enemy}|${s.abilityId}`}
                label={`${s.enemy} → ${s.ability}`}
                killShare={s.killShare}
                damageShare={s.damageShare}
                killCount={s.killCount}
                nerfSuggestion={s.nerfSuggestion}
              />
            ))}
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}

function ThreatRow({
  label, killShare, damageShare, killCount, nerfSuggestion,
}: {
  label: string;
  killShare: number;
  damageShare: number;
  killCount: number;
  nerfSuggestion: string;
}) {
  const isTopThreat = killShare >= 0.4 || damageShare >= 0.3;
  const hasNerf = nerfSuggestion !== 'Within tolerance.';
  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 rounded bg-surface-deep/50">
      <div className="flex items-center gap-2">
        <span className={`text-2xs flex-1 truncate ${isTopThreat ? 'text-red-400 font-medium' : 'text-text'}`}>
          {label}
        </span>
        <span className="text-2xs text-text-muted whitespace-nowrap">
          {killCount > 0 && (
            <>
              <span className={isTopThreat ? 'text-red-400 font-mono' : 'text-text font-mono'}>{pct(killShare)}</span>
              <span className="text-text-muted/60"> kills · </span>
            </>
          )}
          <span className="font-mono">{pct(damageShare)}</span>
          <span className="text-text-muted/60"> dmg</span>
        </span>
      </div>
      {/* Dual-bar: kill share (red) on top of damage share (amber) */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative h-2 bg-surface-deep rounded overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-amber-400/50"
            style={{ width: `${Math.min(100, damageShare * 100)}%` }}
          />
          {killShare > 0 && (
            <div
              className="absolute inset-y-0 left-0 bg-red-400/70 border-r border-red-400/80"
              style={{ width: `${Math.min(100, killShare * 100)}%` }}
            />
          )}
        </div>
      </div>
      {hasNerf && (
        <div className="text-2xs text-text-muted/80 italic pl-0.5">
          {nerfSuggestion}
        </div>
      )}
    </div>
  );
}
