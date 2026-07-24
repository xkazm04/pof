'use client';

import { useId, useState, type CSSProperties } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';
import {
  STATUS_SUCCESS,
  STATUS_ERROR,
  ACCENT_ORANGE,
} from '@/lib/chart-colors';
import { UI_TIMEOUTS } from '@/lib/constants';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { type ChannelId, type ProbeResult } from '@/lib/bridge-doctor/probes';
import { CHANNEL_ORDER } from './constants';
import { PORT_MAX, isValidPort } from './helpers';

// ── Small bits ──────────────────────────────────────────────────────────────

export function OverallPill({ report }: { report: { allGreen: boolean; channels: Record<ChannelId, ProbeResult> } }) {
  const reachable = CHANNEL_ORDER.filter((id) => report.channels[id]?.ok).length;
  const color = report.allGreen ? STATUS_SUCCESS : reachable === 0 ? STATUS_ERROR : ACCENT_ORANGE;
  const label = report.allGreen
    ? 'All channels OK'
    : `${reachable}/${CHANNEL_ORDER.length} reachable`;
  return (
    // The live region lives on the stable wrapper in the header, so this pill
    // stays presentational — mounting a fresh role="status" per run is not
    // reliably announced.
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ml-1"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/**
 * Shared field chrome. h-8 matches the header buttons and lifts the hit target
 * to 32px. The background is the `--surface-deep` well token — the previous
 * `bg-surface-tertiary` is not a defined token, so the inputs rendered with a
 * fully transparent background and read as static text rather than fields.
 */
const FIELD_CLASS =
  'focus-ring border border-border rounded-md px-2 h-8 text-[12px] text-text font-mono tabular-nums';
const FIELD_STYLE: CSSProperties = { backgroundColor: 'var(--surface-deep)' };

export function SettingInput({
  label,
  value,
  onChange,
  ariaLabel,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <MicroLabel uppercase>{label}</MicroLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={FIELD_CLASS}
        style={FIELD_STYLE}
      />
    </label>
  );
}

/**
 * Port field with a free-text draft.
 *
 * The previous version fed every keystroke through `parseInt(…, fallback)`, so
 * clearing the field snapped the old number straight back and select-all-retype
 * was impossible — and an out-of-range value was dropped with no feedback at
 * all. Here the user's text is held locally while they type, only a valid port
 * is committed upstream, and anything unbindable is flagged (border + hint +
 * `aria-invalid`) instead of silently ignored. Blur resyncs to the committed value.
 */
export function PortInput({
  label,
  value,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number;
  onChange: (port: number) => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const invalid = draft !== null && !isValidPort(draft);
  const hintId = useId();

  return (
    <label className="flex flex-col gap-0.5">
      <MicroLabel uppercase>{label}</MicroLabel>
      <input
        type="text"
        inputMode="numeric"
        value={shown}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (isValidPort(raw)) onChange(Number.parseInt(raw.trim(), 10));
        }}
        onBlur={() => setDraft(null)}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? hintId : undefined}
        className={FIELD_CLASS}
        style={invalid ? { ...FIELD_STYLE, borderColor: STATUS_ERROR } : FIELD_STYLE}
      />
      {invalid && (
        /* text-xs matches the MicroLabel 12px legibility floor; the id is
           needed for aria-describedby, which MicroLabel does not forward. */
        <span id={hintId} className="text-xs" style={{ color: STATUS_ERROR }}>
          Enter 1–{PORT_MAX}
        </span>
      )}
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
      aria-label={copied ? `Copied: ${text}` : `Copy: ${text}`}
      title={copied ? 'Copied' : 'Copy to clipboard'}
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
