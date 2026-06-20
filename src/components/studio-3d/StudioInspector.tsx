'use client';

import { Rail } from '@/components/layout-lab/ui/Rail';
import { Stat } from '@/components/layout-lab/ui/Stat';
import { useViewerStore } from '@/components/modules/visual-gen/asset-viewer/useViewerStore';
import { formatNumber, formatMeters } from '@/components/modules/visual-gen/asset-viewer/assetStats';

const mono = { fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)' } as const;

/** Blueprint inspector for /3d — Stat tiles over the loaded mesh's geometry stats. */
export function StudioInspector({ modelName }: { modelName: string | null }) {
  const stats = useViewerStore((s) => s.stats);
  return (
    <Rail title="Inspector" style={{ width: 280, flexShrink: 0, borderRight: 'none', borderLeft: '1px solid var(--lab-line)' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--lab-s4)', display: 'flex', flexDirection: 'column', gap: 'var(--lab-s3)' }}>
        {!stats ? (
          <p style={{ ...mono, color: 'var(--lab-muted)', lineHeight: 1.6 }}>
            Load a model to inspect its geometry — triangles, vertices, materials, textures, and bounds.
          </p>
        ) : (
          <>
            <div style={{ ...mono, color: 'var(--lab-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={modelName ?? undefined}>
              {modelName ?? 'Unnamed asset'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--lab-s2)' }}>
              <Stat label="Triangles" value={formatNumber(stats.triangles)} accent />
              <Stat label="Vertices" value={formatNumber(stats.vertices)} />
              <Stat label="Meshes" value={String(stats.meshes)} />
              <Stat label="Draw Calls" value={String(stats.drawCalls)} />
              <Stat label="Materials" value={String(stats.materials.length)} />
              <Stat label="Textures" value={String(stats.textures.length)} />
            </div>
            <div>
              <div style={{ ...mono, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--lab-muted)', marginBottom: 'var(--lab-s2)' }}>
                Bounding Box (m)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--lab-s2)' }}>
                <Stat label="W" value={formatMeters(stats.boundingBox.width)} />
                <Stat label="H" value={formatMeters(stats.boundingBox.height)} />
                <Stat label="D" value={formatMeters(stats.boundingBox.depth)} />
              </div>
            </div>
          </>
        )}
      </div>
    </Rail>
  );
}
