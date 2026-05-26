'use client';

import { Lbl } from './controls';
import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import { ITEM_STEP_SPECS } from './itemsSteps';
import type { LabTheme } from '../theme';
import type { StepProps } from './stepProps';

const TARGET = 100;
const PEERS_POWER = [88, 94, 96, 99, 101, 104, 110, 118];
const EXPECTED = (p: number) => Math.round(p * 1.4);

function Bars({ t, hi, name, power }: { t: LabTheme; hi: string; name: string; power: number }) {
  const rows: [string, number, string][] = [['Tier target', TARGET, t.muted], ['Steel Saber', 96, t.line], [name, power, hi], ['Worn GS', 110, t.line]];
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map(([label, val, col]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 90, fontSize: 14, color: t.text, flexShrink: 0 }}>{label}</span>
          <div style={{ flex: 1, height: 16, background: t.line, opacity: 0.4 }}>
            <div style={{ width: `${(val / 130) * 100}%`, height: '100%', background: col, opacity: col === t.muted ? 0.6 : 1 }} />
          </div>
          <span className={t.fontMono} style={{ width: 36, textAlign: 'right', fontSize: 14, color: t.text }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

/** Items · Economy. View: budget bars + price/power curve | distribution (persisted). Produce: tuned values. */
export function ItemEconomy({ t, entity, step }: StepProps) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const data = (art?.data ?? {}) as Record<string, number | string>;
  const tuned = data.power != null;
  const power = Number(data.power ?? TARGET);
  const c = Number(data.cost ?? 0);
  const ratio = c / EXPECTED(power);
  const priceOk = tuned && ratio >= 0.8 && ratio <= 1.2;
  const hi = !tuned ? t.muted : priceOk ? t.ok : t.bad;
  const peerMax = Math.max(...PEERS_POWER);

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art)}
      panels={[
        {
          label: 'Budget & curve',
          node: (
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <Lbl t={t}>Stat budget vs tier (target {TARGET})</Lbl>
                <div style={{ marginTop: 10 }}><Bars t={t} hi={hi} name={entity.name} power={power} /></div>
              </div>
              <div>
                <Lbl t={t}>Price vs power</Lbl>
                <svg viewBox="0 0 320 170" width="100%" height="180" style={{ marginTop: 8 }}>
                  <line x1={28} y1={8} x2={28} y2={150} stroke={t.line} strokeWidth={1.5} />
                  <line x1={28} y1={150} x2={312} y2={150} stroke={t.line} strokeWidth={1.5} />
                  <polyline fill="none" stroke={t.ink} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.6}
                    points={PEERS_POWER.map((p) => `${28 + ((p - 84) / 40) * 280},${150 - (EXPECTED(p) / 200) * 138}`).join(' ')} />
                  {PEERS_POWER.map((p) => <circle key={p} cx={28 + ((p - 84) / 40) * 280} cy={150 - (EXPECTED(p) / 200) * 138} r={3.5} fill={t.muted} />)}
                  {tuned && <circle cx={28 + ((power - 84) / 40) * 280} cy={150 - (Math.min(c, 200) / 200) * 138} r={6.5} fill={hi} stroke={t.bg} strokeWidth={2} />}
                </svg>
                <div className={t.fontMono} style={{ fontSize: 14, color: t.muted, display: 'flex', gap: 16 }}>
                  <span>● peers</span><span>– – curve</span><span style={{ color: hi }}>◆ this item</span>
                </div>
              </div>
            </div>
          ),
        },
        {
          label: 'Distribution',
          node: (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <Lbl t={t}>Power distribution · peers</Lbl>
                <svg viewBox="0 0 320 130" width="100%" height="130" style={{ marginTop: 8 }}>
                  {PEERS_POWER.map((p, i) => {
                    const h = (p / peerMax) * 110;
                    const near = tuned && Math.abs(p - power) <= 3;
                    return <rect key={i} x={14 + i * 38} y={120 - h} width={30} height={h} fill={near ? t.ink : t.line} opacity={near ? 1 : 0.55} />;
                  })}
                </svg>
                <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>{tuned ? `Highlighted bars sit within ±3 of this item (${power}).` : 'Run Produce to place this item on the curve.'}</span>
              </div>
              <div>
                <Lbl t={t}>Outliers</Lbl>
                <div style={{ marginTop: 6, fontSize: 15, color: !tuned ? t.muted : priceOk ? t.ok : t.bad }}>
                  {!tuned ? 'Pending — not yet tuned.' : priceOk ? 'None flagged · price/power inside the band.' : `Outlier · price/power ${ratio.toFixed(2)}× is outside 0.8–1.2.`}
                </div>
              </div>
            </div>
          ),
        },
        {
          label: 'Produce',
          node: (
            <div style={{ display: 'grid', gap: 12 }}>
              <CliProduce t={t} label="Tune within budget (CLI)" rows={3}
                note="Writes cost / rarity / drop-weight to the UE item row + the pipeline store."
                buildPrompt={(dir) => `Tune cost/rarity for ${entity.name} onto the price/power curve (tier target ${TARGET}). ${dir}`}
                onComplete={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))} />
              {tuned && (
                <span className={t.fontMono} style={{ fontSize: 14, color: priceOk ? t.ok : t.bad }}>
                  cost {c}g for power {power}{priceOk ? ' · in band' : ' · OUTLIER'}
                </span>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
