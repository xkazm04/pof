'use client';

import { useMemo } from 'react';
import { History, Undo2 } from 'lucide-react';
import { runDiagnostics, type DiagnosticsReport, type ProbeConfig } from '@/lib/bridge-doctor/probes';
import { CHANNEL_META } from '@/lib/bridge-doctor/remediation';
import {
  useBridgeDoctorStore,
  type KnownGoodConfig,
  type RestoreSetters,
} from '@/stores/bridgeDoctorStore';
import { describeChange, diffConfig, editorSideChannels, implicatedChannels } from './restorePlan';

const BTN =
  'focus-ring inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Preview -> apply -> verify -> undo for the last-known-good config.
 * "Test last good" probes the remembered config without touching settings.
 */
export function RestorePanel({
  cfg,
  good,
  latest,
  running,
  setters,
  onApplied,
}: {
  cfg: ProbeConfig;
  good: KnownGoodConfig | null;
  latest: DiagnosticsReport | null;
  running: boolean;
  setters: RestoreSetters;
  /** Called after Apply/Undo so the caller can re-verify against the live settings. */
  onApplied: () => void;
}) {
  const phase = useBridgeDoctorStore((s) => s.restorePhase);
  const preview = useBridgeDoctorStore((s) => s.restorePreview);
  const undoSnapshot = useBridgeDoctorStore((s) => s.undoSnapshot);
  const previewRestore = useBridgeDoctorStore((s) => s.previewRestore);
  const applyRestore = useBridgeDoctorStore((s) => s.applyRestore);
  const undoRestore = useBridgeDoctorStore((s) => s.undoRestore);

  const diff = useMemo(() => (good ? diffConfig(cfg, good) : []), [cfg, good]);
  const drift = implicatedChannels(latest, diff);
  const editorSide = editorSideChannels(latest, diff);
  const label = (ids: string[]) => ids.map((id) => CHANNEL_META[id as keyof typeof CHANNEL_META].label).join(', ');

  if (!good || (diff.length === 0 && !undoSnapshot)) return null;

  const live = {
    host: cfg.host,
    pofPort: cfg.pofPort,
    rcPort: cfg.rcPort,
    wsPort: cfg.wsPort,
    authToken: cfg.authToken ?? '',
  };
  const stillFailing = preview?.verdict === 'still-failing';

  return (
    <div className="relative z-10 px-3 py-2 text-[12px] text-text border-b border-cyan-500/10" data-testid="restore-panel">
      {diff.length > 0 && (
        <>
          <div className="text-text-muted">Differs from last good config:</div>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {diff.map((c) => (
              <li key={c.field} className="font-mono text-[11px] bg-black/30 rounded px-1.5 py-0.5">
                {describeChange(c)}
              </li>
            ))}
          </ul>
          {drift.length > 0 && <p className="mt-1 text-text-muted">Likely settings drift: {label(drift)}.</p>}
          {editorSide.length > 0 && (
            <p className="mt-1 text-text-muted">Not explained by settings (editor side): {label(editorSide)}.</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={running || phase === 'previewing'}
              onClick={() => void previewRestore(live, runDiagnostics)}
              className={`${BTN} bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
            >
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              {phase === 'previewing' ? 'Testing…' : 'Test last good'}
            </button>
            {preview && (
              <span role="status" aria-live="polite">
                {preview.verdict === 'would-fix'
                  ? 'Would fix: all 3 channels green with the last good config.'
                  : `Still failing with the last good config: ${label(preview.channels)}.`}
              </span>
            )}
            {preview && phase === 'previewed' && (
              <button
                type="button"
                disabled={running}
                onClick={() => {
                  if (applyRestore(live, setters, stillFailing)) onApplied();
                }}
                className={`${BTN} bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20`}
              >
                {stillFailing ? 'Apply anyway' : 'Apply'}
              </button>
            )}
          </div>
        </>
      )}
      {undoSnapshot && (
        <div className="mt-1 flex items-center gap-2">
          <span className="text-text-muted">Restored last good config.</span>
          <button
            type="button"
            onClick={() => {
              if (undoRestore(setters)) onApplied();
            }}
            className={`${BTN} bg-white/5 text-text hover:bg-white/10`}
          >
            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
