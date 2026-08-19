import type { Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChevronDown, ChevronRight } from 'lucide-react';
import { ACCENT_ORANGE } from '@/lib/chart-colors';
import type { PropertyWatchUpdate } from '@/types/ue5-bridge';
import { PropertyEditorRow } from './PropertyEditorRow';
import type { PropertyEdit } from './types';

export function PropertyWriteSection({
  showPropertyWrite,
  setShowPropertyWrite,
  watchEntries,
  handleWatchedPush,
  propEdit,
  setPropEdit,
  handleDirectPropertyPush,
}: {
  showPropertyWrite: boolean;
  setShowPropertyWrite: Dispatch<SetStateAction<boolean>>;
  watchEntries: [string, PropertyWatchUpdate][];
  handleWatchedPush: (objectPath: string, propertyName: string, value: unknown) => void;
  propEdit: PropertyEdit;
  setPropEdit: Dispatch<SetStateAction<PropertyEdit>>;
  handleDirectPropertyPush: () => void;
}) {
  return (
    <div>
      <button
        onClick={() => setShowPropertyWrite(!showPropertyWrite)}
        aria-expanded={showPropertyWrite}
        aria-controls="bss-property-write-panel"
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
      >
        {showPropertyWrite ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <Send className="w-3.5 h-3.5" style={{ color: ACCENT_ORANGE }} />
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT_ORANGE }}>
          Property Write-Back
        </span>
        <span className="text-2xs text-text-muted ml-1">{watchEntries.length} watched</span>
      </button>
      <AnimatePresence>
        {showPropertyWrite && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">
              {/* Watched properties with edit buttons */}
              {watchEntries.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                  {watchEntries.map(([watchId, update]) => (
                    <PropertyEditorRow
                      key={watchId}
                      objectPath={update.objectPath}
                      propertyName={update.propertyName}
                      currentValue={update.value}
                      onPush={handleWatchedPush}
                    />
                  ))}
                </div>
              )}

              {/* Direct property write form */}
              <div className="pt-2 border-t border-border/20">
                <div className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Direct Property Write</div>
                <div className="flex items-end gap-1.5">
                  <div className="flex-1">
                    <label htmlFor="bss-prop-object" className="text-2xs text-text-muted">Object Path</label>
                    <input
                      id="bss-prop-object"
                      type="text"
                      value={propEdit.objectPath}
                      onChange={(e) => setPropEdit((p) => ({ ...p, objectPath: e.target.value }))}
                      placeholder="/Game/BP_Player.BP_Player_C"
                      className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-subtle focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="w-28">
                    <label htmlFor="bss-prop-name" className="text-2xs text-text-muted">Property</label>
                    <input
                      id="bss-prop-name"
                      type="text"
                      value={propEdit.propertyName}
                      onChange={(e) => setPropEdit((p) => ({ ...p, propertyName: e.target.value }))}
                      placeholder="MaxHealth"
                      className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-subtle focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="w-28">
                    <label htmlFor="bss-prop-value" className="text-2xs text-text-muted">Value</label>
                    <input
                      id="bss-prop-value"
                      type="text"
                      value={propEdit.value}
                      onChange={(e) => setPropEdit((p) => ({ ...p, value: e.target.value }))}
                      placeholder="100"
                      className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-subtle focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <button
                    onClick={handleDirectPropertyPush}
                    disabled={!propEdit.objectPath.trim() || !propEdit.propertyName.trim()}
                    className="px-2.5 py-1 rounded text-xs font-bold border transition-colors disabled:opacity-40"
                    style={{ borderColor: `${ACCENT_ORANGE}40`, color: ACCENT_ORANGE }}
                    title="Push to UE5"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
