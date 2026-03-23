'use client';

import {
  ACCENT_ORANGE, ACCENT_CYAN, ACCENT_VIOLET,
  ACCENT_EMERALD, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import { BlueprintPanel } from '../_design';
import type { DodgeParams } from '../dodge-types';
import { RatingBadge } from './RatingBadge';
import {
  type Rating,
  rateForgivenessRatio,
  rateResponsiveness,
  rateStaminaEfficiency,
} from './types';

const FPS = 60;

export function FrameDataTable({ params }: { params: DodgeParams }) {
  const startupFrames = Math.round(params.iFrameStart * FPS);
  const activeFrames = Math.round(params.iFrameDuration * FPS);
  const recoveryDuration = Math.max(0, params.dodgeDuration - (params.iFrameStart + params.iFrameDuration));
  const recoveryFrames = Math.round(recoveryDuration * FPS);
  const cancelWidth = Math.max(0, params.cancelWindowEnd - params.cancelWindowStart);
  const cancelFrames = Math.round(cancelWidth * FPS);
  const totalCommitmentFrames = Math.round(params.dodgeDuration * FPS);
  const totalWithCooldownFrames = Math.round((params.dodgeDuration + params.cooldown) * FPS);

  const forgivenessRatio = params.dodgeDuration > 0
    ? (params.iFrameDuration / params.dodgeDuration) * 100 : 0;
  const responsiveness = params.dodgeDuration > 0
    ? (cancelWidth / params.dodgeDuration) * 100 : 0;
  const dodgesPerBar = params.staminaCost > 0
    ? Math.floor(100 / params.staminaCost) : Infinity;

  const frameRows: { label: string; frames: number; seconds: number; color: string }[] = [
    { label: 'Startup', frames: startupFrames, seconds: params.iFrameStart, color: ACCENT_CYAN },
    { label: 'Active I-Frames', frames: activeFrames, seconds: params.iFrameDuration, color: ACCENT_ORANGE },
    { label: 'Recovery', frames: recoveryFrames, seconds: recoveryDuration, color: STATUS_NEUTRAL },
    { label: 'Cancel Window', frames: cancelFrames, seconds: cancelWidth, color: ACCENT_VIOLET },
    { label: 'Total Active', frames: totalCommitmentFrames, seconds: params.dodgeDuration, color: ACCENT_CYAN },
    { label: 'Total + Cooldown', frames: totalWithCooldownFrames, seconds: params.dodgeDuration + params.cooldown, color: STATUS_NEUTRAL },
  ];

  const metricRows: { label: string; value: string; rating: Rating; color: string }[] = [
    { label: 'Forgiveness Ratio', value: `${forgivenessRatio.toFixed(1)}%`, rating: rateForgivenessRatio(forgivenessRatio), color: ACCENT_ORANGE },
    { label: 'Responsiveness', value: `${responsiveness.toFixed(1)}%`, rating: rateResponsiveness(responsiveness), color: ACCENT_VIOLET },
    {
      label: 'Stamina Efficiency',
      value: dodgesPerBar === Infinity ? '\u221e' : `${dodgesPerBar} dodge${dodgesPerBar !== 1 ? 's' : ''}/bar`,
      rating: dodgesPerBar === Infinity ? 'generous' : rateStaminaEfficiency(dodgesPerBar),
      color: ACCENT_EMERALD,
    },
  ];

  return (
    <div className="space-y-2">
      {/* Frame data table */}
      <BlueprintPanel color={ACCENT_CYAN} noBrackets>
        <FrameDataRows rows={frameRows} />
      </BlueprintPanel>

      {/* Game-feel metrics */}
      <BlueprintPanel color={ACCENT_ORANGE} noBrackets>
        <MetricRows rows={metricRows} />
      </BlueprintPanel>

      {/* Footnote */}
      <div className="text-[10px] font-mono text-text-muted/40 px-0.5">
        Frame counts at 60 FPS &middot; Forgiveness = i-frame% of dodge &middot; Responsiveness = cancel window / dodge duration &middot; Efficiency = dodges per full stamina bar
      </div>
    </div>
  );
}

/* ── Frame data rows sub-table ─────────────────────────────────────────── */

function FrameDataRows({ rows }: { rows: { label: string; frames: number; seconds: number; color: string }[] }) {
  return (
    <table className="w-full text-xs font-mono">
      <thead>
        <tr className="border-b border-border/30" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <th className="text-left py-1.5 px-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Phase</th>
          <th className="text-right py-1.5 px-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Frames</th>
          <th className="text-right py-1.5 px-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Seconds</th>
          <th className="text-right py-1.5 px-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted">@60fps</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const isSeparator = row.label === 'Total Active';
          return (
            <tr
              key={row.label}
              className={isSeparator ? 'border-t border-border/40' : ''}
              style={{
                backgroundColor: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                ...(isSeparator ? { borderTopStyle: 'dashed' as const } : {}),
              }}
            >
              <td className="py-1 px-2.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ backgroundColor: row.color }} />
                  <span className={isSeparator ? 'font-bold text-text' : 'text-text-muted'}>{row.label}</span>
                </span>
              </td>
              <td className="py-1 px-2.5 text-right">
                <span className={isSeparator ? 'font-bold' : ''} style={{ color: row.color, textShadow: `0 0 12px ${row.color}40` }}>
                  {row.frames}f
                </span>
              </td>
              <td className="py-1 px-2.5 text-right text-text-muted">{row.seconds.toFixed(3)}s</td>
              <td className="py-1 px-2.5 text-right text-text-muted/60">{(row.frames / 60).toFixed(3)}s</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ── Game-feel metric rows sub-table ───────────────────────────────────── */

function MetricRows({ rows }: { rows: { label: string; value: string; rating: Rating; color: string }[] }) {
  return (
    <table className="w-full text-xs font-mono">
      <thead>
        <tr className="border-b border-border/30" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <th className="text-left py-1.5 px-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Game-Feel Metric</th>
          <th className="text-right py-1.5 px-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Value</th>
          <th className="text-right py-1.5 px-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Rating</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.label} style={{ backgroundColor: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
            <td className="py-1.5 px-2.5">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ backgroundColor: row.color }} />
                <span className="text-text-muted">{row.label}</span>
              </span>
            </td>
            <td className="py-1.5 px-2.5 text-right">
              <span className="font-bold" style={{ color: row.color, textShadow: `0 0 12px ${row.color}40` }}>{row.value}</span>
            </td>
            <td className="py-1.5 px-2.5 text-right">
              <RatingBadge rating={row.rating} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
