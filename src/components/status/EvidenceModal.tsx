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
import { fetchArtifacts } from '@/components/layout-lab/labArtifactClient';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { StepCell } from '@/lib/status/statusModel';

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

function ProofPanel({ data }: { data: Data }) {
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
      <img alt="stored 2D output" src={img} style={{ maxWidth: '100%', maxHeight: 440, display: 'block' }} />
    </div>
  );
  const audio = audioOf(data);
  if (audio) return (
    <div style={{ display: 'grid', gap: 10 }}>
      {audio.map((a, i) => (
        <div key={a.relPath ?? i} style={{ ...surface, padding: '8px 10px', display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--lab-text)' }}>{a.text ?? a.filename ?? `clip ${i + 1}`}</span>
          <audio controls preload="none" style={{ width: '100%', height: 32 }} src={`/api/audio-asset?relPath=${encodeURIComponent(a.relPath)}`} />
        </div>
      ))}
    </div>
  );
  return (
    <pre
      style={{ margin: 0, maxHeight: 440, overflow: 'auto', fontSize: 12, lineHeight: 1.55, fontFamily: mono, color: 'var(--lab-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...surface, padding: 12 }}
      dangerouslySetInnerHTML={{ __html: jsonHtml(configData(data)) }}
    />
  );
}

export function EvidenceModal({ catalogId, step, cell, onClose }: { catalogId: string; step: string; cell: StepCell; onClose: () => void }) {
  const [arts, setArts] = useState<PipelineArtifact[] | null>(null);
  const [idx, setIdx] = useState(0);

  // The modal is remounted per cell (keyed in PipelinesView), so state starts fresh —
  // this effect only fetches, no synchronous reset needed.
  useEffect(() => {
    let live = true;
    fetchArtifacts(catalogId).then((all) => { if (live) setArts(all.filter((a) => a.step === step)); });
    return () => { live = false; };
  }, [catalogId, step]);

  const art = arts?.[idx];
  const j = cell.judged;
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
      className="max-w-2xl"
    >
      {/* Guaranteed-opaque Blueprint fill via inline style (Tailwind important on the shared
          panel was unreliable). Negative margin cancels the panel's p-5 so --lab-bg reaches
          the edges; the light fill stops translucent sub-panels bleeding the map through. */}
      <div style={{ width: '100%', color: 'var(--lab-text)', fontFamily: 'var(--lab-font-body)', background: 'var(--lab-bg)', border: '1px solid var(--lab-line)', margin: '-21px', padding: '20px' }}>
        {/* Blueprint header (own close — the shared dark header is suppressed via `label`). */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, borderBottom: '1px solid var(--lab-line)', paddingBottom: 10, marginBottom: 14 }}>
          <h2 style={{ fontFamily: mono, fontSize: 15, color: 'var(--lab-ink-deep)', letterSpacing: '0.03em', textTransform: 'uppercase', margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {catalogId} · {step}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="focus-ring"
            style={{ flexShrink: 0, fontFamily: mono, fontSize: 16, lineHeight: 1, color: 'var(--lab-muted)', background: 'transparent', border: '1px solid var(--lab-line)', borderRadius: 0, width: 26, height: 26, cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          <Badge>grade: {cell.grade}</Badge>
          <Badge>engine: {cell.engine}</Badge>
          {cell.tier && <Badge>{cell.tier}</Badge>}
          {proofKind && <Badge>proof: {proofKind}</Badge>}
        </div>

        {/* Verdict — compare against the proof below */}
        {j ? (
          <div style={{ fontSize: 13, borderLeft: `3px solid ${j.verdict === 'pass' ? 'var(--lab-ok)' : 'var(--lab-bad)'}`, padding: '8px 12px', marginBottom: 14, ...surface }}>
            <span style={{ fontFamily: mono, fontWeight: 700, color: j.verdict === 'pass' ? 'var(--lab-ok)' : 'var(--lab-bad)' }}>{j.verdict.toUpperCase()} {j.score}/100</span>
            <span style={{ color: 'var(--lab-muted)', fontFamily: mono, fontSize: 12 }}> · {j.model}</span>
            <div style={{ marginTop: 5, color: 'var(--lab-text)', lineHeight: 1.5 }}>{j.findings}</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--lab-muted)', padding: '8px 12px', marginBottom: 14, borderLeft: '3px solid var(--lab-line)', ...surface }}>
            No content-quality judgment{cell.judge ? ` — would need a ${cell.judge} judge` : ''}{cell.checkerMeaningful === false ? ' · checker is shape-only' : ''}.
            {cell.reason ? ` (${cell.reason})` : ''}
          </div>
        )}

        {/* Entity switcher when the step has multiple seeded entities */}
        {arts && arts.length > 1 && (
          <label style={{ fontSize: 12, color: 'var(--lab-muted)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontFamily: mono }}>
            ENTITY
            <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}
              style={{ fontSize: 12, fontFamily: mono, color: 'var(--lab-ink)', background: 'var(--lab-panel)', border: '1px solid var(--lab-line)', borderRadius: 0, padding: '2px 6px' }}>
              {arts.map((a, i) => <option key={a.entityId} value={i}>{a.entityId} ({a.status})</option>)}
            </select>
          </label>
        )}

        {/* The stored output the gate evaluated */}
        {arts === null ? <div style={{ fontSize: 13, color: 'var(--lab-muted)' }}>Loading stored output…</div>
          : !art ? <div style={{ fontSize: 13, color: 'var(--lab-muted)' }}>No stored artifact for this step yet.</div>
            : <ProofPanel data={art.data as Data} />}
      </div>
    </Modal>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, fontFamily: mono, color: 'var(--lab-ink)', padding: '2px 8px', borderRadius: 0, background: 'var(--lab-panel)', border: '1px solid var(--lab-line)', whiteSpace: 'nowrap' }}>{children}</span>;
}
