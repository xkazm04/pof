'use client';

import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import { ITEM_STEP_SPECS } from './itemsSteps';
import type { StepProps } from './stepProps';

const REFS = [
  ['Steel Saber', 'A guardsman\'s reliable sidearm — clean lines, municipal issue.'],
  ['Worn Greatsword', 'An heirloom past its prime; pitted steel, a story in every notch.'],
  ['Iron Mace', 'Blunt, brutal, peasant-levy gear — function over grace.'],
];

/** Items · Concept Brief. View: persisted brief + style refs. Produce: CLI text-gen. */
export function ItemConceptBrief({ t, entity, step }: StepProps) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const brief = String((art?.data?.brief as string) ?? '');

  return (
    <StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art)}
      onFix={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))}
      panels={[
        {
          label: 'Current brief',
          node: brief
            ? <div style={{ fontSize: 15, lineHeight: 1.75, color: t.text, whiteSpace: 'pre-wrap' }}>{brief}</div>
            : <span style={{ fontSize: 15, color: t.muted }}>No brief yet — run Produce to generate one.</span>,
        },
        {
          label: 'Style references (peers)',
          node: (
            <div style={{ display: 'grid', gap: 12 }}>
              {REFS.map(([n, blurb]) => (
                <div key={n} style={{ borderLeft: `2px solid ${t.line}`, paddingLeft: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.inkDeep }}>{n}</div>
                  <div style={{ fontSize: 14, color: t.muted, lineHeight: 1.5 }}>{blurb}</div>
                </div>
              ))}
              <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>Saved briefs are reused as tone references for the catalog.</span>
            </div>
          ),
        },
        {
          label: 'Produce',
          node: (
            <CliProduce t={t} label="Generate with CLI" rows={4}
              defaultDirection="tone: dependable, earned — a soldier's tool"
              note="Saved to the pipeline store · feeds the UE item description."
              buildPrompt={(dir) => `Write a 300+ char concept brief for ${entity.name} (mid-tier martial weapon). ${dir}`}
              onComplete={() => produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity))} />
          ),
        },
      ]}
    />
  );
}
