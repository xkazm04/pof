'use client';

import { StepFrame } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import { useCanonStore } from '../canonStore';
import { canonContextFor } from '@/lib/catalog/canon/canonContext';
import { useCatalogStore } from '@/stores/catalogStore';
import { linkTargetsExist, readLinks } from '@/lib/catalog/acceptance/linkCheckers';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';
import type { StepSpec, ViewDescriptor } from '@/lib/catalog/stepSpec';
import type { RuleCategory } from '@/lib/catalog/canon/types';

const ARCHETYPE_CANON: Record<string, RuleCategory[]> = {
  brief: ['game'],
  schema: ['project', 'game'],
  rules: ['project', 'game'],
  balance: ['project', 'game'],
  gallery: ['art', 'game'],
  checklist: ['project'],
  manifest: ['project'],
  graph: ['game', 'project'],
};

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
  if (view.kind === 'graph') {
    const g = (data[view.field] ?? {}) as { nodes?: { id: string; label?: string; terminal?: boolean }[]; edges?: { from: string; to: string; label?: string }[] };
    const nodes = g.nodes ?? [];
    const edges = g.edges ?? [];
    return nodes.length ? (
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {nodes.map((n) => <span key={n.id} className={t.fontMono} style={{ fontSize: 14, padding: '4px 10px', border: `1px solid ${n.terminal ? t.ok : t.line}`, borderRadius: t.glass ? 6 : 0, color: n.terminal ? t.ok : t.text }}>{n.label ?? n.id}{n.terminal ? ' ◉' : ''}</span>)}
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          {edges.map((e, i) => <span key={i} className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>{e.from} → {e.to}{e.label ? ` (${e.label})` : ''}</span>)}
        </div>
      </div>
    ) : <span style={{ fontSize: 15, color: t.muted }}>No graph yet — run Produce.</span>;
  }
  // gallery: simple candidate count; bespoke selection UI lives in a registered component when richer interaction is needed.
  return <span style={{ fontSize: 14, color: t.muted }}>{view.candidates} candidates · select via Produce.</span>;
}

/** Hybrid generic renderer: drives any common-archetype StepSpec from persisted artifacts. */
export function ArchetypeStep({ t, entity, step, spec, catalogId }: { t: LabTheme; entity: LabEntity; step: string; spec: StepSpec; catalogId?: string }) {
  const art = useLabStep(entity.id, step);
  const produce = useLabPipelineStore((s) => s.produce);
  const canonRules = useCanonStore((s) => s.rules);
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const data = art?.data ?? {};
  const links = readLinks(data);
  const linkRes = links.length ? linkTargetsExist(links, (c, e) => !!entitiesByCatalog[c]?.[e]) : null;
  return (
    <>
      {linkRes && (
        <div style={{
          borderLeft: `4px solid ${linkRes.status === 'pass' ? t.ok : linkRes.status === 'deferred' ? t.muted : t.warn}`,
          padding: '6px 12px',
          marginBottom: 8,
          fontSize: 14,
          color: t.text,
        }}>
          {linkRes.label}: {linkRes.detail}{linkRes.reason ? ` — ${linkRes.reason}` : ''}
        </div>
      )}
      <StepFrame t={t} acceptance={spec.accept(data)}
        panels={[
          { label: 'View', node: <ViewPanel t={t} view={spec.view} data={data} /> },
          { label: 'Produce', node: (
            <CliProduce t={t} label={`Generate ${spec.label} (CLI)`} rows={3}
              defaultDirection={spec.defaultDirection} note={spec.produceNote}
              buildPrompt={(dir) => {
                const canon = canonContextFor(canonRules, catalogId, ARCHETYPE_CANON[spec.archetype]);
                return [canon, `Produce ${spec.label} for ${entity.name}. ${dir}`].filter(Boolean).join('\n\n');
              }}
              onComplete={() => produce(entity.id, step, spec.produce(entity))} />
          ) },
        ]}
      />
    </>
  );
}
