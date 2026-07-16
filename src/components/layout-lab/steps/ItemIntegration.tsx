'use client';

import { StaticStepFrame } from './StaticStepFrame';
import { CliProduce } from './shared/CliProduce';
import type { StepProps } from './stepProps';

/** Items · Inventory UI Integration. View: grid preview + binding (persisted). Produce: wire. */
export function ItemInventoryUI({ t, entity, step }: StepProps) {
  return (
    <StaticStepFrame t={t} entity={entity} step={step} panels={({ art, runProduce }) => {
      const wired = !!art?.data?.wired;
      const slot = String((art?.data?.slot as string) ?? 'Weapon');
      return [
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
      ];
    }} />
  );
}

/** The tooltip artifact Produce writes (itemsSteps.ts 'Tooltip / Compare'). */
interface ProducedTooltip {
  displayName?: string;
  typeLine?: string;
  statBlock?: string[];
  affixLines?: string[];
  flavor?: string;
  compareRule?: string;
}

/** Items · Tooltip / Compare. View: tooltip card + compare — both read the REAL
 *  produced `data.tooltip` artifact (name · type · stats · affixes · flavor), with
 *  an honest empty state until Produce has run. */
export function ItemTooltip({ t, entity, step }: StepProps) {
  return (
    <StaticStepFrame t={t} entity={entity} step={step} panels={({ art, runProduce }) => {
      const tooltip = (art?.data?.tooltip ?? null) as ProducedTooltip | null;
      const statBlock = tooltip?.statBlock ?? [];
      const affixLines = tooltip?.affixLines ?? [];
      const compareOn = !!art?.data?.compare;
      const emptyHint = (label: string) => (
        <span style={{ fontSize: 15, color: t.muted, lineHeight: 1.55 }}>{label}</span>
      );
      return [
        { label: 'Tooltip card', node: tooltip ? (
          <div style={{ border: `1px solid ${t.line}`, borderRadius: t.glass ? 10 : 0, padding: 14, background: t.panel }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.inkDeep }}>{tooltip.displayName ?? entity.name}</div>
            {tooltip.typeLine && <div style={{ fontSize: 14, color: t.muted, marginBottom: 10 }}>{tooltip.typeLine}</div>}
            {statBlock.map((line, i) => (
              <div key={i} className={t.fontMono} style={{ fontSize: 15, color: t.text, padding: '3px 0' }}>{line}</div>
            ))}
            {affixLines.length > 0 && (
              <div style={{ marginTop: 8, borderTop: `1px solid ${t.line}`, paddingTop: 8, display: 'grid', gap: 4 }}>
                {affixLines.map((line, i) => (
                  <div key={i} style={{ fontSize: 14, color: t.ok, lineHeight: 1.5 }}>{line}</div>
                ))}
              </div>
            )}
            {tooltip.flavor && <div style={{ marginTop: 10, fontSize: 14, fontStyle: 'italic', color: t.muted, lineHeight: 1.55 }}>{tooltip.flavor}</div>}
          </div>
        ) : emptyHint('No tooltip produced yet — run Produce to lay out the stat tooltip.') },
        { label: 'Compare vs equipped', node: compareOn && tooltip ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {tooltip.compareRule && (
              <span style={{ fontSize: 14, color: t.text, lineHeight: 1.55 }}>{tooltip.compareRule}</span>
            )}
            <div style={{ display: 'grid', gap: 6 }}>
              {(statBlock.length ? statBlock : ['—']).map((line, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '3px 0', borderTop: `1px solid ${t.line}` }}>
                  <span className={t.fontMono} style={{ color: t.text }}>{line}</span>
                  <span className={t.fontMono} style={{ color: t.ok }}>Δ vs equipped</span>
                </div>
              ))}
            </div>
          </div>
        ) : emptyHint('Compare-vs-equipped is off until Produce writes the tooltip with compare enabled.') },
        { label: 'Produce', node: (
          <CliProduce t={t} label="Produce tooltip" rows={3}
            note="Writes the tooltip layout + compare-vs-equipped delta view."
            buildPrompt={(dir) => `Generate the tooltip layout for ${entity.name} (all stat fields + compare-vs-equipped deltas). ${dir}`}
            onComplete={runProduce} />
        ) },
      ];
    }} />
  );
}
