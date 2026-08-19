'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, XCircle, Ban, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { BuildRecord } from '@/lib/packaging/build-history-store';
import { platformLabel } from '@/lib/packaging/build-profiles';
import {
  MODULE_COLORS, ACCENT_VIOLET, statusBg, withOpacity, OPACITY_80,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
} from '@/lib/chart-colors';
import { formatBytes, formatDuration } from '@/lib/format';

export function BuildRow({ build, onDelete }: { build: BuildRecord; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full grid grid-cols-[auto_1fr_80px_80px_80px_60px_auto] gap-2 items-center px-2 py-1.5 text-left hover:bg-surface-hover/30 transition-colors text-xs"
      >
        {expanded
          ? <ChevronDown className="w-2.5 h-2.5 text-text-muted" />
          : <ChevronRight className="w-2.5 h-2.5 text-text-muted" />
        }

        <div className="flex items-center gap-1.5 min-w-0">
          {build.status === 'success' ? (
            <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_SUCCESS }} aria-label="Build succeeded" />
          ) : build.status === 'failed' ? (
            <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} aria-label="Build failed" />
          ) : (
            // The third arm of a 'success' | 'failed' | 'cancelled' union — there is
            // no in-progress state in build_history, every row is terminal. This used
            // to render a clock labelled "Build in progress", so an aborted cook read
            // as still running FOREVER.
            <Ban className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_WARNING }} aria-label="Build cancelled" />
          )}
          <span className="text-text-muted font-mono truncate">
            #{build.id}
          </span>
          {build.status === 'cancelled' && (
            // Glyph AND word — the icon alone left an aborted cook indistinguishable
            // from a running one at a glance.
            <span
              className="text-2xs px-1 py-px rounded font-medium uppercase tracking-wide"
              style={{ backgroundColor: statusBg(STATUS_WARNING, 0.12), color: STATUS_WARNING }}
            >
              cancelled
            </span>
          )}
          {build.version && (
            <span className="text-2xs px-1 py-px rounded font-mono" style={{ backgroundColor: statusBg(MODULE_COLORS.systems, 0.12), color: ACCENT_VIOLET }}>
              v{build.version}
            </span>
          )}
        </div>

        <span className="text-text-muted font-mono">{platformLabel(build.platform)}</span>
        <span className="text-text-muted">{build.config}</span>
        <span className="text-text-muted font-mono">{build.sizeBytes != null ? formatBytes(build.sizeBytes) : '-'}</span>
        <span className="text-text-muted font-mono">{build.durationMs != null ? formatDuration(build.durationMs) : '-'}</span>

        <span className="text-2xs text-text-muted">
          {new Date(build.createdAt).toLocaleDateString()}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              {build.outputPath && (
                <div>
                  <span className="text-text-muted">Output: </span>
                  <span
                    data-testid={`pof-module-packaging-exe-path-${build.id}`}
                    className="text-text-muted font-mono break-all"
                  >
                    {build.outputPath}
                  </span>
                </div>
              )}
              {build.cookTimeMs != null && (
                <div>
                  <span className="text-text-muted">Cook time: </span>
                  <span className="text-text-muted font-mono">{formatDuration(build.cookTimeMs)}</span>
                </div>
              )}
              {(build.warningCount > 0 || build.errorCount > 0) && (
                <div className="flex items-center gap-2">
                  {build.errorCount > 0 && (
                    <span style={{ color: STATUS_ERROR }}>{build.errorCount} error{build.errorCount !== 1 ? 's' : ''}</span>
                  )}
                  {build.warningCount > 0 && (
                    <span style={{ color: STATUS_WARNING }}>{build.warningCount} warning{build.warningCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
              )}
              {build.errorSummary && (
                <div className="col-span-2">
                  <span className="text-text-muted">Error: </span>
                  <span className="font-mono" style={{ color: withOpacity(STATUS_ERROR, OPACITY_80) }}>{build.errorSummary}</span>
                </div>
              )}
              {build.notes && (
                <div className="col-span-2">
                  <span className="text-text-muted">Notes: </span>
                  <span className="text-text-muted">{build.notes}</span>
                </div>
              )}
              <div className="col-span-2 pt-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(build.id); }}
                  className="flex items-center gap-1 text-2xs opacity-60 hover:opacity-100 transition-opacity"
                  style={{ color: STATUS_ERROR }}
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
