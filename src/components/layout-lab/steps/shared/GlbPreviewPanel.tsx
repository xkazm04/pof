'use client';

import dynamic from 'next/dynamic';
import type { LabTheme } from '../../theme';

// three/r3f is client + WebGL only — load the .glb viewer lazily so it never hits SSR
// and only pulls the 3D bundle for steps that actually render a mesh.
const GlbViewer = dynamic(() => import('./GlbViewer').then((m) => m.GlbViewer), {
  ssr: false,
  loading: () => <div style={{ height: 260, display: 'grid', placeItems: 'center', fontSize: 12, opacity: 0.6 }}>Loading 3D viewer…</div>,
});

/** Panel label for the shared 3D preview — single-sourced so callers stay consistent. */
export const GLB_PREVIEW_LABEL = '3D preview (orbit / zoom)';

/**
 * The interactive `.glb` preview block — the GlbViewer plus its served-URL caption —
 * used identically by ArchetypeStep's gallery (selected candidate's `payload.glbUrl`)
 * and its non-gallery data (`data.glbUrl`). Extracted so the block lives in ONE place.
 */
export function GlbPreviewPanel({ t, url }: { t: LabTheme; url: string }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <GlbViewer url={url} />
      <span className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>{url}</span>
    </div>
  );
}
