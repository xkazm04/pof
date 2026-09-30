import type { Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import {
  STATUS_ERROR, ACCENT_CYAN, ACCENT_ORANGE,
  OPACITY_8, OPACITY_15,
} from '@/lib/chart-colors';
import { truncate } from './helpers';
import type { SyncConflict } from './types';

/** A ledger value as a short literal ('—' when the side was never known). */
function show(v: unknown): string {
  return v === undefined ? '—' : truncate(JSON.stringify(v) ?? String(v), 20);
}

/**
 * Diverged writes only: UE's read-back after our write is neither the value it
 * had when we wrote (base) nor the value we sent. A read-back equal to what we
 * sent is convergence and never shows here.
 */
export function ConflictSection({
  showConflicts,
  setShowConflicts,
  conflicts,
}: {
  showConflicts: boolean;
  setShowConflicts: Dispatch<SetStateAction<boolean>>;
  conflicts: SyncConflict[];
}) {
  return (
    <div>
      <button
        onClick={() => setShowConflicts(!showConflicts)}
        aria-expanded={showConflicts}
        aria-controls="bss-conflicts-panel"
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
      >
        {showConflicts ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <AlertTriangle className="w-3.5 h-3.5" style={{ color: STATUS_ERROR }} />
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: STATUS_ERROR }}>
          Sync Conflicts
        </span>
        <span
          className="text-2xs font-mono px-1.5 py-0.5 rounded"
          style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_15}` }}
        >
          {conflicts.length}
        </span>
      </button>
      <AnimatePresence>
        {showConflicts && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1">
              {conflicts.map((c) => (
                <div
                  key={c.key}
                  data-testid={`sync-conflict-${c.key}`}
                  className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-lg border text-xs"
                  style={{ borderColor: `${STATUS_ERROR}30`, backgroundColor: `${STATUS_ERROR}${OPACITY_8}` }}
                >
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} />
                  <span className="font-mono font-bold text-text">{c.propertyName}</span>
                  <span className="font-mono text-2xs text-text-muted truncate max-w-[12rem]" title={c.objectPath}>
                    {c.objectPath}
                  </span>
                  <span className="font-mono text-2xs">
                    Base: <span className="text-text" data-testid="sync-conflict-base">{show(c.base)}</span>
                  </span>
                  <span className="font-mono text-2xs">
                    Sent: <span style={{ color: ACCENT_ORANGE }} data-testid="sync-conflict-written">{show(c.written)}</span>
                  </span>
                  <span className="font-mono text-2xs">
                    UE5: <span style={{ color: ACCENT_CYAN }} data-testid="sync-conflict-inbound">{show(c.inbound)}</span>
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
