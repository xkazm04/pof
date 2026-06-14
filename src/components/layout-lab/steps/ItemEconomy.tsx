'use client';

import { Lbl } from './controls';
import { StaticStepFrame } from './StaticStepFrame';
import { CliProduce } from './shared/CliProduce';
import { ChartPanel } from './shared/ChartPanel';
import { expectedPrice, priceRatio, priceInBand } from './itemsSteps';
import type { StepProps } from './stepProps';

const TARGET = 100;
const PEERS_POWER = [88, 94, 96, 99, 101, 104, 110, 118];

const BARS_MAX = 130;
const X_DOMAIN: readonly [number, number] = [84, 124];
const Y_DOMAIN: readonly [number, number] = [0, 200];

/** Items · Economy. View: budget bars + price/power curve | distribution (persisted). Produce: tuned values. */
export function ItemEconomy({ t, entity, step }: StepProps) {
  return (
    <StaticStepFrame t={t} entity={entity} step={step} panels={({ art, runProduce }) => {
      const data = (art?.data ?? {}) as Record<string, number | string>;
      const tuned = data.power != null;
      const power = Number(data.power ?? TARGET);
      const c = Number(data.cost ?? 0);
      const ratio = priceRatio(c, power);
      const priceOk = tuned && priceInBand(c, power);
      const hi = !tuned ? t.muted : priceOk ? t.ok : t.bad;

      const referencePoints = PEERS_POWER.map((p) => ({ x: p, y: expectedPrice(p) }));
      const accentPoints = tuned
        ? [{ x: power, y: Math.min(c, Y_DOMAIN[1]), color: hi, label: `${entity.name}: ${c}g for power ${power}` }]
        : [];
      return [
        {
          label: 'Budget & curve',
          node: (
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <Lbl t={t}>Stat budget vs tier (target {TARGET})</Lbl>
                <div style={{ marginTop: 10 }}>
                  <ChartPanel t={t} variant="bars" max={BARS_MAX} ariaLabel="Stat budget bars"
                    rows={[
                      { label: 'Tier target', value: TARGET, color: t.muted },
                      { label: 'Steel Saber', value: 96, color: t.line },
                      { label: entity.name, value: power, color: hi, highlight: true },
                      { label: 'Worn GS', value: 110, color: t.line },
                    ]} />
                </div>
              </div>
              <div>
                <Lbl t={t}>Price vs power</Lbl>
                <ChartPanel t={t} variant="scatter"
                  xDomain={X_DOMAIN} yDomain={Y_DOMAIN}
                  reference={referencePoints}
                  points={accentPoints}
                  xLabel="power" yLabel="gold"
                  ariaLabel="Price vs power scatter" />
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
                <ChartPanel t={t} variant="histogram" ariaLabel="Peer power distribution"
                  bars={PEERS_POWER.map((p) => ({
                    value: p,
                    highlight: tuned && Math.abs(p - power) <= 3,
                  }))} />
                <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>
                  {tuned ? `Highlighted bars sit within ±3 of this item (${power}).` : 'Run Produce to place this item on the curve.'}
                </span>
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
                onComplete={runProduce} />
              {tuned && (
                <span className={t.fontMono} style={{ fontSize: 14, color: priceOk ? t.ok : t.bad }}>
                  cost {c}g for power {power}{priceOk ? ' · in band' : ' · OUTLIER'}
                </span>
              )}
            </div>
          ),
        },
      ];
    }} />
  );
}
