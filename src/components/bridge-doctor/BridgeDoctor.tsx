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

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  History,
  RefreshCw,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import {
  STATUS_SUCCESS,
  STATUS_ERROR,
  STATUS_NEUTRAL,
  ACCENT_ORANGE,
  ACCENT_CYAN,
} from '@/lib/chart-colors';
import { UI_TIMEOUTS } from '@/lib/constants';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { useBridgeDoctorStore } from '@/stores/bridgeDoctorStore';
import {
  runDiagnostics,
  type ChannelId,
  type ProbeConfig,
  type ProbeResult,
} from '@/lib/bridge-doctor/probes';
import {
  CHANNEL_META,
  remediationFor,
  type RemediationStep,
} from '@/lib/bridge-doctor/remediation';

const CHANNEL_ORDER: ChannelId[] = ['pof-bridge', 'remote-control', 'ws-live-state'];

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

// ── Channel row ─────────────────────────────────────────────────────────────

function ChannelRow({
  id,
  result,
  running,
  cfg,
}: {
  id: ChannelId;
  result: ProbeResult | null;
  running: boolean;
  cfg: ProbeConfig;
}) {
  const meta = CHANNEL_META[id];
  const port = id === 'pof-bridge' ? cfg.pofPort : id === 'remote-control' ? cfg.rcPort : cfg.wsPort;
  const remediation = result ? remediationFor(result) : null;
  const [expanded, setExpanded] = useState(false);

  const status: 'pending' | 'ok' | 'fail' = !result ? 'pending' : result.ok ? 'ok' : 'fail';
  const StatusIcon = status === 'ok' ? CheckCircle2 : status === 'fail' ? XCircle : Activity;
  const statusColor =
    status === 'ok' ? STATUS_SUCCESS : status === 'fail' ? STATUS_ERROR : STATUS_NEUTRAL;

  // Auto-expand on a fresh failure so the user sees the fix without an extra click.
  // (Plays well with manual collapse — the user state wins after their first toggle.)
  const showRemediation = remediation && (expanded || !running);

  return (
    <li className="border-t border-cyan-500/10">
      <button
        type="button"
        onClick={() => remediation && setExpanded((v) => !v)}
        disabled={!remediation}
        aria-expanded={remediation ? expanded : undefined}
        className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.02] disabled:cursor-default disabled:hover:bg-transparent"
      >
        <StatusIcon
          className={`w-4 h-4 shrink-0 ${running && status === 'pending' ? 'animate-spin' : ''}`}
          style={{ color: statusColor }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-text">{meta.label}</span>
            <span className="text-[11px] text-text-muted font-mono tabular-nums">
              {meta.transport === 'ws' ? 'ws://' : 'http://'}
              {cfg.host}:{port}
            </span>
          </div>
          <div className="text-[11px] text-text-muted truncate">{meta.purpose}</div>
        </div>
        <div className="text-right text-[11px] text-text-muted shrink-0">
          {result ? (
            <>
              <div style={{ color: statusColor }} className="font-mono font-semibold">
                {result.ok ? 'OK' : 'FAIL'}
              </div>
              <div className="font-mono tabular-nums">{result.latencyMs} ms</div>
            </>
          ) : (
            <span className="font-mono">—</span>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {showRemediation && remediation && (
          <motion.div
            key={`${id}-remediation`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <RemediationCard
              title={remediation.title}
              explanation={remediation.explanation}
              steps={remediation.steps}
              rawError={result && !result.ok ? result.rawError : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

// ── Remediation card ────────────────────────────────────────────────────────

function RemediationCard({
  title,
  explanation,
  steps,
  rawError,
}: {
  title: string;
  explanation: string;
  steps: RemediationStep[];
  rawError?: string;
}) {
  return (
    <div className="mx-3 mb-3 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: ACCENT_ORANGE }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-text">{title}</div>
          <p className="text-[12px] text-text-muted mt-1 leading-snug">{explanation}</p>

          <ol className="mt-2 space-y-1.5">
            {steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2 text-[12px] text-text">
                <span className="font-mono text-text-muted tabular-nums shrink-0">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="leading-snug">{step.label}</div>
                  {step.copyText && (
                    <div className="mt-1 flex items-center gap-1">
                      <code className="font-mono text-[11px] bg-black/30 rounded px-1.5 py-0.5 truncate">
                        {step.copyText}
                      </code>
                      <CopyButton text={step.copyText} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {rawError && (
            <details className="mt-2">
              <summary className="text-[11px] text-text-muted cursor-pointer select-none">
                Raw error
              </summary>
              <pre className="mt-1 text-[11px] text-text-muted font-mono whitespace-pre-wrap break-words bg-black/30 rounded px-2 py-1.5">
                {rawError}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small bits ──────────────────────────────────────────────────────────────

function OverallPill({ report }: { report: { allGreen: boolean; channels: Record<ChannelId, ProbeResult> } }) {
  const reachable = CHANNEL_ORDER.filter((id) => report.channels[id]?.ok).length;
  const color = report.allGreen ? STATUS_SUCCESS : reachable === 0 ? STATUS_ERROR : ACCENT_ORANGE;
  const label = report.allGreen
    ? 'All channels OK'
    : `${reachable}/${CHANNEL_ORDER.length} reachable`;
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ml-1"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function SettingInput({
  label,
  value,
  onChange,
  ariaLabel,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="focus-ring bg-surface-tertiary border border-border rounded-md px-2 h-7 text-[12px] text-text font-mono tabular-nums"
      />
    </label>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
        } catch {
          // clipboard unavailable in test envs — silently fail
        }
      }}
      aria-label={`Copy: ${text}`}
      className="focus-ring inline-flex items-center justify-center w-6 h-6 rounded text-text-muted hover:text-text hover:bg-white/5"
    >
      {copied ? (
        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} aria-hidden="true" />
      ) : (
        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseIntOr(v: string, fallback: number): number {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function configMatches(cfg: ProbeConfig, good: { host: string; pofPort: number; rcPort: number; wsPort: number; authToken: string }): boolean {
  return (
    cfg.host === good.host &&
    cfg.pofPort === good.pofPort &&
    cfg.rcPort === good.rcPort &&
    cfg.wsPort === good.wsPort &&
    (cfg.authToken ?? '') === good.authToken
  );
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
