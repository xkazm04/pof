import type { Dispatch, RefObject, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ChevronDown, ChevronRight, Filter, Clock } from 'lucide-react';
import { STATUS_NEUTRAL, ACCENT_CYAN, ACCENT_ORANGE, OPACITY_8, OPACITY_15 } from '@/lib/chart-colors';
import { ACCENT } from './constants';
import { fmtTime, truncate } from './helpers';
import { DirectionBadge, LevelIndicator } from './LogIndicators';
import type { SyncDirection, SyncLogEntry } from './types';

export function SyncLogSection({
  showLog,
  setShowLog,
  syncLog,
  setSyncLog,
  logFilter,
  setLogFilter,
  filteredLog,
  logEndRef,
}: {
  showLog: boolean;
  setShowLog: Dispatch<SetStateAction<boolean>>;
  syncLog: SyncLogEntry[];
  setSyncLog: Dispatch<SetStateAction<SyncLogEntry[]>>;
  logFilter: SyncDirection | 'all';
  setLogFilter: Dispatch<SetStateAction<SyncDirection | 'all'>>;
  filteredLog: SyncLogEntry[];
  logEndRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div>
      <button
        onClick={() => setShowLog(!showLog)}
        aria-expanded={showLog}
        aria-controls="bss-log-panel"
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
      >
        {showLog ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <Clock className="w-3.5 h-3.5" style={{ color: ACCENT }} />
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT }}>
          Sync Log
        </span>
        <span className="text-2xs text-text-muted">{syncLog.length} entries</span>
        {syncLog.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSyncLog([]);
            }}
            className="ml-auto p-0.5 rounded text-text-muted hover:text-text transition-colors"
            title="Clear log"
            aria-label="Clear sync log"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </button>
      <AnimatePresence>
        {showLog && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {/* Filter tabs */}
              <div className="flex items-center gap-1 mb-2">
                <Filter className="w-3 h-3 text-text-muted" />
                {(['all', 'outbound', 'inbound'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className="px-2 py-0.5 rounded text-2xs font-bold transition-colors"
                    style={{
                      color: logFilter === f ? (f === 'outbound' ? ACCENT_ORANGE : f === 'inbound' ? ACCENT_CYAN : ACCENT) : STATUS_NEUTRAL,
                      backgroundColor: logFilter === f ? `${f === 'outbound' ? ACCENT_ORANGE : f === 'inbound' ? ACCENT_CYAN : ACCENT}${OPACITY_15}` : 'transparent',
                    }}
                  >
                    {f === 'all' ? 'All' : f === 'outbound' ? 'Sent' : 'Received'}
                  </button>
                ))}
              </div>

              {/* Log entries */}
              <div
                className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5 rounded-lg p-1.5"
                style={{ backgroundColor: `var(--surface-deep, ${ACCENT}${OPACITY_8})` }}
              >
                {filteredLog.length === 0 && (
                  <p className="text-2xs text-text-muted text-center py-4">No sync events yet</p>
                )}
                {filteredLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-1.5 px-1.5 py-1 rounded text-2xs font-mono hover:bg-white/3 transition-colors"
                  >
                    <span className="text-text-muted/60 w-20 flex-shrink-0">{fmtTime(entry.ts)}</span>
                    <DirectionBadge direction={entry.direction} />
                    <LevelIndicator level={entry.level} />
                    <span
                      className="font-bold w-10 flex-shrink-0"
                      style={{ color: entry.direction === 'outbound' ? ACCENT_ORANGE : ACCENT_CYAN }}
                    >
                      {entry.category}
                    </span>
                    <span className="text-text truncate">{entry.message}</span>
                    {entry.detail && (
                      <span className="text-text-muted/60 truncate ml-auto">{truncate(entry.detail, 30)}</span>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
