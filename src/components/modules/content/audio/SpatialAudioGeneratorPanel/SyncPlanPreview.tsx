'use client';

import type { LevelAudioSyncRow, LevelAudioSyncStatus } from '@/types/audio-scene';
import {
  STATUS_SUCCESS, STATUS_INFO, STATUS_WARNING, STATUS_NEUTRAL, STATUS_STALE,
  withOpacity, OPACITY_10, OPACITY_30,
} from '@/lib/chart-colors';
import type { SyncPreview } from './types';

const STATUS_META: Record<LevelAudioSyncStatus, { label: string; color: string }> = {
  new: { label: 'new', color: STATUS_SUCCESS },
  updated: { label: 'updated', color: STATUS_INFO },
  kept: { label: 'kept', color: STATUS_WARNING },
  orphaned: { label: 'orphaned', color: STATUS_STALE },
  unchanged: { label: 'unchanged', color: STATUS_NEUTRAL },
};

/** "+3 new, 1 updated, 2 kept (hand-tuned: reverbPreset), 1 orphaned, 0 unchanged" */
export function syncSummaryLine(preview: Pick<SyncPreview, 'rows' | 'summary'>): string {
  const s = preview.summary;
  const tuned = [...new Set(preview.rows.filter((r) => r.status === 'kept').flatMap((r) => r.fields))];
  const kept = `${s.kept} kept${tuned.length ? ` (hand-tuned: ${tuned.join(', ')})` : ''}`;
  return `+${s.new} new, ${s.updated} updated, ${kept}, ${s.orphaned} orphaned, ${s.unchanged} unchanged`;
}

function rowDetail(row: LevelAudioSyncRow, overwriting: boolean): string {
  switch (row.status) {
    case 'new': return 'zone and emitters will be added';
    case 'updated':
      if (overwriting) return `hand-tuning will be reset to the level${row.fields.length ? `: ${row.fields.join(', ')}` : ''}`;
      return row.fields.length ? `level changed: ${row.fields.join(', ')}` : 'emitters follow the level';
    case 'kept': return `hand-tuned: ${row.fields.join(', ')} — left as is`;
    case 'orphaned': return 'room is no longer in the level — zone left in place, delete it by hand if unwanted';
    case 'unchanged': return row.keptEmitters.length ? `in sync; tuned emitters kept: ${row.keptEmitters.join(', ')}` : 'in sync';
  }
}

/**
 * The level -> audio plan BEFORE it is written: one row per room with what
 * applying would do. Hand-tuned rooms offer an explicit per-room overwrite.
 */
export function SyncPlanPreview({
  preview,
  overwrite,
  onToggleOverwrite,
}: {
  preview: SyncPreview;
  overwrite: ReadonlySet<string>;
  onToggleOverwrite: (roomId: string) => void;
}) {
  return (
    <div className="space-y-2" data-testid="sync-plan-preview">
      <p className="text-xs font-semibold text-text">{syncSummaryLine(preview)}</p>
      <p className="text-2xs font-mono text-text-muted">
        {preview.ops.length} change{preview.ops.length === 1 ? '' : 's'} to write
        {preview.targetSceneId === null ? ` · new scene, reverb ${preview.suggestedGlobalReverb}` : ' · scene reverb kept'}
      </p>
      <ul className="space-y-1.5">
        {preview.rows.map((row) => {
          const meta = STATUS_META[row.status];
          const overwriting = overwrite.has(row.roomId);
          return (
            <li
              key={`${row.status}-${row.roomId}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-surface-deep text-xs"
            >
              <span
                className="px-1.5 py-0.5 rounded text-2xs font-mono border flex-shrink-0"
                style={{ color: meta.color, backgroundColor: withOpacity(meta.color, OPACITY_10), borderColor: withOpacity(meta.color, OPACITY_30) }}
              >
                {meta.label}
              </span>
              <span className="font-semibold text-text flex-shrink-0">{row.roomName}</span>
              <span className="text-text-muted truncate flex-1">{rowDetail(row, overwriting)}</span>
              {/* An overwritten room re-plans as 'updated': keep its toggle so it can be undone. */}
              {(row.status === 'kept' || overwriting) && (
                <label className="flex items-center gap-1.5 text-2xs text-text-muted cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={overwriting}
                    onChange={() => onToggleOverwrite(row.roomId)}
                    className="w-3.5 h-3.5 rounded border-border bg-surface-deep focus-ring outline-none"
                  />
                  overwrite
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
