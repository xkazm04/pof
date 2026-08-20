'use client';

/**
 * EvidenceModal — the "don't blind-trust the gate" audit view. Clicking a Pipelines-map
 * cell opens this instead of redirecting to Item Focus: it fetches the step's stored
 * artifact and renders the ACTUAL output the evaluation was based on, by deliverable type
 * (2D image · 3D .glb via GlbViewer · playable audio · formatted text/config), alongside
 * the gate's verdict — so you can see where the evaluation is out of touch and needs
 * higher-quality prompting/gating. Styled to the light Blueprint theme (sharp corners,
 * --lab-* tokens, mono) of the /status page.
 */
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Modal } from '@/components/ui/Modal';
import { DimensionScoreBars } from '@/components/ui/DimensionScoreBars';
import { tryApiFetch } from '@/lib/api-utils';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { engineClass, engineClassNote, engineSourceMark, isTrustedClass, type StepCell } from '@/lib/status/statusModel';
import { readProvenance } from '@/lib/provenance';

const GlbViewer = dynamic(() => import('@/components/layout-lab/steps/shared/GlbViewer').then((m) => m.GlbViewer), {
  ssr: false,
  loading: () => <div style={{ height: 300, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--lab-muted)' }}>Loading 3D viewer…</div>,
});

type Data = Record<string, unknown>;
interface Cand { id?: string; swatch?: unknown; payload?: Record<string, unknown> }

function candidatesOf(d: Data): Cand[] {
  const gh = d?.genHistory as { batches?: { candidates?: Cand[] }[]; selectedId?: string } | undefined;
  return gh?.batches?.flatMap((b) => b.candidates ?? []) ?? [];
}
function selectedCandidate(d: Data): Cand | null {
  const gh = d?.genHistory as { selectedId?: string } | undefined;
  const cs = candidatesOf(d);
  return cs.find((c) => c.id === gh?.selectedId) ?? cs[0] ?? null;
}
function imageDataUrl(d: Data): string | null {
  const c = selectedCandidate(d);
  const m = typeof c?.swatch === 'string' ? c.swatch.match(/^url\((data:image[^)]+)\)$/) : null;
  return m ? m[1] : null;
}
function glbUrlOf(d: Data): string | null {
  if (typeof d?.glbUrl === 'string') return d.glbUrl;
  const u = selectedCandidate(d)?.payload?.glbUrl;
  return typeof u === 'string' ? u : null;
}
function audioOf(d: Data): { relPath: string; text?: string; filename?: string }[] | null {
  const a = d?.audioAssets;
  return Array.isArray(a) && a.length ? (a as { relPath: string; text?: string; filename?: string }[]) : null;
}
/** Config = the data minus the heavy embedded-media fields. */
function configData(d: Data): Data {
  const clone: Data = {};
  for (const [k, v] of Object.entries(d)) {
    if (k === 'genHistory' || k === 'audioAssets') continue;
    clone[k] = v;
  }
  return clone;
}

const mono = 'var(--lab-font-mono)';
const surface = { background: 'var(--lab-panel)', border: '1px solid var(--lab-line)', borderRadius: 0 } as const;
/** One vertical rhythm for every stacked section of the modal body. */
const SECTION_GAP = 14;
/** Shared footprint for the loading / empty / error placeholders so the panel doesn't jump. */
const stateBox = { ...surface, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, color: 'var(--lab-muted)' } as const;

/** Minimal JSON syntax coloring for the light Blueprint floor (keys / strings / scalars). */
function jsonHtml(value: unknown): string {
  const json = JSON.stringify(value, null, 2) ?? '';
  const esc = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(
    /("(\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?/g,
    (m, str, _c, colon, kw) => {
      if (str && colon) return `<span style="color:var(--lab-ink-deep);font-weight:600">${str}</span>${colon}`;
      if (str) return `<span style="color:var(--lab-ok)">${str}</span>`;
      if (kw) return `<span style="color:var(--lab-warn)">${m}</span>`;
      return `<span style="color:var(--lab-warn)">${m}</span>`;
    },
  );
}

/** `label` names the step this output belongs to, so alt text / region names are self-describing. */
function ProofPanel({ data, label }: { data: Data; label: string }) {
  const glb = glbUrlOf(data);
  if (glb) return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ border: '1px solid var(--lab-line)' }}><GlbViewer url={glb} height={340} /></div>
      <span style={{ fontSize: 11, fontFamily: mono, color: 'var(--lab-muted)', wordBreak: 'break-all' }}>{glb}</span>
    </div>
  );
  const img = imageDataUrl(data);
  if (img) return (
    <div style={{ ...surface, padding: 8, display: 'grid', placeItems: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={`Stored 2D output for ${label}`} src={img} style={{ maxWidth: '100%', maxHeight: 440, display: 'block' }} />
    </div>
  );
  const audio = audioOf(data);
  if (audio) return (
    <div role="group" aria-label={`Stored audio output for ${label}`} style={{ display: 'grid', gap: 10 }}>
      {audio.map((a, i) => {
        const clip = a.text ?? a.filename ?? `clip ${i + 1}`;
        return (
          <div key={a.relPath ?? i} style={{ ...surface, padding: '8px 10px', display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--lab-text)' }}>{clip}</span>
            {/* Named per clip — the visible caption above it is not programmatically associated. */}
            <audio controls preload="none" aria-label={clip} style={{ width: '100%', height: 32 }} src={`/api/audio-asset?relPath=${encodeURIComponent(a.relPath)}`} />
          </div>
        );
      })}
    </div>
  );
  return (
    // Scrollable → focusable, so keyboard users can reach and scroll the JSON.
    <pre
      tabIndex={0}
      role="region"
      aria-label={`Stored text / config output for ${label}`}
      className="focus-ring-inset"
      style={{ margin: 0, maxHeight: 440, overflow: 'auto', fontSize: 12, lineHeight: 1.55, fontFamily: mono, color: 'var(--lab-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...surface, padding: 12 }}
      dangerouslySetInnerHTML={{ __html: jsonHtml(configData(data)) }}
    />
  );
}

export function EvidenceModal({ catalogId, step, cell, onClose }: { catalogId: string; step: string; cell: StepCell; onClose: () => void }) {
  const [arts, setArts] = useState<PipelineArtifact[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [verdicts, setVerdicts] = useState<JudgeVerdict[]>([]);
  const [idx, setIdx] = useState(0);

  // The modal is remounted per cell (keyed in PipelinesView), so state starts fresh —
  // this effect only fetches, no synchronous reset needed.
  // Read the artifacts through `tryApiFetch` rather than `fetchArtifacts` (which folds any
  // failure into `[]`): a transport error must NOT be rendered as "nothing produced yet" —
  // that's exactly the blind trust this modal exists to break.
  useEffect(() => {
    let live = true;
    tryApiFetch<PipelineArtifact[]>(`/api/pipeline-artifacts?catalogId=${encodeURIComponent(catalogId)}`)
      .then((r) => {
        if (!live) return;
        if (r.ok) setArts(r.data.filter((a) => a.step === step));
        else setLoadError(r.error);
      });
    // The judged projection on the cell carries the verdict summary but not the per-dimension
    // scores; fetch the raw verdicts for this catalog so the detail view can show them (WS2).
    tryApiFetch<JudgeVerdict[]>(`/api/judge-verdicts?catalogId=${encodeURIComponent(catalogId)}`)
      .then((r) => { if (live && r.ok) setVerdicts(r.data.filter((v) => v.step === step)); });
    return () => { live = false; };
  }, [catalogId, step, reload]);

  // Re-run the effect from a clean slate (state reset lives here, not in the effect body).
  const retry = () => { setArts(null); setLoadError(null); setIdx(0); setReload((n) => n + 1); };

  const art = arts?.[idx];
  const j = cell.judged;

  // Per-dimension scores for the currently shown entity: match verdicts on entity, prefer the
  // newest rubric, and among those the one that actually carries dimensions.
  const dimensions = useMemo(() => {
    if (!art) return undefined;
    const matching = verdicts.filter((v) => v.entityId === art.entityId);
    if (!matching.length) return undefined;
    const newestRubric = matching.reduce((mx, v) => Math.max(mx, v.rubricVersion ?? 1), 0);
    const withDims = matching.filter((v) => (v.rubricVersion ?? 1) === newestRubric && v.dimensions);
    return withDims[0]?.dimensions;
  }, [art, verdicts]);
  const proofKind = useMemo(() => {
    if (!art) return '';
    const d = art.data as Data;
    return glbUrlOf(d) ? '3D mesh' : imageDataUrl(d) ? '2D image' : audioOf(d) ? 'audio' : 'text / config';
  }, [art]);

  return (
    <Modal
      open
      onClose={onClose}
      label={`Evidence for ${catalogId} ${step}`}
      className="max-w-[806px]"
    >
      {/* Guaranteed-opaque Blueprint fill via inline style (Tailwind important on the shared
          panel was unreliable). The panel has p-5 (20px); cancel it symmetrically (margin -20)
          AND widen the fill (calc(100% + 40px)) so --lab-bg reaches BOTH edges — otherwise the
          shared dark bg-surface shows as dead space on the right. */}
      <div style={{ boxSizing: 'border-box', width: 'calc(100% + 40px)', margin: '-20px', padding: '20px', color: 'var(--lab-text)', fontFamily: 'var(--lab-font-body)', background: 'var(--lab-bg)' }}>
        {/* Blueprint header (own close — the shared dark header is suppressed via `label`). */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, borderBottom: '1px solid var(--lab-line)', paddingBottom: 10, marginBottom: 14 }}>
          <h2 style={{ fontFamily: mono, fontSize: 15, color: 'var(--lab-ink-deep)', letterSpacing: '0.03em', textTransform: 'uppercase', margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {catalogId} · {step}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close evidence" className="focus-ring"
            style={{ flexShrink: 0, fontFamily: mono, fontSize: 16, lineHeight: 1, color: 'var(--lab-muted)', background: 'transparent', border: '1px solid var(--lab-line)', borderRadius: 0, width: 26, height: 26, cursor: 'pointer' }}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: SECTION_GAP }}>
          <Badge>grade: {cell.grade}</Badge>
          {/* The engine name and WHERE IT CAME FROM, together — this modal exists so a gate
              is not blind-trusted, and an engine attribution nobody audited is exactly the
              kind of claim it must not launder. */}
          <Badge>
            <span data-testid="evidence-engine-source" title={engineSourceMark(cell.engineSource).note}>
              engine: {cell.engine} [{engineSourceMark(cell.engineSource).word}]
            </span>
          </Badge>
          {/* WHAT THAT ENGINE'S PASS PROVES. The trusted/ungated split has always been decided
              by the engine's credibility class, but nothing ever said so — a cell demoted for
              its class simply came back a different colour. Display-only. */}
          <Badge>
            <span data-testid="evidence-engine-credibility" title={engineClassNote(cell.engine)}>
              credibility: {engineClass(cell.engine)}
              {isTrustedClass(engineClass(cell.engine)) ? '' : ' · NEEDS A GATE'}
            </span>
          </Badge>
          {cell.tier && <Badge>{cell.tier}</Badge>}
          {proofKind && <Badge>proof: {proofKind}</Badge>}
        </div>

        {/* Verdict — compare against the proof below */}
        {j ? (
          <div style={{ fontSize: 13, borderLeft: `3px solid ${j.verdict === 'pass' ? 'var(--lab-ok)' : 'var(--lab-bad)'}`, padding: '8px 12px', marginBottom: SECTION_GAP, ...surface }}>
            <span style={{ fontFamily: mono, fontWeight: 700, color: j.verdict === 'pass' ? 'var(--lab-ok)' : 'var(--lab-bad)' }}>{j.verdict.toUpperCase()} {j.score}/100</span>
            <span style={{ color: 'var(--lab-muted)', fontFamily: mono, fontSize: 12 }}> · {j.model}{j.effort ? `/${j.effort}` : ''}{j.rubricVersion != null ? ` · rubric v${j.rubricVersion}` : ''}</span>
            <div style={{ marginTop: 5, color: 'var(--lab-text)', lineHeight: 1.5 }}>{j.findings}</div>
          </div>
        ) : null}

        {/* Per-dimension craft scores for this entity, when the verdict recorded them (WS2). */}
        {dimensions && (
          <div style={{ marginBottom: SECTION_GAP }}>
            <DimensionScoreBars dimensions={dimensions} variant="lab" />
          </div>
        )}

        {!j && (
          <div style={{ fontSize: 13, color: 'var(--lab-muted)', padding: '8px 12px', marginBottom: SECTION_GAP, borderLeft: '3px solid var(--lab-line)', ...surface }}>
            No content-quality judgment{cell.judge ? ` — would need a ${cell.judge} judge` : ''}{cell.checkerMeaningful === false ? ' · checker is shape-only' : ''}.
            {cell.reason ? ` (${cell.reason})` : ''}
          </div>
        )}

        {/* Entity switcher when the step has multiple seeded entities */}
        {arts && arts.length > 1 && (
          <label style={{ fontSize: 12, color: 'var(--lab-muted)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: SECTION_GAP, fontFamily: mono }}>
            ENTITY
            <select value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="focus-ring"
              style={{ fontSize: 12, fontFamily: mono, color: 'var(--lab-ink)', background: 'var(--lab-panel)', border: '1px solid var(--lab-line)', borderRadius: 0, padding: '2px 6px' }}>
              {arts.map((a, i) => <option key={a.entityId} value={i}>{a.entityId} ({a.status})</option>)}
            </select>
          </label>
        )}

        {/* Provenance — who/how produced this output (Quality Program WS0) */}
        {art && (() => {
          const p = readProvenance(art.data as Data);
          if (!p) return null;
          const parts = [p.engine, p.model, p.effort, p.promptVersion ? `prompt ${p.promptVersion}` : null].filter(Boolean);
          return <div style={{ fontSize: 12, fontFamily: mono, color: 'var(--lab-muted)', marginBottom: SECTION_GAP }}>produced by: {parts.join(' · ')}</div>;
        })()}

        {/* The stored output the gate evaluated — headed so the proof reads as evidence, not decoration */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontFamily: mono, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--lab-ink-deep)' }}>Stored output</h3>
          <span style={{ fontSize: 12, color: 'var(--lab-muted)' }}>what the grade above was based on</span>
        </div>
        {loadError ? (
          <div role="alert" style={{ ...stateBox, color: 'var(--lab-bad)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Couldn’t load the stored output — {loadError}. This is a fetch failure, not proof that the step is empty.</span>
            <button type="button" onClick={retry} className="focus-ring"
              style={{ flexShrink: 0, fontFamily: mono, fontSize: 12, color: 'var(--lab-ink)', background: 'var(--lab-panel)', border: '1px solid var(--lab-line)', borderRadius: 0, padding: '3px 10px', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : arts === null ? (
          <div role="status" style={stateBox}>Loading stored output…</div>
        ) : !art ? (
          <div role="status" style={stateBox}>Nothing produced yet — this step has no stored artifact, so the grade above has no output behind it.</div>
        ) : (
          <ProofPanel data={art.data as Data} label={`${catalogId} · ${step}`} />
        )}
      </div>
    </Modal>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, fontFamily: mono, color: 'var(--lab-ink)', padding: '2px 8px', borderRadius: 0, background: 'var(--lab-panel)', border: '1px solid var(--lab-line)', whiteSpace: 'nowrap' }}>{children}</span>;
}
