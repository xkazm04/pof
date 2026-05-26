'use client';

import { useState } from 'react';
import { Lbl, LabInput } from './controls';
import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';

/** Items · Inventory UI Integration. View: grid preview + binding. Produce: wire. Acceptance: renders + category. */
export function ItemInventoryUI({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [wired, setWired] = useState(false);
  const [slot, setSlot] = useState('Weapon');
  return (
    <StepFrame t={t}
      acceptance={{ label: 'Item renders in the inventory grid · slot category set', status: wired && slot ? 'pass' : 'pending', detail: wired ? `slot: ${slot}` : 'not wired' }}
      panels={[
        { label: 'Inventory grid', node: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {Array.from({ length: 15 }, (_, i) => (
              <div key={i} style={{ aspectRatio: '1', borderRadius: t.glass ? 8 : 2, border: `1px solid ${t.line}`, background: wired && i === 0 ? 'linear-gradient(135deg,#8a5a2b,#d8a657)' : t.panel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {wired && i === 0 && <span className={t.fontMono} style={{ fontSize: 14, color: '#fff' }}>★</span>}
              </div>
            ))}
          </div>
        ) },
        { label: 'Binding', node: (
          <div style={{ display: 'grid', gap: 10 }}>
            <Lbl t={t}>Slot category</Lbl>
            <LabInput t={t} value={slot} onChange={setSlot} placeholder="Weapon / Armor / Consumable…" />
            <span style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>{wired ? `${entity.name} occupies one grid cell; stack size 1; equippable to the ${slot} slot.` : 'Not yet bound to the inventory widget.'}</span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Wire to inventory UI (CLI)" rows={3}
            note={`Registers ${entity.name} with the inventory widget (slot rules + stack size).`}
            buildPrompt={(d) => `Register ${entity.name} with the inventory UI: ${slot} slot, stack size 1, icon binding. ${d}`.trim()}
            onComplete={() => setWired(true)} />
        ) },
      ]}
    />
  );
}

/** Items · Tooltip / Compare. View: tooltip card + compare. Produce: layout. Acceptance: required fields. */
export function ItemTooltip({ t, entity }: { t: LabTheme; entity: LabEntity }) {
  const [done, setDone] = useState(false);
  const stats = [['Damage', '34', '+3'], ['Attack Speed', '1.1/s', '-0.1'], ['Weight', '3.4kg', '+0.4'], ['Value', '120g', '+20']];
  return (
    <StepFrame t={t}
      acceptance={{ label: 'Tooltip shows all required fields · compare vs equipped works', status: done ? 'pass' : 'pending', detail: done ? `${stats.length} fields · compare on` : 'not laid out' }}
      panels={[
        { label: 'Tooltip card', node: (
          <div style={{ border: `1px solid ${t.line}`, borderRadius: t.glass ? 10 : 0, padding: 14, background: t.panel }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.inkDeep }}>{entity.name}</div>
            <div style={{ fontSize: 14, color: t.muted, marginBottom: 10 }}>Uncommon · Weapon</div>
            {stats.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '3px 0' }}>
                <span style={{ color: t.muted }}>{k}</span><span className={t.fontMono} style={{ color: t.text }}>{v}</span>
              </div>
            ))}
          </div>
        ) },
        { label: 'Compare vs equipped', node: (
          <div style={{ display: 'grid', gap: 6 }}>
            {stats.map(([k, , delta]) => {
              const up = delta.startsWith('+');
              return (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '3px 0', borderTop: `1px solid ${t.line}` }}>
                  <span style={{ color: t.muted }}>{k}</span>
                  <span className={t.fontMono} style={{ color: done ? (up ? t.ok : t.bad) : t.muted }}>{done ? `${up ? '▲' : '▼'} ${delta}` : '—'}</span>
                </div>
              );
            })}
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Generate tooltip (CLI)" rows={3}
            note="Writes the tooltip layout + compare-vs-equipped delta view."
            buildPrompt={(d) => `Generate the tooltip layout for ${entity.name} (all stat fields + compare-vs-equipped deltas). ${d}`.trim()}
            onComplete={() => setDone(true)} />
        ) },
      ]}
    />
  );
}
