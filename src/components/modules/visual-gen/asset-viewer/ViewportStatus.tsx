'use client';

import { STATUS_ERROR } from '@/lib/chart-colors';
import type { ViewerLoadState } from './loadStatus';

/**
 * The ONE in-viewport load/error overlay, rendered by `SceneViewer` so both consumers
 * (`/3d` `Studio3D` and the `asset-viewer` module tab) get it from the same source — no
 * second hand-rolled fallback. The shared pipeline-step viewer
 * (`layout-lab/steps/shared/GlbViewer.tsx`) keeps its own boundary; it is a different
 * component with a different loader (suspense `useGLTF`), and is deliberately NOT forked
 * here.
 *
 * Sits OUTSIDE the r3f `<Canvas>` so it is plain DOM: testable in jsdom, and legible even
 * when the GL context itself is what failed.
 *
 * Lab tokens first with an app-token fallback — the same component renders inside the
 * Blueprint-themed `/3d` studio (`--lab-*` defined) and inside the dark module shell
 * (only the app tokens defined).
 */
export interface ViewportStatusProps {
  loadState: ViewerLoadState;
  loadError: string | null;
  modelName: string | null;
  modelUrl: string | null;
}

const shell = {
  position: 'absolute' as const,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none' as const,
  padding: 16,
  textAlign: 'center' as const,
  fontFamily: 'var(--lab-font-mono, var(--font-mono, monospace))',
  fontSize: 'var(--lab-fs-xs, var(--text-xs))',
  lineHeight: 1.7,
};

export function ViewportStatus({ loadState, loadError, modelName, modelUrl }: ViewportStatusProps) {
  if (loadState !== 'loading' && loadState !== 'error') return null;

  const label = modelName ?? modelUrl ?? 'this mesh';

  if (loadState === 'loading') {
    return (
      <div data-testid="viewport-status" data-state="loading" role="status" aria-live="polite" style={shell}>
        <div style={{ color: 'var(--lab-muted, var(--text-muted))' }}>
          <div>Loading {label}…</div>
          {/* Generated meshes run to tens of MB (median 42.3 MB on tripo3d), so this
              window is seconds long — the blank canvas underneath is not the asset. */}
          <div style={{ opacity: 0.8 }}>large generated meshes can take several seconds</div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="viewport-status" data-state="error" role="alert" style={shell}>
      <div style={{ color: `var(--lab-bad, ${STATUS_ERROR})`, maxWidth: 460, overflowWrap: 'anywhere' }}>
        <div>Could not load this mesh.</div>
        {modelUrl && (
          <div style={{ color: 'var(--lab-muted, var(--text-muted))' }}>{modelUrl}</div>
        )}
        <div style={{ color: 'var(--lab-muted, var(--text-muted))' }}>
          {loadError ?? 'no reason was reported'}
        </div>
      </div>
    </div>
  );
}
