import type { Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, MapPin, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { ACCENT_CYAN, OPACITY_8 } from '@/lib/chart-colors';
import type { UE5EditorSnapshot } from '@/types/ue5-bridge';
import type { ViewportTarget } from './types';

export function ViewportTeleportSection({
  showViewportTeleport,
  setShowViewportTeleport,
  viewTarget,
  setViewTarget,
  handleViewportPush,
  handleCopyFromSnapshot,
  snapshot,
}: {
  showViewportTeleport: boolean;
  setShowViewportTeleport: Dispatch<SetStateAction<boolean>>;
  viewTarget: ViewportTarget;
  setViewTarget: Dispatch<SetStateAction<ViewportTarget>>;
  handleViewportPush: () => void;
  handleCopyFromSnapshot: () => void;
  snapshot: UE5EditorSnapshot | null;
}) {
  return (
    <div>
      <button
        onClick={() => setShowViewportTeleport(!showViewportTeleport)}
        aria-expanded={showViewportTeleport}
        aria-controls="bss-viewport-panel"
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
      >
        {showViewportTeleport ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <Camera className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT_CYAN }}>
          Viewport Teleport
        </span>
      </button>
      <AnimatePresence>
        {showViewportTeleport && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <div key={axis}>
                    <label className="text-2xs font-bold text-text-muted uppercase">{axis}</label>
                    <input
                      type="number"
                      value={viewTarget[axis]}
                      onChange={(e) => setViewTarget((v) => ({ ...v, [axis]: e.target.value }))}
                      className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['pitch', 'yaw', 'roll'] as const).map((r) => (
                  <div key={r}>
                    <label className="text-2xs font-bold text-text-muted uppercase">{r}</label>
                    <input
                      type="number"
                      value={viewTarget[r]}
                      onChange={(e) => setViewTarget((v) => ({ ...v, [r]: e.target.value }))}
                      className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-2xs font-bold text-text-muted uppercase">FOV</label>
                  <input
                    type="number"
                    value={viewTarget.fov}
                    onChange={(e) => setViewTarget((v) => ({ ...v, fov: e.target.value }))}
                    className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleViewportPush}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors"
                  style={{ borderColor: `${ACCENT_CYAN}40`, backgroundColor: `${ACCENT_CYAN}${OPACITY_8}`, color: ACCENT_CYAN }}
                >
                  <MapPin className="w-3 h-3" /> Teleport Camera
                </button>
                <button
                  onClick={handleCopyFromSnapshot}
                  disabled={!snapshot?.viewport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-border/30 text-text-muted hover:text-text transition-colors disabled:opacity-40"
                >
                  <Copy className="w-3 h-3" /> Copy Current
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
