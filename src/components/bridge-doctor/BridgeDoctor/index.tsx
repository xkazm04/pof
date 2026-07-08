'use client';

/**
 * BridgeDoctor
 *
 * Diagnostic panel for the three UE bridge channels. Probes each channel
 * independently, classifies failures, and presents a plain-language fix.
 *
 * The Doctor is also where the app remembers the "last-known-good" connection
 * config and offers one-click restore when the live ports/auth drift away.
 */

import { useCallback, useMemo } from 'react';
import {
  Activity,
  History,
  RefreshCw,
  Stethoscope,
} from 'lucide-react';
import {
  ACCENT_CYAN,
} from '@/lib/chart-colors';
import { UI_TIMEOUTS } from '@/lib/constants';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { useBridgeDoctorStore } from '@/stores/bridgeDoctorStore';
import {
  runDiagnostics,
  type ProbeConfig,
} from '@/lib/bridge-doctor/probes';
import { CHANNEL_ORDER } from './constants';
import { parseIntOr, configMatches, formatRelative } from './helpers';
import { OverallPill, SettingInput } from './parts';
import { ChannelRow } from './ChannelRow';

interface BridgeDoctorProps {
  /** Optional className on the outermost container. */
  className?: string;
  /** Auto-run a diagnostic on mount. */
  autoRun?: boolean;
}

export function BridgeDoctor({ className = '', autoRun = false }: BridgeDoctorProps) {
  const host = useUE5BridgeStore((s) => s.host);
  const setHost = useUE5BridgeStore((s) => s.setHost);
  const wsPort = useUE5BridgeStore((s) => s.wsPort);
  const setWsPort = useUE5BridgeStore((s) => s.setWsPort);
  const rcPort = useUE5BridgeStore((s) => s.httpPort);
  const setRcPort = useUE5BridgeStore((s) => s.setHttpPort);
  const pofPort = usePofBridgeStore((s) => s.pofPort);
  const setPofPort = usePofBridgeStore((s) => s.setPofPort);
  const pofAuthToken = usePofBridgeStore((s) => s.pofAuthToken);
  const setPofAuthToken = usePofBridgeStore((s) => s.setPofAuthToken);

  const running = useBridgeDoctorStore((s) => s.running);
  const latest = useBridgeDoctorStore((s) => s.latest);
  const lastKnownGood = useBridgeDoctorStore((s) => s.lastKnownGood);
  const beginRun = useBridgeDoctorStore((s) => s.beginRun);
  const endRun = useBridgeDoctorStore((s) => s.endRun);

  const cfg: ProbeConfig = useMemo(
    () => ({
      host,
      pofPort,
      rcPort,
      wsPort,
      authToken: pofAuthToken || undefined,
    }),
    [host, pofPort, rcPort, wsPort, pofAuthToken],
  );

  const handleRun = useCallback(async () => {
    if (useBridgeDoctorStore.getState().running) return;
    beginRun();
    const report = await runDiagnostics(cfg);
    endRun(report);
  }, [cfg, beginRun, endRun]);

  // Optional auto-run on mount. Guarded against the React 18 dev-mode double effect by
  // checking `running` and `latest` before kicking off.
  useMemo(() => {
    if (!autoRun) return;
    if (running || latest) return;
    handleRun().catch(() => {
      /* errors surfaced via report; this guards against unhandled-rejection */
    });
  }, [autoRun, running, latest, handleRun]);

  const handleRestore = useCallback(() => {
    if (!lastKnownGood) return;
    setHost(lastKnownGood.host);
    setPofPort(lastKnownGood.pofPort);
    setRcPort(lastKnownGood.rcPort);
    setWsPort(lastKnownGood.wsPort);
    setPofAuthToken(lastKnownGood.authToken);
  }, [lastKnownGood, setHost, setPofPort, setRcPort, setWsPort, setPofAuthToken]);

  const canRestore = !!lastKnownGood && !configMatches(cfg, lastKnownGood);

  return (
    <section
      role="region"
      aria-label="Bridge Doctor — UE5 connection diagnostics"
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{
        backgroundColor: 'var(--surface-card)',
        border: `1px solid ${ACCENT_CYAN}30`,
        boxShadow: `0 10px 20px -10px rgba(0,0,0,0.5), inset 0 0 10px -5px ${ACCENT_CYAN}1f`,
      }}
    >
      <div
        aria-hidden="true"
        className="absolute -top-10 -right-10 w-32 h-32 blur-3xl rounded-full pointer-events-none opacity-40"
        style={{ backgroundColor: `${ACCENT_CYAN}30` }}
      />

      {/* Header */}
      <header
        className="relative z-10 flex items-center justify-between gap-3 px-3 py-2"
        style={{ borderBottom: `1px solid ${ACCENT_CYAN}1a` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Stethoscope className="w-4 h-4 text-text-muted" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text leading-tight">Bridge Doctor</h3>
          {latest && <OverallPill report={latest} />}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canRestore && (
            <button
              type="button"
              onClick={handleRestore}
              title={`Restore last-known-good config from ${formatRelative(lastKnownGood!.capturedAt)}`}
              className="focus-ring inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold transition-colors bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            >
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              Restore last good
            </button>
          )}
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            aria-label="Run bridge diagnostics"
            className="focus-ring inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold transition-colors bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Probing…
              </>
            ) : (
              <>
                <Activity className="w-3.5 h-3.5" aria-hidden="true" /> Run diagnostics
              </>
            )}
          </button>
        </div>
      </header>

      {/* Settings strip */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-2 px-3 py-2 text-[12px]" style={{ borderBottom: `1px solid ${ACCENT_CYAN}1a` }}>
        <SettingInput label="Host" value={host} onChange={setHost} ariaLabel="UE host" />
        <SettingInput
          label="PoF Bridge port"
          value={String(pofPort)}
          onChange={(v) => setPofPort(parseIntOr(v, pofPort))}
          ariaLabel="PoF Bridge port"
          inputMode="numeric"
        />
        <SettingInput
          label="Remote Control port"
          value={String(rcPort)}
          onChange={(v) => setRcPort(parseIntOr(v, rcPort))}
          ariaLabel="Remote Control port"
          inputMode="numeric"
        />
        <SettingInput
          label="WebSocket port"
          value={String(wsPort)}
          onChange={(v) => setWsPort(parseIntOr(v, wsPort))}
          ariaLabel="WebSocket port"
          inputMode="numeric"
        />
        <SettingInput
          label="PoF auth token"
          value={pofAuthToken}
          onChange={setPofAuthToken}
          ariaLabel="PoF Bridge auth token"
          placeholder="optional"
        />
      </div>

      {/* Channel rows */}
      <ul className="relative z-10 flex flex-col" aria-busy={running}>
        {CHANNEL_ORDER.map((id) => (
          <ChannelRow
            key={id}
            id={id}
            result={latest?.channels[id] ?? null}
            running={running}
            cfg={cfg}
          />
        ))}
      </ul>

      {/* Last run timestamp / no-run hint */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-3 py-2 text-[11px] text-text-muted">
        <span>
          {latest
            ? `Last run ${formatRelative(latest.finishedAt)}`
            : 'No diagnostics yet — press "Run diagnostics" to probe each channel.'}
        </span>
        <span title={`Per-probe timeout ${UI_TIMEOUTS.pofHttpTimeout > 0 ? '' : ''}`}>
          PoF Bridge {pofPort} · Remote Control {rcPort} · WS {wsPort}
        </span>
      </div>
    </section>
  );
}
