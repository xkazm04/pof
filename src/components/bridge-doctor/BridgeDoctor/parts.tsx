'use client';

import { useState } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';
import {
  STATUS_SUCCESS,
  STATUS_ERROR,
  ACCENT_ORANGE,
} from '@/lib/chart-colors';
import { UI_TIMEOUTS } from '@/lib/constants';
import { type ChannelId, type ProbeResult } from '@/lib/bridge-doctor/probes';
import { CHANNEL_ORDER } from './constants';

// ── Small bits ──────────────────────────────────────────────────────────────

export function OverallPill({ report }: { report: { allGreen: boolean; channels: Record<ChannelId, ProbeResult> } }) {
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

export function SettingInput({
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

export function CopyButton({ text }: { text: string }) {
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
