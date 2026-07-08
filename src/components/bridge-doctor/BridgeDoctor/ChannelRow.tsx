'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  STATUS_SUCCESS,
  STATUS_ERROR,
  STATUS_NEUTRAL,
  ACCENT_ORANGE,
} from '@/lib/chart-colors';
import {
  type ChannelId,
  type ProbeConfig,
  type ProbeResult,
} from '@/lib/bridge-doctor/probes';
import {
  CHANNEL_META,
  remediationFor,
  type RemediationStep,
} from '@/lib/bridge-doctor/remediation';
import { CopyButton } from './parts';

// ── Channel row ─────────────────────────────────────────────────────────────

export function ChannelRow({
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
