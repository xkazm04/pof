'use client';

import { useState } from 'react';
import { Lbl } from './controls';
import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';

interface Attr { key: string; unit: string }
const SCHEMA: Attr[] = [
  { key: 'Damage', unit: 'hp' }, { key: 'Attack Speed', unit: '/s' }, { key: 'Weight', unit: 'kg' },
  { key: 'Durability', unit: 'pt' }, { key: 'Crit Chance', unit: '%' }, { key: 'Range', unit: 'm' },
  { key: 'Stagger', unit: 'pt' }, { key: 'Value', unit: 'g' },
];
const SEED: Record<string, string> = { Damage: '34', 'Attack Speed': '1.1', Weight: '3.4', Value: '120' };
const GENERATED: Record<string, string> = { Durability: '180', 'Crit Chance': '5', Range: '1.8', Stagger: '22' };
const PEERS = [['Steel Saber', '31'], ['Worn Greatsword', '46'], ['Guard\'s Blade', '29'], ['Iron Mace', '38']];

/** Items · Step 2 — Attributes. View: UE-synced table | peers+schema. Produce: CLI fills the mix. */
export function ItemAttributes({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [vals, setVals] = useState<Record<string, string>>(SEED);
  const missing = SCHEMA.filter((a) => !vals[a.key]);
  const status = missing.length === 0 ? 'pass' : 'pending';
  const cell: React.CSSProperties = { padding: '8px 12px', borderTop: `1px solid ${t.line}`, fontSize: 15 };

  return (
    <StepFrame
      t={t}
      acceptance={{ label: 'All attributes populated per schema (Weapon)', status, detail: `${SCHEMA.length - missing.length} / ${SCHEMA.length} populated` }}
      panels={[
        {
          label: 'Attribute table',
          node: (
            <div>
              <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted, marginBottom: 10 }}>
                ⟳ synced from UE5 · type <span style={{ color: t.ink }}>Weapon</span>
              </div>
              <div style={{ border: `1px solid ${t.line}` }}>
                <div className={t.fontMono} style={{ display: 'grid', gridTemplateColumns: '1fr auto', background: t.accentBg, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.inkDeep, padding: '7px 12px' }}>
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
            </div>
          ),
        },
        {
          label: 'Similar items · schema',
          node: (
            <div style={{ display: 'grid', gap: 12 }}>
              <Lbl t={t}>Peers (same tier)</Lbl>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PEERS.map(([n, d]) => (
                  <span key={n} className={t.fontMono} style={{ fontSize: 14, padding: '5px 10px', border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, color: t.muted }}>{n} · <span style={{ color: t.text }}>{d}</span></span>
                ))}
              </div>
              <span style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>
                The schema is sourced from the UE5 row struct for this item type. If UE adds a field, it re-flags here and the CLI backfills every Weapon.
              </span>
            </div>
          ),
        },
        {
          label: 'Produce',
          node: (
            <div style={{ display: 'grid', gap: 12 }}>
              <CliProduce t={t} label="Generate attribute mix (CLI)"
                fields={<span style={{ fontSize: 15, color: t.muted, lineHeight: 1.55 }}>Prefilled: <span style={{ color: t.text }}>{Object.keys(SEED).join(', ')}</span>. The CLI infers the rest from the brief, peers, and prefilled values.</span>}
                note="Writes the full attribute set to the UE Weapon row."
                buildPrompt={(d) => `Fill the missing Weapon attributes for ${entity.name} from its brief + peers; keep prefilled ${Object.keys(SEED).join('/')}. ${d}`.trim()}
                onComplete={() => setVals({ ...SEED, ...GENERATED })} />
              {missing.length > 0
                ? <span className={t.fontMono} style={{ fontSize: 14, color: t.warn }}>{missing.length} await generation: {missing.map((m) => m.key).join(', ')}</span>
                : <span className={t.fontMono} style={{ fontSize: 14, color: t.ok }}>Schema complete · {entity.name} ready to balance.</span>}
            </div>
          ),
        },
      ]}
    />
  );
}
