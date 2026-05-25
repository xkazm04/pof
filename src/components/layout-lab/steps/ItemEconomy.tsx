'use client';

import { useState } from 'react';
import { StepFrame } from './StepFrame';
import { Lbl, LabButton, LabInput } from './controls';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';

const POWER = 102;          // derived power score (from attributes) — tier target = 100
const TARGET = 100;
const PEERS_POWER = [88, 94, 96, 99, 101, 104, 110, 118]; // histogram + scatter source
const EXPECTED = (p: number) => Math.round(p * 1.4); // price/power curve

/** Items · Step 3 — Economy. View: stat-budget, price/power curve, histogram. Produce: tuned values. Acceptance: power ±10% + price/power in band. */
export function ItemEconomy({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [cost, setCost] = useState('120');
  const [rarity, setRarity] = useState('Uncommon');
  const c = Number(cost) || 0;
  const ratio = c / EXPECTED(POWER);
  const powerOk = POWER >= TARGET * 0.9 && POWER <= TARGET * 1.1;
  const priceOk = ratio >= 0.8 && ratio <= 1.2;
  const status = powerOk && priceOk ? 'pass' : 'fail';

  const axis = t.line, hi = priceOk ? t.ok : t.bad;
  const peerMax = Math.max(...PEERS_POWER);

  return (
    <StepFrame
      t={t}
      acceptance={{ label: 'Power within ±10% of tier · price/power in curve · no outliers', status, detail: `power ${POWER}% · price/power ${ratio.toFixed(2)}×` }}
      view={
        <div style={{ display: 'grid', gap: 18 }}>
          {/* 1. stat-budget vs peers */}
          <div>
            <Lbl t={t}>Stat budget vs peers (tier target {TARGET})</Lbl>
            <svg viewBox="0 0 300 70" width="100%" height="70" style={{ marginTop: 6 }}>
              {[['target', TARGET, t.muted], ['Steel Saber', 96, axis], [entity.name, POWER, hi], ['Worn GS', 110, axis]].map((row, i) => {
                const [name, val, col] = row as [string, number, string];
                const w = (val / 130) * 230;
                return (
                  <g key={name} transform={`translate(0 ${i * 17})`}>
                    <text x={0} y={11} fontSize={8} fill={t.muted} fontFamily="monospace">{name}</text>
                    <rect x={70} y={3} width={w} height={10} fill={col} opacity={col === t.muted ? 0.4 : 1} />
                    <text x={70 + w + 4} y={11} fontSize={8} fill={t.text} fontFamily="monospace">{val}</text>
                  </g>
                );
              })}
            </svg>
          </div>
          {/* 2. price vs power curve */}
          <div>
            <Lbl t={t}>Price vs power curve</Lbl>
            <svg viewBox="0 0 300 110" width="100%" height="110" style={{ marginTop: 6 }}>
              <line x1={30} y1={6} x2={30} y2={96} stroke={axis} strokeWidth={1} />
              <line x1={30} y1={96} x2={294} y2={96} stroke={axis} strokeWidth={1} />
              <text x={4} y={12} fontSize={7} fill={t.muted} fontFamily="monospace">price</text>
              <text x={262} y={108} fontSize={7} fill={t.muted} fontFamily="monospace">power→</text>
              {/* curve */}
              <polyline fill="none" stroke={t.ink} strokeWidth={1} strokeDasharray="3 2" opacity={0.6}
                points={PEERS_POWER.map((p) => `${30 + ((p - 84) / 40) * 260},${96 - (EXPECTED(p) / 200) * 88}`).join(' ')} />
              {/* peers */}
              {PEERS_POWER.map((p) => <circle key={p} cx={30 + ((p - 84) / 40) * 260} cy={96 - (EXPECTED(p) / 200) * 88} r={2.4} fill={t.muted} />)}
              {/* this item */}
              <circle cx={30 + ((POWER - 84) / 40) * 260} cy={96 - (Math.min(c, 200) / 200) * 88} r={4.5} fill={hi} stroke={t.bg} strokeWidth={1.2} />
            </svg>
          </div>
          {/* 3. histogram */}
          <div>
            <Lbl t={t}>Power distribution · similar items</Lbl>
            <svg viewBox="0 0 300 56" width="100%" height="56" style={{ marginTop: 6 }}>
              {PEERS_POWER.map((p, i) => {
                const h = (p / peerMax) * 44;
                const near = Math.abs(p - POWER) <= 3;
                return <rect key={i} x={20 + i * 34} y={50 - h} width={26} height={h} fill={near ? t.ink : axis} opacity={near ? 1 : 0.5} />;
              })}
            </svg>
          </div>
        </div>
      }
      produce={
        <div style={{ display: 'grid', gap: 10 }}>
          <Lbl t={t}>Cost (gold)</Lbl>
          <LabInput t={t} type="number" value={cost} onChange={setCost} />
          <Lbl t={t}>Rarity</Lbl>
          <LabInput t={t} value={rarity} onChange={setRarity} placeholder="Common / Uncommon / Rare…" />
          <LabButton t={t} onClick={() => setCost(String(EXPECTED(POWER)))}>⚡ Tune within budget (CLI)</LabButton>
          <span className={t.fontMono} style={{ fontSize: 11, color: priceOk ? t.ok : t.bad }}>
            curve suggests ≈ {EXPECTED(POWER)}g for power {POWER}{priceOk ? ' · in band' : ' · OUTLIER'}
          </span>
          <span className={t.fontMono} style={{ fontSize: 11, color: t.muted }}>Writes cost/rarity/drop-weight to the UE item row.</span>
        </div>
      }
    />
  );
}
