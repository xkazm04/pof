'use client';

import { StepFrame, type StepPanel } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { CandidateGallery } from './shared/CandidateGallery';
import { readHistory, makeBatch, appendBatch, selectCandidate, selectedCandidate, historyData } from './shared/genHistory';
import { genericGalleryCandidates } from './shared/genericGalleryCandidates';
import { useLabStep, useLabPipelineStore } from '../labPipelineStore';
import { useCanonStore } from '../canonStore';
import { canonContextFor } from '@/lib/catalog/canon/canonContext';
import { ARCHETYPE_CANON } from '@/lib/catalog/canon/archetypeCanon';
import { useCatalogStore } from '@/stores/catalogStore';
import { linkTargetsExist, readLinks } from '@/lib/catalog/acceptance/linkCheckers';
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
  const produceFrom = useLabPipelineStore((s) => s.produceFrom);
  const canonRules = useCanonStore((s) => s.rules);
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const data = art?.data ?? {};
  const links = readLinks(data);
  const linkRes = links.length ? linkTargetsExist(links, (c, e) => !!entitiesByCatalog[c]?.[e]) : null;

  const buildPrompt = (dir: string) => {
    const canon = canonContextFor(canonRules, catalogId, ARCHETYPE_CANON[spec.archetype]);
    return [canon, `Produce ${spec.label} for ${entity.name}. ${dir}`].filter(Boolean).join('\n\n');
  };

  // Gallery archetype: the real browse→compare→select loop (shared CandidateGallery + genHistory).
  // `history` here is a render-time view only; generate/reselect MUST derive
  // next-state from the LIVE store data inside produceFrom — the closure copy
  // drops a kept batch when two dispatches land in one frame (see 3d50330).
  const history = readHistory(data);
  const generate = (dir: string, prompt: string) => {
    const view = spec.view;
    if (view.kind !== 'gallery') return;
    produceFrom(entity.id, step, (prevData) => {
      const base = spec.produce(entity);
      const live = readHistory(prevData);
      const batch = makeBatch({
        seq: live.batches.length,
        at: new Date().toISOString(),
        direction: dir,
        prompt,
        candidates: genericGalleryCandidates(view.field, view.candidates, dir, live.batches.length),
      });
      return { ...base, data: historyData(appendBatch(live, batch), base.data) };
    });
  };
  const reselect = (id: string) => {
    produceFrom(entity.id, step, (prevData) => {
      const base = spec.produce(entity);
      return { ...base, data: historyData(selectCandidate(readHistory(prevData), id), base.data) };
    });
  };

  const cli = (onComplete: (ctx?: { direction: string; prompt: string }) => void) => (
    <CliProduce t={t} label={`Generate ${spec.label} (CLI)`} rows={3}
      defaultDirection={spec.defaultDirection} note={spec.produceNote}
      buildPrompt={buildPrompt} onComplete={onComplete} />
  );

  let panels: StepPanel[];
  if (spec.view.kind === 'gallery') {
    const sel = selectedCandidate(history);
    const assetPath = spec.produce(entity).ueAssets?.[0];
    panels = [
      { label: 'Candidate gallery (kept across re-rolls)', node: (
        <CandidateGallery t={t} history={history} onSelect={reselect}
          emptyHint="No candidates yet — run Produce to generate the first batch." />
      ) },
      { label: 'Selected', node: (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ aspectRatio: '1', maxWidth: 160, borderRadius: t.glass ? 10 : 2, background: sel?.swatch ?? t.panel, border: `1px solid ${t.line}` }} />
          {sel && assetPath
            ? <span className={t.fontMono} style={{ fontSize: 14, color: t.ok }}>✓ writes {assetPath}</span>
            : <span style={{ fontSize: 14, color: t.muted }}>Pick a candidate; the choice + its prompt persist and write the asset path.</span>}
        </div>
      ) },
      { label: 'Produce', node: cli((ctx) => generate(ctx?.direction ?? spec.defaultDirection ?? '', ctx?.prompt ?? buildPrompt(spec.defaultDirection ?? ''))) },
    ];
  } else {
    panels = [
      { label: 'View', node: <ViewPanel t={t} view={spec.view} data={data} /> },
      { label: 'Produce', node: cli(() => produce(entity.id, step, spec.produce(entity))) },
    ];
  }

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
      <StepFrame t={t} acceptance={spec.accept(data)} panels={panels} />
    </>
  );
}
