'use client';

import { useState } from 'react';
import { StepFrame } from './StepFrame';
import { Lbl, LabButton } from './controls';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';

interface Attr { key: string; unit: string }
// Weapon attribute schema (would be synced from the UE5 row struct per item type).
const SCHEMA: Attr[] = [
  { key: 'Damage', unit: 'hp' }, { key: 'Attack Speed', unit: '/s' }, { key: 'Weight', unit: 'kg' },
  { key: 'Durability', unit: 'pt' }, { key: 'Crit Chance', unit: '%' }, { key: 'Range', unit: 'm' },
  { key: 'Stagger', unit: 'pt' }, { key: 'Value', unit: 'g' },
];
const SEED: Record<string, string> = { Damage: '34', 'Attack Speed': '1.1', Weight: '3.4', Value: '120' };
const GENERATED: Record<string, string> = { Durability: '180', 'Crit Chance': '5', Range: '1.8', Stagger: '22' };
const PEERS = [['Steel Saber', '31'], ['Worn Greatsword', '46'], ['Guard\'s Blade', '29'], ['Iron Mace', '38']];

/** Items · Step 2 — Attributes. View: UE-synced table + peers. Produce: CLI fills the mix. Acceptance: schema complete. */
export function ItemAttributes({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [vals, setVals] = useState<Record<string, string>>(SEED);
  const missing = SCHEMA.filter((a) => !vals[a.key]);
  const status = missing.length === 0 ? 'pass' : 'pending';
  const cell: React.CSSProperties = { padding: '7px 12px', borderTop: `1px solid ${t.line}`, fontSize: 14 };

  return (
    <StepFrame
      t={t}
      acceptance={{ label: 'All attributes populated per schema (Weapon)', status, detail: `${SCHEMA.length - missing.length} / ${SCHEMA.length} populated` }}
      view={
        <div>
          <div className={t.fontMono} style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted, marginBottom: 10 }}>
            ⟳ synced from UE5 · item type: <span style={{ color: t.ink }}>Weapon</span>
          </div>
          <div style={{ border: `1px solid ${t.line}` }}>
            <div className={t.fontMono} style={{ display: 'grid', gridTemplateColumns: '1fr auto', background: t.accentBg, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.inkDeep, padding: '6px 12px' }}>
              <span>Attribute</span><span>Value</span>
            </div>
            {SCHEMA.map((a) => {
              const v = vals[a.key];
              return (
                <div key={a.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', ...cell }}>
                  <span style={{ color: t.text }}>{a.key}</span>
                  <span className={t.fontMono} style={{ color: v ? t.inkDeep : t.warn, fontWeight: 600 }}>{v ? `${v} ${a.unit}` : '— missing'}</span>
                </div>
              );
            })}
          </div>
          <Lbl t={t}>Similar items (same tier)</Lbl>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PEERS.map(([n, d]) => (
              <span key={n} className={t.fontMono} style={{ fontSize: 12, padding: '4px 9px', border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, color: t.muted }}>{n} · <span style={{ color: t.text }}>{d}</span></span>
            ))}
          </div>
        </div>
      }
      produce={
        <div style={{ display: 'grid', gap: 12 }}>
          <span style={{ fontSize: 13, color: t.muted, lineHeight: 1.5 }}>
            Prefilled: <span style={{ color: t.text }}>{Object.keys(SEED).join(', ')}</span>. The CLI infers the rest from the brief, peers, and prefilled values.
          </span>
          <LabButton t={t} onClick={() => setVals({ ...SEED, ...GENERATED })}>⚡ Generate attribute mix (CLI)</LabButton>
          {missing.length > 0 && <span className={t.fontMono} style={{ fontSize: 11, color: t.warn }}>{missing.length} attribute(s) await generation: {missing.map((m) => m.key).join(', ')}</span>}
          {missing.length === 0 && <span className={t.fontMono} style={{ fontSize: 11, color: t.ok }}>Schema complete · {entity.name} ready to balance.</span>}
          <span className={t.fontMono} style={{ fontSize: 11, color: t.muted }}>If UE5 extends the schema, missing values re-flag here and the CLI backfills all Weapons.</span>
        </div>
      }
    />
  );
}
