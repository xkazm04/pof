'use client';

import { useState } from 'react';
import { Lbl, LabButton, LabInput } from './controls';
import { StepFrame } from './StepFrame';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';

const POWER = 102;
const TARGET = 100;
const PEERS_POWER = [88, 94, 96, 99, 101, 104, 110, 118];
const EXPECTED = (p: number) => Math.round(p * 1.4);

function Bars({ t, hi, name }: { t: LabTheme; hi: string; name: string }) {
  const rows: [string, number, string][] = [['Tier target', TARGET, t.muted], ['Steel Saber', 96, t.line], [name, POWER, hi], ['Worn GS', 110, t.line]];
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map(([name, val, col]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 90, fontSize: 14, color: t.text, flexShrink: 0 }}>{name}</span>
          <div style={{ flex: 1, height: 16, background: t.line, opacity: 0.4 }}>
            <div style={{ width: `${(val / 130) * 100}%`, height: '100%', background: col, opacity: col === t.muted ? 0.6 : 1 }} />
          </div>
          <span className={t.fontMono} style={{ width: 36, textAlign: 'right', fontSize: 14, color: t.text }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

/** Items · Step 3 — Economy. View: budget bars + price/power curve | distribution. Produce: tuned values. */
export function ItemEconomy({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [cost, setCost] = useState('120');
  const [rarity, setRarity] = useState('Uncommon');
  const c = Number(cost) || 0;
  const ratio = c / EXPECTED(POWER);
  const priceOk = ratio >= 0.8 && ratio <= 1.2;
  const powerOk = POWER >= TARGET * 0.9 && POWER <= TARGET * 1.1;
  const status = powerOk && priceOk ? 'pass' : 'fail';
  const hi = priceOk ? t.ok : t.bad;
  const peerMax = Math.max(...PEERS_POWER);

  return (
    <StepFrame
      t={t}
      acceptance={{ label: 'Power within ±10% of tier · price/power in curve · no outliers', status, detail: `power ${POWER}% · price/power ${ratio.toFixed(2)}×` }}
      panels={[
        {
          label: 'Budget & curve',
          node: (
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <Lbl t={t}>Stat budget vs tier (target {TARGET})</Lbl>
                <div style={{ marginTop: 10 }}><Bars t={t} hi={hi} name={entity.name} /></div>
              </div>
              <div>
                <Lbl t={t}>Price vs power</Lbl>
                <svg viewBox="0 0 320 170" width="100%" height="180" style={{ marginTop: 8 }}>
                  <line x1={28} y1={8} x2={28} y2={150} stroke={t.line} strokeWidth={1.5} />
                  <line x1={28} y1={150} x2={312} y2={150} stroke={t.line} strokeWidth={1.5} />
                  <polyline fill="none" stroke={t.ink} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.6}
                    points={PEERS_POWER.map((p) => `${28 + ((p - 84) / 40) * 280},${150 - (EXPECTED(p) / 200) * 138}`).join(' ')} />
                  {PEERS_POWER.map((p) => <circle key={p} cx={28 + ((p - 84) / 40) * 280} cy={150 - (EXPECTED(p) / 200) * 138} r={3.5} fill={t.muted} />)}
                  <circle cx={28 + ((POWER - 84) / 40) * 280} cy={150 - (Math.min(c, 200) / 200) * 138} r={6.5} fill={hi} stroke={t.bg} strokeWidth={2} />
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
                    const near = Math.abs(p - POWER) <= 3;
                    return <rect key={i} x={14 + i * 38} y={120 - h} width={30} height={h} fill={near ? t.ink : t.line} opacity={near ? 1 : 0.55} />;
                  })}
                </svg>
                <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>Highlighted bars sit within ±3 of this item ({POWER}).</span>
              </div>
              <div>
                <Lbl t={t}>Outliers</Lbl>
                <div style={{ marginTop: 6, fontSize: 15, color: priceOk ? t.ok : t.bad }}>
                  {priceOk ? 'None flagged · price/power inside the band.' : `Outlier · price/power ${ratio.toFixed(2)}× is outside 0.8–1.2.`}
                </div>
              </div>
            </div>
          ),
        },
        {
          label: 'Produce',
          node: (
            <div style={{ display: 'grid', gap: 12 }}>
              <Lbl t={t}>Cost (gold)</Lbl>
              <LabInput t={t} type="number" value={cost} onChange={setCost} />
              <Lbl t={t}>Rarity</Lbl>
              <LabInput t={t} value={rarity} onChange={setRarity} placeholder="Common / Uncommon / Rare…" />
              <LabButton t={t} onClick={() => setCost(String(EXPECTED(POWER)))}>⚡ Tune within budget (CLI)</LabButton>
              <span className={t.fontMono} style={{ fontSize: 14, color: priceOk ? t.ok : t.bad }}>
                curve suggests ≈ {EXPECTED(POWER)}g for power {POWER}{priceOk ? ' · in band' : ' · OUTLIER'}
              </span>
              <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>Writes cost/rarity/drop-weight to the UE item row.</span>
            </div>
          ),
        },
      ]}
    />
  );
}
