'use client';

import { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { StepFrame, type StepPanel } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { CandidateGallery } from './shared/CandidateGallery';

// three/r3f is client + WebGL only — load the .glb viewer lazily so it never hits SSR
// and only pulls the 3D bundle for steps that actually render a mesh.
const GlbViewer = dynamic(() => import('./shared/GlbViewer').then((m) => m.GlbViewer), {
  ssr: false,
  loading: () => <div style={{ height: 260, display: 'grid', placeItems: 'center', fontSize: 12, opacity: 0.6 }}>Loading 3D viewer…</div>,
});
import { selectedCandidate } from './shared/genHistory';
import { useGenerativeStep } from './shared/useGenerativeStep';
import { genericGalleryCandidates } from './shared/genericGalleryCandidates';
import { useLabPipelineStore } from '../labPipelineStore';
import { useCanonStore } from '../canonStore';
import { canonContextFor } from '@/lib/catalog/canon/canonContext';
import { ARCHETYPE_CANON } from '@/lib/catalog/canon/archetypeCanon';
import { qualityPack } from '@/lib/prompts/quality';
import { deliverableClassOf } from '@/lib/judge/dimensions';
import { getStepFact } from '@/lib/status/statusModel';
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
  const produce = useLabPipelineStore((s) => s.produce);
  const canonRules = useCanonStore((s) => s.rules);
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);

  // Memoized like StaticStepFrame: the step's produce output + its derived acceptance
  // no longer re-allocate on every render — `produced` seeds the generative engine's
  // base (ueAssets/links/static data) and drives the assetPath/glbUrl previews.
  const produced = useMemo(() => spec.produce(entity), [spec, entity]);

  // Gallery archetype: the ONE browse→compare→select loop (shared useGenerativeStep +
  // CandidateGallery + genHistory). generate/reselect derive next-state from LIVE store
  // data inside produceFrom, so two dispatches in one frame serialize (see 3d50330).
  const galleryCandidates = useCallback(
    (dir: string, seq: number) =>
      spec.view.kind === 'gallery'
        ? genericGalleryCandidates(spec.view.field, spec.view.candidates, dir, seq)
        : [],
    [spec],
  );
  const { art, history, generate, reselect } = useGenerativeStep(entity.id, step, galleryCandidates, produced);

  const data = art?.data ?? {};
  const acceptance = useMemo(() => spec.accept(art?.data ?? {}), [spec, art?.data]);
  const links = readLinks(data);
  const linkRes = links.length ? linkTargetsExist(links, (c, e) => !!entitiesByCatalog[c]?.[e]) : null;

  const buildPrompt = (dir: string) => {
    const canon = canonContextFor(canonRules, catalogId, ARCHETYPE_CANON[spec.archetype]);
    // Quality Program WS1: prepend the professional-grade quality pack for this deliverable
    // class (shares the judge's craft checklist), so production aims at the bar the judge enforces.
    const cls = catalogId ? deliverableClassOf(getStepFact(catalogId, step)?.deliverable ?? '', catalogId) : null;
    const pack = cls && catalogId ? qualityPack(cls, catalogId) : '';
    return [pack, canon, `Produce ${spec.label} for ${entity.name}. ${dir}`].filter(Boolean).join('\n\n');
  };

  const cli = (onComplete: (ctx?: { direction: string; prompt: string }) => void) => (
    <CliProduce t={t} label={`Produce ${spec.label}`} rows={3}
      defaultDirection={spec.defaultDirection} note={spec.produceNote}
      buildPrompt={buildPrompt} onComplete={onComplete} />
  );

  let panels: StepPanel[];
  if (spec.view.kind === 'gallery') {
    const sel = selectedCandidate(history);
    const assetPath = produced.ueAssets?.[0];
    // A generated 3D candidate carries a served .glb URL — render it interactively so the
    // step is visually verifiable (rotate/zoom the real mesh, not just the preview render).
    const glbUrl = typeof sel?.payload?.glbUrl === 'string' ? sel.payload.glbUrl : null;
    panels = [
      { label: 'Candidate gallery (kept across re-rolls)', node: (
        <CandidateGallery t={t} history={history} onSelect={reselect}
          emptyHint="No candidates yet — run Produce to generate the first batch." />
      ) },
      ...(glbUrl ? [{ label: '3D preview (orbit / zoom)', node: (
        <div style={{ display: 'grid', gap: 6 }}>
          <GlbViewer url={glbUrl} />
          <span className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>{glbUrl}</span>
        </div>
      ) }] : []),
      { label: 'Selected', node: (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ aspectRatio: '1', maxWidth: 160, borderRadius: t.glass ? 10 : 2, background: sel?.swatch ?? t.panel, border: `1px solid ${t.line}` }} />
          <span style={{ fontSize: 12, color: t.muted }}>Deterministic seed preview — not the generated asset.</span>
          {sel && assetPath
            ? <span className={t.fontMono} style={{ fontSize: 14, color: t.ok }}>✓ asset target: {assetPath} <span style={{ color: t.muted }}>(written by the drain)</span></span>
            : <span style={{ fontSize: 14, color: t.muted }}>Pick a candidate; the choice + its prompt persist. The asset is written to that path when the gate drain runs.</span>}
        </div>
      ) },
      { label: 'Produce', node: cli((ctx) => generate(ctx?.direction ?? spec.defaultDirection ?? '', ctx?.prompt ?? buildPrompt(spec.defaultDirection ?? ''))) },
    ];
  } else {
    // Non-gallery steps (e.g. the Rig & Clips manifest) that carry a served .glb on their
    // data get the same interactive preview — rotate the rigged/animated mesh in-place.
    const dataGlbUrl = typeof (data as { glbUrl?: unknown })?.glbUrl === 'string' ? (data as { glbUrl: string }).glbUrl : null;
    panels = [
      { label: 'View', node: <ViewPanel t={t} view={spec.view} data={data} /> },
      ...(dataGlbUrl ? [{ label: '3D preview (orbit / zoom)', node: (
        <div style={{ display: 'grid', gap: 6 }}>
          <GlbViewer url={dataGlbUrl} />
          <span className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>{dataGlbUrl}</span>
        </div>
      ) }] : []),
      { label: 'Produce', node: cli(() => produce(entity.id, step, produced)) },
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
      <StepFrame t={t} acceptance={acceptance} panels={panels} />
    </>
  );
}
