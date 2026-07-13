'use client';

import { Lbl } from './controls';
import { StaticStepFrame } from './StaticStepFrame';
import { CliProduce } from './shared/CliProduce';
import { DataTable } from './shared/DataTable';
import { ITEM_ATTR_SCHEMA } from './itemsSteps';
import type { StepProps } from './stepProps';

const PEERS = [['Steel Saber', '31'], ['Worn Greatsword', '46'], ['Guard\'s Blade', '29'], ['Iron Mace', '38']];

/** Items · Attributes. View: UE-synced table (persisted) | peers+schema. Produce: CLI fills the mix. */
export function ItemAttributes({ t, entity, step }: StepProps) {
  return (
    <StaticStepFrame t={t} entity={entity} step={step} panels={({ art, runProduce }) => {
      const vals = (art?.data?.stats ?? {}) as Record<string, string | number>;
      return [
        {
          label: 'Attribute table',
          node: (
            <DataTable
              t={t}
              columns={ITEM_ATTR_SCHEMA.map((a) => ({ key: a.key, unit: a.unit }))}
              values={vals}
              header={['Attribute', 'Value']}
              caption={<>⟳ synced from UE5 · type <span style={{ color: t.ink }}>Weapon</span></>}
            />
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
            <CliProduce t={t} label="Produce attribute mix" rows={3}
              note="Writes the full attribute set to the UE Weapon row + the pipeline store."
              buildPrompt={(dir) => `Fill the Weapon attributes for ${entity.name} from its brief + peers (${PEERS.map((p) => p[0]).join(', ')}). ${dir}`}
              onComplete={runProduce} />
          ),
        },
      ];
    }} />
  );
}
