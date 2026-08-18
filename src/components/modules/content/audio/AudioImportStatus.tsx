'use client';

import { CheckCircle2, CircleSlash, AlertTriangle } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { AudioImportResult } from '@/types/audio-import';
import { describeImport, type ImportState } from '@/lib/audio-import-status';

/**
 * What the DB actually recorded about this set's last "Import to UE".
 *
 * Colour is never the only signal (WCAG 1.4.1): every state carries its own
 * glyph AND its own word. `never` and `unverified` are visually distinct from
 * `imported` — a set nothing confirms must not read like a completed import.
 */
const ICON: Record<ImportState, typeof CheckCircle2> = {
  imported: CheckCircle2,
  unverified: AlertTriangle,
  never: CircleSlash,
};

const COLOR: Record<ImportState, string> = {
  imported: STATUS_SUCCESS,
  unverified: STATUS_WARNING,
  never: STATUS_NEUTRAL,
};

export function AudioImportStatus({ record }: { record: AudioImportResult | null }) {
  const view = describeImport(record);
  const Icon = ICON[view.state];
  return (
    <div
      className="flex items-start gap-1.5 px-3 py-1.5 border-b border-border bg-surface-deep/60"
      data-testid="audio-import-status"
      data-state={view.state}
    >
      <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: COLOR[view.state] }} aria-hidden />
      <div className="min-w-0">
        <span className="text-2xs font-semibold" style={{ color: COLOR[view.state] }}>
          {view.headline}
        </span>
        <span className="text-2xs text-text-muted"> — {view.detail}</span>
      </div>
    </div>
  );
}
