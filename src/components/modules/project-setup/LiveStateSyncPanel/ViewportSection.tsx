import { ChevronDown, ChevronRight, Camera } from 'lucide-react';
import { ACCENT_CYAN, OPACITY_8, OPACITY_15 } from '@/lib/chart-colors';
import type { UE5EditorSnapshot } from '@/types/ue5-bridge';
import { formatVec3, formatRot } from './helpers';

interface ViewportSectionProps {
  snapshot: UE5EditorSnapshot;
  showViewport: boolean;
  setShowViewport: (v: boolean) => void;
}

export function ViewportSection({ snapshot, showViewport, setShowViewport }: ViewportSectionProps) {
  return (
    <div>
      <button
        onClick={() => setShowViewport(!showViewport)}
        aria-expanded={showViewport}
        aria-controls="lss-viewport-panel"
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
      >
        {showViewport ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <Camera className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT_CYAN }}>
          Viewport
        </span>
        <span className="text-2xs text-text-muted ml-auto font-mono">
          {snapshot.viewport.viewMode}
        </span>
      </button>
      {showViewport && (
        <div id="lss-viewport-panel" role="region" aria-label="Viewport" className="px-4 pb-3 space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <div className="text-2xs font-bold text-text-muted uppercase tracking-wider">Camera Location</div>
              <div className="text-xs font-mono text-text">{formatVec3(snapshot.viewport.cameraLocation)}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xs font-bold text-text-muted uppercase tracking-wider">Camera Rotation</div>
              <div className="text-xs font-mono text-text">{formatRot(snapshot.viewport.cameraRotation)}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xs font-bold text-text-muted uppercase tracking-wider">FOV</div>
              <div className="text-xs font-mono text-text">{snapshot.viewport.fov.toFixed(1)}&deg;</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xs font-bold text-text-muted uppercase tracking-wider">Level</div>
              <div className="text-xs font-mono text-text truncate">{snapshot.openLevel || '—'}</div>
            </div>
          </div>

          {/* Mini viewport position dot */}
          <div
            className="relative w-full h-16 rounded-lg overflow-hidden"
            style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_8}`, border: `1px solid ${ACCENT_CYAN}${OPACITY_15}` }}
          >
            <svg viewBox="0 0 200 60" className="w-full h-full">
              {/* Grid */}
              {[0, 50, 100, 150, 200].map((x) => (
                <line key={`gx-${x}`} x1={x} y1={0} x2={x} y2={60} stroke={`${ACCENT_CYAN}15`} strokeWidth={0.5} />
              ))}
              {[0, 20, 40, 60].map((y) => (
                <line key={`gy-${y}`} x1={0} y1={y} x2={200} y2={y} stroke={`${ACCENT_CYAN}15`} strokeWidth={0.5} />
              ))}
              {/* Camera position dot */}
              {(() => {
                // Normalize to a reasonable range (±50000 UU)
                const nx = ((snapshot.viewport.cameraLocation.x + 50000) / 100000) * 200;
                const ny = ((snapshot.viewport.cameraLocation.y + 50000) / 100000) * 60;
                const clampX = Math.max(4, Math.min(196, nx));
                const clampY = Math.max(4, Math.min(56, ny));
                return (
                  <>
                    <circle cx={clampX} cy={clampY} r={6} fill={`${ACCENT_CYAN}20`} />
                    <circle cx={clampX} cy={clampY} r={3} fill={ACCENT_CYAN} />
                    {/* Yaw direction indicator */}
                    <line
                      x1={clampX}
                      y1={clampY}
                      x2={clampX + Math.cos((snapshot.viewport.cameraRotation.yaw * Math.PI) / 180) * 10}
                      y2={clampY + Math.sin((snapshot.viewport.cameraRotation.yaw * Math.PI) / 180) * 10}
                      stroke={ACCENT_CYAN}
                      strokeWidth={1.5}
                    />
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
