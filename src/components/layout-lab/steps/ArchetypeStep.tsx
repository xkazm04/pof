'use client';

import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';
import type { StepSpec, ViewDescriptor } from '@/lib/catalog/stepSpec';

function ViewPanel({ t, view, data }: { t: LabTheme; view: ViewDescriptor; data: Record<string, unknown> }) {
  if (view.kind === 'prose') {
    const txt = String(data[view.field] ?? '');
    return txt
      ? <div style={{ fontSize: 15, lineHeight: 1.7, color: t.text, whiteSpace: 'pre-wrap' }}>{txt}</div>
      : <span style={{ fontSize: 15, color: t.muted }}>{view.emptyText}</span>;
  }
  if (view.kind === 'table') {
    const obj = (data[view.field] ?? {}) as Record<string, unknown>;
    return (
      <div style={{ border: `1px solid ${t.line}` }}>
        {view.columns.map((c) => (
          <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 12px', borderTop: `1px solid ${t.line}`, fontSize: 15 }}>
            <span style={{ color: t.text }}>{c.key}</span>
            <span className={t.fontMono} style={{ color: obj[c.key] != null ? t.inkDeep : t.warn }}>{obj[c.key] != null ? `${obj[c.key]}${c.unit ? ' ' + c.unit : ''}` : '— missing'}</span>
          </div>
        ))}
      </div>
    );
  }
  if (view.kind === 'checklist' || view.kind === 'manifest') {
    const arr = Array.isArray(data[view.field]) ? (data[view.field] as unknown[]) : [];
    return arr.length
      ? <div>{arr.map((x, i) => <div key={i} className={t.fontMono} style={{ fontSize: 14, padding: '6px 0', borderTop: `1px solid ${t.line}`, color: t.text }}>✓ {String(Array.isArray(x) ? x.join(' · ') : x)}</div>)}</div>
      : <span style={{ fontSize: 15, color: t.muted }}>Nothing yet — run Produce.</span>;
  }
  // gallery: simple candidate count; bespoke selection UI lives in a registered component when richer interaction is needed.
  return <span style={{ fontSize: 14, color: t.muted }}>{view.candidates} candidates · select via Produce.</span>;
}

/** Hybrid generic renderer: drives any common-archetype StepSpec from persisted artifacts. */
export function ArchetypeStep({ t, entity, step, spec }: { t: LabTheme; entity: LabEntity; step: string; spec: StepSpec }) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const data = art?.data ?? {};
  return (
    <StepFrame t={t} acceptance={spec.accept(data)}
      panels={[
        { label: 'View', node: <ViewPanel t={t} view={spec.view} data={data} /> },
        { label: 'Produce', node: (
          <CliProduce t={t} label={`Generate ${spec.label} (CLI)`} rows={3}
            defaultDirection={spec.defaultDirection} note={spec.produceNote}
            buildPrompt={(dir) => `Produce ${spec.label} for ${entity.name}. ${dir}`}
            onComplete={() => produce(entity.id, step, spec.produce(entity))} />
        ) },
      ]}
    />
  );
}
