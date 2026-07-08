'use client';

/**
 * EvidenceModal — the "don't blind-trust the gate" audit view. Clicking a Pipelines-map
 * cell opens this instead of redirecting to Item Focus: it fetches the step's stored
 * artifact and renders the ACTUAL output the evaluation was based on, by deliverable type
 * (2D image · 3D .glb via GlbViewer · playable audio · formatted text/config), alongside
 * the gate's verdict — so you can see where the evaluation is out of touch and needs
 * higher-quality prompting/gating.
 */
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Modal } from '@/components/ui/Modal';
import { fetchArtifacts } from '@/components/layout-lab/labArtifactClient';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { StepCell } from '@/lib/status/statusModel';

const GlbViewer = dynamic(() => import('@/components/layout-lab/steps/shared/GlbViewer').then((m) => m.GlbViewer), {
  ssr: false,
  loading: () => <div style={{ height: 260, display: 'grid', placeItems: 'center', fontSize: 12, opacity: 0.6 }}>Loading 3D viewer…</div>,
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
/** Config text = the data minus the heavy embedded-media fields. */
function configText(d: Data): string {
  const clone: Data = {};
  for (const [k, v] of Object.entries(d)) {
    if (k === 'genHistory' || k === 'audioAssets') continue;
    clone[k] = v;
  }
  return JSON.stringify(clone, null, 2);
}

function ProofPanel({ data }: { data: Data }) {
  const glb = glbUrlOf(data);
  if (glb) return (
    <div style={{ display: 'grid', gap: 6 }}>
      <GlbViewer url={glb} height={320} />
      <span style={{ fontSize: 12, fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)' }}>{glb}</span>
    </div>
  );
  const img = imageDataUrl(data);
  if (img) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="stored 2D output" src={img} style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 8, display: 'block', margin: '0 auto', background: 'rgb(11,13,18)' }} />
  );
  const audio = audioOf(data);
  if (audio) return (
    <div style={{ display: 'grid', gap: 12 }}>
      {audio.map((a, i) => (
        <div key={a.relPath ?? i} style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 13 }}>{a.text ?? a.filename ?? `clip ${i + 1}`}</span>
          <audio controls preload="none" style={{ width: '100%' }} src={`/api/audio-asset?relPath=${encodeURIComponent(a.relPath)}`} />
        </div>
      ))}
    </div>
  );
  return (
    <pre style={{ margin: 0, maxHeight: 420, overflow: 'auto', fontSize: 12, lineHeight: 1.5, fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-ink)', background: 'var(--lab-panel)', border: '1px solid var(--lab-line)', borderRadius: 8, padding: 12 }}>
      {configText(data)}
    </pre>
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
    <Modal open onClose={onClose} title={`${catalogId} · ${step}`} label={`Evidence for ${catalogId} ${step}`}>
      <div style={{ display: 'grid', gap: 14, minWidth: 'min(640px, 84vw)', maxWidth: 720 }}>
        {/* verdict header — compare this against the proof below */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <Badge>grade: {cell.grade}</Badge>
          <Badge>engine: {cell.engine}</Badge>
          {cell.tier && <Badge>{cell.tier}</Badge>}
          {proofKind && <Badge>proof: {proofKind}</Badge>}
        </div>
        {j ? (
          <div style={{ fontSize: 13, borderLeft: `3px solid ${j.verdict === 'pass' ? 'var(--lab-ok)' : 'var(--lab-warn)'}`, padding: '6px 10px', background: 'var(--lab-panel)' }}>
            <strong>{j.verdict.toUpperCase()} {j.score}/100</strong> <span style={{ color: 'var(--lab-muted)' }}>· {j.model}</span>
            <div style={{ marginTop: 4, color: 'var(--lab-ink)' }}>{j.findings}</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--lab-muted)' }}>
            No content-quality judgment{cell.judge ? ` — would need a ${cell.judge} judge` : ''}{cell.checkerMeaningful === false ? ' · checker is shape-only' : ''}.
            {cell.reason ? ` (${cell.reason})` : ''}
          </div>
        )}

        {/* entity switcher when the step has multiple seeded entities */}
        {arts && arts.length > 1 && (
          <label style={{ fontSize: 12, color: 'var(--lab-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
            entity
            <select value={idx} onChange={(e) => setIdx(Number(e.target.value))} style={{ fontSize: 12 }}>
              {arts.map((a, i) => <option key={a.entityId} value={i}>{a.entityId} ({a.status})</option>)}
            </select>
          </label>
        )}

        {/* the stored output the gate evaluated */}
        <div>
          {arts === null ? <div style={{ fontSize: 13, color: 'var(--lab-muted)' }}>Loading stored output…</div>
            : !art ? <div style={{ fontSize: 13, color: 'var(--lab-muted)' }}>No stored artifact for this step yet.</div>
              : <ProofPanel data={art.data as Data} />}
        </div>
      </div>
    </Modal>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 12, fontFamily: 'var(--lab-font-mono)', padding: '2px 8px', borderRadius: 999, background: 'var(--lab-panel)', border: '1px solid var(--lab-line)' }}>{children}</span>;
}
