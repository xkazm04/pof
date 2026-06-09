'use client';

import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { useStaticStep } from './useStaticStep';
import { ITEM_STEP_SPECS } from './itemsSteps';
import type { StepProps } from './stepProps';

/** Items · Inventory UI Integration. View: grid preview + binding (persisted). Produce: wire. */
export function ItemInventoryUI({ t, entity, step }: StepProps) {
  const { art, runProduce } = useStaticStep(entity, step);
  const wired = !!art?.data?.wired;
  const slot = String((art?.data?.slot as string) ?? 'Weapon');

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art?.data ?? {})}
      onFix={runProduce}
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
            <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>slot category: <span style={{ color: t.text }}>{slot}</span></span>
            <span style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>{wired ? `${entity.name} occupies one grid cell; stack size 1; equippable to the ${slot} slot.` : 'Not yet bound to the inventory widget.'}</span>
          </div>
        ) },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Wire to inventory UI (CLI)" rows={3}
            note={`Registers ${entity.name} with the inventory widget (slot rules + stack size).`}
            buildPrompt={(dir) => `Register ${entity.name} with the inventory UI: ${slot} slot, stack size 1, icon binding. ${dir}`}
            onComplete={runProduce} />
        ) },
      ]}
    />
  );
}

/** Items · Tooltip / Compare. View: tooltip card + compare (persisted). Produce: layout. */
export function ItemTooltip({ t, entity, step }: StepProps) {
  const { art, runProduce } = useStaticStep(entity, step);
  const done = !!art?.data?.compare;
  const stats = [['Damage', '34', '+3'], ['Attack Speed', '1.1/s', '-0.1'], ['Weight', '3.4kg', '+0.4'], ['Value', '120g', '+20']];

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art?.data ?? {})}
      onFix={runProduce}
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
            buildPrompt={(dir) => `Generate the tooltip layout for ${entity.name} (all stat fields + compare-vs-equipped deltas). ${dir}`}
            onComplete={runProduce} />
        ) },
      ]}
    />
  );
}
