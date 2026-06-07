'use client';

import { Lbl } from './controls';
import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import { ITEM_STEP_SPECS, ITEM_ATTR_SCHEMA } from './itemsSteps';
import type { StepProps } from './stepProps';

const PEERS = [['Steel Saber', '31'], ['Worn Greatsword', '46'], ['Guard\'s Blade', '29'], ['Iron Mace', '38']];

/** Items · Attributes. View: UE-synced table (persisted) | peers+schema. Produce: CLI fills the mix. */
export function ItemAttributes({ t, entity, step }: StepProps) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const vals = (art?.data?.stats ?? {}) as Record<string, string | number>;
  const cell: React.CSSProperties = { padding: '8px 12px', borderTop: `1px solid ${t.line}`, fontSize: 15 };

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art)}
      onFix={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))}
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
                {ITEM_ATTR_SCHEMA.map((a) => {
                  const v = vals[a.key];
                  return (
                    <div key={a.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', ...cell }}>
                      <span style={{ color: t.text }}>{a.key}</span>
                      <span className={t.fontMono} style={{ color: v != null ? t.inkDeep : t.warn, fontWeight: 600 }}>{v != null ? `${v} ${a.unit}` : '— missing'}</span>
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
                {PEERS.map(([n, dmg]) => (
                  <span key={n} className={t.fontMono} style={{ fontSize: 14, padding: '5px 10px', border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, color: t.muted }}>{n} · <span style={{ color: t.text }}>{dmg}</span></span>
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
            <CliProduce t={t} label="Generate attribute mix (CLI)" rows={3}
              note="Writes the full attribute set to the UE Weapon row + the pipeline store."
              buildPrompt={(dir) => `Fill the Weapon attributes for ${entity.name} from its brief + peers (${PEERS.map((p) => p[0]).join(', ')}). ${dir}`}
              onComplete={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))} />
          ),
        },
      ]}
    />
  );
}
