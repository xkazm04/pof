'use client';

import { useCallback, useMemo } from 'react';
import { StepFrame, type StepPanel } from './StepFrame';
import { CliProduce } from './shared/CliProduce';
import { CandidateGallery } from './shared/CandidateGallery';
import { DataTable } from './shared/DataTable';
import { ChartPanel, type BarsRow, type ScatterPoint } from './shared/ChartPanel';
import { GlbPreviewPanel, GLB_PREVIEW_LABEL } from './shared/GlbPreviewPanel';
import { RawArtifactDisclosure } from './shared/RawArtifactDisclosure';
import { StepHistoryPanel } from './shared/StepHistoryPanel';
import { selectedCandidate, selectionSource } from './shared/genHistory';
import { useGenerativeStep } from './shared/useGenerativeStep';
import { useGeneratedImageAssets } from './shared/useGeneratedImageAssets';
import { useGeneratedMeshAssets } from './shared/useGeneratedMeshAssets';
import { fixDirectionFor, withGenericFixCopy } from './shared/genericFixCopy';
import { imageGalleryCandidates } from './shared/imageGalleryCandidates';
import { useLabPipelineStore } from '../labPipelineStore';
import { useStepAcceptance } from './shared/useStepAcceptance';
import { useCanonStore } from '../canonStore';
import { canonContextFor } from '@/lib/catalog/canon/canonContext';
import { stepContractBlock, canonCategoriesForStep } from '@/lib/catalog/contractPrompt';
import { qualityPack } from '@/lib/prompts/quality';
import { deliverableClassOf } from '@/lib/judge/dimensions';
import { getStepFact } from '@/lib/status/statusModel';
import { withProduceDirection } from '@/lib/catalog/produceDirection';
import { isCliEligible, isLiveProduceEnabled, type OneShotStepResult } from '../labProduceMode';
import { apiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { useCatalogStore } from '@/stores/catalogStore';
import { linkTargetsExist, readLinks } from '@/lib/catalog/acceptance/linkCheckers';
import { resolveTableView } from '@/lib/catalog/tableView';
import { collectStepEvidence, evidenceBlock } from './shared/stepEvidence';
import type { AcceptanceResult, CheckerContext } from '@/lib/catalog/acceptance/types';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';
import type { StepSpec, ViewDescriptor } from '@/lib/catalog/stepSpec';

/** Plain-language name of a value's runtime shape, for honest mismatch copy. */
function describeShape(v: unknown): string {
  if (v == null) return 'nothing';
  if (Array.isArray(v)) return 'a list';
  if (typeof v === 'object') return 'a key·value object';
  return `a ${typeof v}`;
}

/** The shared checklist/manifest list rendering (array of primitives/tuples). */
function renderChecklist(t: LabTheme, arr: unknown[]) {
  return arr.length ? (
    <div>{arr.map((x, i) => <div key={i} className={t.fontMono} style={{ fontSize: 14, padding: '6px 0', borderTop: `1px solid ${t.line}`, color: t.text }}>✓ {String(Array.isArray(x) ? x.join(' · ') : x)}</div>)}</div>
  ) : (
    <span style={{ fontSize: 15, color: t.muted }}>Nothing yet — run Produce.</span>
  );
}

/** Loud, honest state for a kind/shape mismatch — data IS present but the wrong shape
 *  for the view kind, so it names expected vs actual instead of the empty-state lie. */
function ShapeMismatch({ t, field, expected, actual }: { t: LabTheme; field: string; expected: string; actual: string }) {
  return (
    <div data-testid="view-shape-mismatch" style={{ display: 'grid', gap: 4, fontSize: 14, color: t.warn }}>
      <span className={t.fontMono} style={{ fontWeight: 700 }}>⚠ Unexpected shape for “{field}”</span>
      <span style={{ color: t.text, lineHeight: 1.5 }}>
        This view expects {expected}, but the produced data holds {actual}. The step ran — the data just can’t render here. Check the Produce output for this step.
      </span>
    </div>
  );
}

export function ViewPanel({ t, view, data }: { t: LabTheme; view: ViewDescriptor; data: Record<string, unknown> }) {
  if (view.kind === 'prose') {
    const txt = String(data[view.field] ?? '');
    return txt
      ? <div style={{ fontSize: 15, lineHeight: 1.7, color: t.text, whiteSpace: 'pre-wrap' }}>{txt}</div>
      : <span style={{ fontSize: 15, color: t.muted }}>{view.emptyText}</span>;
  }
  if (view.kind === 'table') {
    // Resolved by the SHARED pure resolver (catalog/tableView.ts) the spec linter also
    // uses, so a column the linter accepts is exactly a column this renders. It reads the
    // three shapes produce bodies actually write — a flat record, a LIST of row records, or
    // a KEYED GROUP of them — instead of assuming the columns live at the top level (which
    // rendered 28 tables as nothing but "— missing").
    const res = resolveTableView(data, view.field, view.columns, view.rowsKey);
    if (res.mode === 'absent') return <span style={{ fontSize: 15, color: t.muted }}>Nothing yet — run Produce.</span>;
    if (res.mode === 'mismatch') {
      return <ShapeMismatch t={t} field={view.rowsKey ? `${view.field}.${view.rowsKey}` : view.field}
        expected="a key·value record or a list of row records" actual={res.actual} />;
    }
    return res.mode === 'rows'
      ? <DataTable t={t} columns={view.columns} rows={res.rows} />
      : <DataTable t={t} columns={view.columns} values={res.values} />;
  }
  if (view.kind === 'chart') {
    const raw = data[view.field];
    if (raw == null || typeof raw !== 'object') {
      return <span style={{ fontSize: 15, color: t.muted }}>No data yet — run Produce.</span>;
    }
    const rec = raw as Record<string, unknown>;
    const num = (v: unknown): number | null => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      const n = Number(v);
      return v != null && v !== '' && Number.isFinite(n) ? n : null;
    };
    const noData = <span style={{ fontSize: 15, color: t.muted }}>No numeric data yet — run Produce.</span>;
    if (view.variant === 'bars') {
      const rows: BarsRow[] = view.rows.flatMap((r) => {
        const value = num(rec[r.key]);
        return value == null ? [] : [{ label: r.label ?? r.key, value, unit: r.unit, highlight: r.key === view.highlightKey }];
      });
      return rows.length
        ? <ChartPanel t={t} variant="bars" rows={rows} max={view.max} ariaLabel={`${view.field} budget`} />
        : noData;
    }
    if (view.variant === 'histogram') {
      const bars = view.keys.map((k) => ({ value: num(rec[k]) ?? 0, highlight: k === view.highlightKey }));
      return bars.length
        ? <ChartPanel t={t} variant="histogram" bars={bars} max={view.max} ariaLabel={`${view.field} histogram`} />
        : noData;
    }
    if (view.variant === 'scatter') {
      // Read `field[referenceKey]` / `field[pointsKey]` as arrays of {x,y[,label]}; coerce
      // to numbers and drop any non-numeric point so the axes never NaN out.
      const toPoints = (key: string | undefined): ScatterPoint[] => {
        const arr = key ? rec[key] : undefined;
        if (!Array.isArray(arr)) return [];
        return arr.flatMap((p) => {
          const o = (p ?? {}) as Record<string, unknown>;
          const x = num(o.x), y = num(o.y);
          return x == null || y == null ? [] : [{ x, y, label: typeof o.label === 'string' ? o.label : undefined }];
        });
      };
      const reference = toPoints(view.referenceKey);
      const points = toPoints(view.pointsKey);
      return reference.length || points.length
        ? <ChartPanel t={t} variant="scatter" reference={reference} points={points}
            xDomain={view.xDomain} yDomain={view.yDomain} xLabel={view.xLabel} yLabel={view.yLabel}
            ariaLabel={`${view.field} scatter`} />
        : noData;
    }
    // waveform
    const samplesRaw = rec[view.samplesKey];
    const samples = Array.isArray(samplesRaw)
      ? samplesRaw.flatMap((v) => { const n = num(v); return n == null ? [] : [n]; })
      : [];
    const active = view.activeKey != null ? Boolean(rec[view.activeKey]) : true;
    return samples.length
      ? <ChartPanel t={t} variant="waveform" samples={samples} active={active} ariaLabel={`${view.field} waveform`} />
      : noData;
  }
  if (view.kind === 'checklist') {
    const raw = data[view.field];
    if (raw == null) return <span style={{ fontSize: 15, color: t.muted }}>Nothing yet — run Produce.</span>;
    // Data is present. An array renders as the checklist; anything else is a real
    // kind/shape mismatch — name it loudly instead of the empty-state lie (a produced,
    // passing step that LOOKS unproduced). See silent-lie class in the manifest.
    if (Array.isArray(raw)) return renderChecklist(t, raw);
    return <ShapeMismatch t={t} field={view.field} expected="a list" actual={describeShape(raw)} />;
  }
  if (view.kind === 'manifest') {
    const raw = data[view.field];
    if (raw == null) return <span style={{ fontSize: 15, color: t.muted }}>Nothing yet — run Produce.</span>;
    // Arrays keep the checklist-style list; a keyed object renders as key·value rows
    // via the shared DataTable (manifest no longer renders identically to checklist).
    if (Array.isArray(raw)) return renderChecklist(t, raw);
    if (typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) return <span style={{ fontSize: 15, color: t.muted }}>Nothing yet — run Produce.</span>;
      const values: Record<string, unknown> = {};
      for (const k of keys) {
        const v = obj[k];
        values[k] = Array.isArray(v) ? v.join(' · ') : v != null && typeof v === 'object' ? JSON.stringify(v) : v;
      }
      return <DataTable t={t} columns={keys.map((k) => ({ key: k }))} values={values} />;
    }
    // A bare string/number/boolean can't be a manifest — honest mismatch, not empty state.
    return <ShapeMismatch t={t} field={view.field} expected="a list or key·value object" actual={describeShape(raw)} />;
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
  if (view.kind === 'gallery') {
    // Reached only defensively — real gallery steps build their own panels in
    // ArchetypeStep. A simple candidate count; the browse/select UI is the CandidateGallery.
    return <span style={{ fontSize: 14, color: t.muted }}>{view.candidates} candidates · select via Produce.</span>;
  }
  // Honest fallback: an unknown/unsupported view kind names itself rather than
  // silently falling through to a gallery count (which showed nonsense for a
  // balance step before the `chart` kind existed).
  return <span style={{ fontSize: 14, color: t.warn }}>Unsupported view kind: {(view as { kind: string }).kind}</span>;
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
  //
  // A step may plug in its own candidate generator (spec.genCandidates) to surface REAL
  // generated thumbnails; ArchetypeStep pre-fetches the asset manifest and passes it in.
  //
  // 2D is now automatic for EVERY gallery step: the per-step art in `generated/icons/`
  // is matched by (catalogId, step) from the generator's own filename id, so a step's own
  // generated icon reaches its gallery without the step declaring anything. 3D stays
  // opt-in (`genCandidates.assetKind: '3d'`) because a mesh isn't a thumbnail.
  const isGallery = spec.view.kind === 'gallery';
  const assetKind = spec.genCandidates?.assetKind ?? '2d';
  const wants3d = isGallery && !!spec.genCandidates?.needsAssets && assetKind === '3d';
  // Both hooks are called unconditionally (hooks discipline); each no-ops unless its
  // branch is the one requested. A '3d' gallery gets the .glb manifest so its candidates
  // carry payload.glbUrl (→ interactive GlbViewer); '2d' gets THIS step's generated art.
  const imageMatch = useMemo(
    () => (catalogId ? { catalogId, step } : null),
    [catalogId, step],
  );
  const imageAssets = useGeneratedImageAssets(isGallery && !wants3d, imageMatch);
  const meshAssets = useGeneratedMeshAssets(wants3d);
  const galleryAssets = wants3d ? meshAssets : imageAssets;
  const galleryCandidates = useCallback(
    (dir: string, seq: number) => {
      if (spec.view.kind !== 'gallery') return [];
      if (spec.genCandidates) return spec.genCandidates.build(dir, seq, galleryAssets);
      // No bespoke generator: real per-step art when it exists, honest swatches otherwise
      // (imageGalleryCandidates delegates to genericGalleryCandidates on an empty manifest).
      return imageGalleryCandidates(spec.view.field, spec.view.candidates, galleryAssets, dir, seq);
    },
    [spec, galleryAssets],
  );
  const { art, history, generate, reselect } = useGenerativeStep(entity.id, step, galleryCandidates, produced);

  const data = art?.data ?? {};
  // Derive acceptance through the SHARED hook (checker → server drain overlay → judge
  // bridge) that the bespoke Items frames use too — one grading context for every step UI
  // in the lab. The generic renderer then layers its plain-language remediation copy
  // (bespoke `spec.copy` or the neutral fallback) on top, so the ~330 non-Items steps get
  // the same why/suggestion/Produce-fix affordance the bespoke Items steps have.
  const accept = useCallback(
    (data: Record<string, unknown>, ctx: CheckerContext) => spec.accept(data, ctx),
    [spec],
  );
  const judged = useStepAcceptance({ catalogId: catalogId ?? '', entityId: entity.id, step, art, accept });
  const acceptance = useMemo(
    () => withGenericFixCopy(spec, judged as AcceptanceResult, art?.data ?? {}),
    [spec, judged, art],
  );
  const links = readLinks(data);
  const linkRes = links.length ? linkTargetsExist(links, (c, e) => !!entitiesByCatalog[c]?.[e]) : null;

  const buildPrompt = (dir: string) => {
    // Canon scope: a content-invariant step (a wrong NUMBER fails it) gets the FULL in-scope
    // canon so the threshold it will be graded by is visible; shape-only steps keep their
    // archetype slice. Single-sourced with the headless recipe via `canonCategoriesForStep`.
    const canon = canonContextFor(canonRules, catalogId, canonCategoriesForStep(spec));
    // Quality Program WS1: prepend the professional-grade quality pack for this deliverable
    // class (shares the judge's craft checklist), so production aims at the bar the judge enforces.
    const cls = catalogId ? deliverableClassOf(getStepFact(catalogId, step)?.deliverable ?? '', catalogId) : null;
    const pack = cls && catalogId ? qualityPack(cls, catalogId) : '';
    // The step's OWN authored wiring contract + criteria — the thing its L2 checker grades.
    // Until this, ~330 generic steps were asked to produce an artifact without being told the
    // contract it would be measured against. Injection only; nothing here changes acceptance.
    const contract = stepContractBlock(spec, entity);
    // The REAL artifacts this step is currently showing, cited by served URL so a
    // corrective produce is feedback ON the output rather than a re-description of it.
    // Empty (and absent from the prompt) whenever nothing real exists to point at — a
    // deterministic swatch is never cited as if it were a produced asset.
    const evidence = evidenceBlock(collectStepEvidence(data));
    return [pack, canon, contract, evidence, `Produce ${spec.label} for ${entity.name}. ${dir}`]
      .filter(Boolean).join('\n\n');
  };

  // Surfaced beside the dispatch button: attached evidence must never ride invisibly into
  // a prompt (the same rule the Style DNA indicator follows).
  const evidence = collectStepEvidence(data);

  /**
   * The ONE dispatch path for a non-gallery step. The operator's typed direction is a real
   * produce input now: it is forwarded to `spec.produce(entity, direction)` and stamped onto
   * the artifact (`data.produceDirection`), so the Raw artifact panel shows verbatim what
   * drove the step instead of the direction vanishing on unmount.
   *
   * When live-CLI produce is enabled (opt-in, off by default) AND the archetype is a text
   * deliverable a CLI session can author, the dispatch goes through the real
   * `POST /api/one-shot/step` seam and the store adopts what the SERVER persisted. A failure
   * rejects, so `CliProduce` reports the reason and offers "Retry with same prompt" (Rule 4).
   * Stub mode writes synchronously inside the click (no await before the store write), which
   * is what keeps the Rule 5 walker green.
   */
  const dispatchProduce = async (pctx?: { direction: string; prompt: string }) => {
    const dir = pctx?.direction ?? '';
    if (catalogId && isCliEligible(spec.archetype) && isLiveProduceEnabled()) {
      const res = await apiFetch<OneShotStepResult>('/api/one-shot/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogId, entityId: entity.id, stepLabel: step, mode: 'cli', direction: dir,
          proposal: { name: entity.name, data: entity.data },
        }),
      });
      produce(entity.id, step, { data: res.artifactData ?? {}, ueAssets: res.ueAssets ?? [] });
      return;
    }
    produce(entity.id, step, withProduceDirection(spec.produce(entity, dir), pctx));
  };

  // One-click "Produce fix": dispatches the corrective direction through the step's OWN
  // prompt logic, reusing the exact state-change path the Produce panel uses (a gallery
  // step appends a corrective batch; a static step re-produces). Deferred is a correct
  // terminal state, so no fix is offered there (withGenericFixCopy also omits fixDirection).
  //
  // The dispatched direction is NEVER empty: `withGenericFixCopy` already guarantees a
  // non-empty `fixDirection` for every non-deferred status (bespoke copy → the step's
  // `defaultDirection` → the direction derived from the failing checker itself), and this
  // resolves the same ladder again as a belt-and-braces last line. It used to end in
  // `?? ''`, so every step whose checker returned no `reason` produced with NO instruction.
  const runFix = (fixDir?: string) => {
    const dir = fixDir?.trim() || spec.defaultDirection?.trim() || fixDirectionFor(spec, judged);
    if (spec.view.kind === 'gallery') generate(dir, buildPrompt(dir));
    else void dispatchProduce({ direction: dir, prompt: buildPrompt(dir) })
      .catch((e: unknown) => logger.error('[ArchetypeStep] produce fix failed', e));
  };

  // Exactly the condition `dispatchProduce` tests before taking the live branch — so the
  // switch only appears where flipping it actually changes what the next click does.
  const liveEligible = !!catalogId && isCliEligible(spec.archetype);

  const cli = (onComplete: (ctx?: { direction: string; prompt: string }) => void | Promise<void>) => (
    <CliProduce t={t} label={`Produce ${spec.label}`} rows={3}
      defaultDirection={spec.defaultDirection} note={spec.produceNote}
      liveEligible={liveEligible}
      attachments={evidence.map((e) => `${e.kind} · ${e.url}`)}
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
      ...(glbUrl ? [{ label: GLB_PREVIEW_LABEL, node: <GlbPreviewPanel t={t} url={glbUrl} /> }] : []),
      { label: 'Selected', node: (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ aspectRatio: '1', maxWidth: 160, borderRadius: t.glass ? 10 : 2, background: sel?.swatch ?? t.panel, border: `1px solid ${t.line}`, overflow: 'hidden' }}>
            {sel?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- served blob from /api/visual-gen/asset; next/image adds no value for a local API stream
              <img src={sel.imageUrl} alt={sel.caption ?? 'selected generated asset'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
          </div>
          {/* An imageUrl is only ever set by imageGalleryCandidates from THIS step's own
              matched art, so the "real" claim names the file it is actually showing —
              it used to be attached to a TripoSR mesh turntable on any 2D gallery. */}
          <span data-testid="gallery-selected-caption" style={{ fontSize: 12, color: t.muted }}>
            {sel?.imageUrl
              ? `Real generated asset for this step: ${sel.caption ?? 'generated image'}`
              : 'Deterministic seed preview — not the generated asset.'}
          </span>
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
      ...(dataGlbUrl ? [{ label: GLB_PREVIEW_LABEL, node: <GlbPreviewPanel t={t} url={dataGlbUrl} /> }] : []),
      { label: 'Produce', node: cli((pctx) => dispatchProduce(pctx)) },
    ];
  }

  // Every generic step exposes its stored payload verbatim — produce bodies write far more
  // than any View renders or Checker grades (wiringContract, notes, breakdowns), and none of
  // it was reachable from the UI. Collapsed by default; serialized only when expanded.
  panels = [...panels, { label: 'Raw artifact', node: (
    <>
      <RawArtifactDisclosure t={t} data={data} ueAssets={art?.ueAssets} verdict={art} />
      {/* The versions this step's re-produces superseded. Server-side, because the local
          store only ever holds the current artifact; loaded on demand, because a recovery
          affordance must not cost a fetch on every one of the ~342 steps. */}
      {catalogId && (
        <StepHistoryPanel t={t} catalogId={catalogId} entityId={entity.id} step={step} />
      )}
    </>
  ) }];

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
      <StepFrame t={t} acceptance={acceptance} panels={panels}
        catalogId={catalogId} step={step}
        // A gallery step's `selected(...)` gate is an L1 HUMAN-selection claim, but
        // `appendBatch` auto-picks the first candidate — so the strip says which it was.
        selection={spec.view.kind === 'gallery' ? selectionSource(history) : undefined}
        onFix={acceptance.status === 'deferred' ? undefined : runFix} />
    </>
  );
}
