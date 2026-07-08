import { SURFACE_LABELS, SURFACE_COLORS } from './constants';
import type { AnalyzedProperties } from './types';

export function AnalysisMiniPreview({ analysis }: { analysis: AnalyzedProperties }) {
  return (
    <div className="space-y-2 w-full">
      {/* Color swatches */}
      <div className="flex gap-1 justify-center">
        {analysis.colorPalette.slice(0, 5).map((c, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded border border-border"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      {/* Properties */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-2xs">
        <div className="flex justify-between">
          <span className="text-text-muted">Rough</span>
          <span className="font-mono text-text">{analysis.roughness.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Metal</span>
          <span className="font-mono text-text">{analysis.metallic.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Emissive</span>
          <span className="font-mono text-text">{analysis.emissiveIntensity.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">SSS</span>
          <span className="font-mono text-text">{analysis.subsurfacePresence.toFixed(2)}</span>
        </div>
      </div>
      <div className="text-center">
        <span
          className="px-2 py-0.5 rounded text-2xs font-semibold"
          style={{
            backgroundColor: `${SURFACE_COLORS[analysis.surfaceType]}15`,
            color: SURFACE_COLORS[analysis.surfaceType],
          }}
        >
          {SURFACE_LABELS[analysis.surfaceType]}
        </span>
      </div>
    </div>
  );
}
