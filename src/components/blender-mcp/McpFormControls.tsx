'use client';

import { type ReactNode } from 'react';
import { Loader2, CheckCircle, AlertCircle, type LucideIcon } from 'lucide-react';
import {
  SUCCESS_RESULT,
  ERROR_RESULT,
  WARNING_TEXT,
} from '@/lib/blender-mcp/status-tokens';

/**
 * Shared form primitives for the Blender MCP pipeline screens (LOD Generation,
 * Mesh Optimization, FBX Conversion …).
 *
 * Before this module, each tab re-declared the same card shell, labeled inputs,
 * submit button, disconnected warning, and result block — and the radii drifted
 * (cards/inputs `rounded-lg`, buttons `rounded`, the connection bar `rounded-md`).
 * These primitives lock in ONE corner radius + one spacing rhythm so every
 * current and future field is automatically consistent with the connection bar.
 */

/**
 * Canonical corner radius for every Blender MCP form control. Matches the
 * connection bar (which already uses `rounded-md`), ending the
 * `rounded-lg` / `rounded` drift across sibling screens.
 */
export const MCP_FORM_RADIUS = 'rounded-md';

/* ─── Card shell ────────────────────────────────────────────────────────── */

/** The bordered card that wraps a pipeline form's fields. */
export function MCPFormCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${MCP_FORM_RADIUS} border border-border bg-surface-secondary p-4 space-y-3 ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Labeled field ─────────────────────────────────────────────────────── */

interface MCPFieldProps {
  /** Field label rendered above the control. */
  label: string;
  /** Optional helper text rendered below the control. */
  hint?: ReactNode;
  /** Associates the label with a control of the same id (a11y). */
  htmlFor?: string;
  children: ReactNode;
}

/** Label + control + optional hint, with the canonical vertical rhythm. */
export function MCPField({ label, hint, htmlFor, children }: MCPFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-text mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  );
}

/* ─── Text input ────────────────────────────────────────────────────────── */

interface MCPTextInputProps {
  value: string;
  /** Called with the new string value (not the raw event). */
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  /** Render in a monospace face (file paths, codes …). */
  mono?: boolean;
  /** Width / layout override. Defaults to full width. */
  className?: string;
  'data-testid'?: string;
}

/** Single-line text input on the canonical radius + spacing scale. */
export function MCPTextInput({
  value,
  onChange,
  placeholder,
  id,
  mono = false,
  className = 'w-full',
  'data-testid': dataTestid,
}: MCPTextInputProps) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={dataTestid}
      className={`${className} bg-surface-tertiary border border-border ${MCP_FORM_RADIUS} px-3 py-1.5 text-xs text-text placeholder:text-text-muted${
        mono ? ' font-mono' : ''
      }`}
    />
  );
}

/* ─── Submit button ─────────────────────────────────────────────────────── */

interface MCPSubmitButtonProps {
  onClick: () => void;
  /** Disable for unmet preconditions (disconnected, empty required fields). */
  disabled?: boolean;
  /** In-flight: swaps the icon for a spinner and shows `loadingLabel`. */
  loading?: boolean;
  loadingLabel?: string;
  /** Idle-state leading icon. */
  icon: LucideIcon;
  children: ReactNode;
  'data-testid'?: string;
}

/** Primary action button, accent-filled on the canonical radius. */
export function MCPSubmitButton({
  onClick,
  disabled = false,
  loading = false,
  loadingLabel = 'Working…',
  icon: Icon,
  children,
  'data-testid': dataTestid,
}: MCPSubmitButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      data-testid={dataTestid}
      className={`flex items-center gap-1.5 px-3 py-1.5 ${MCP_FORM_RADIUS} text-xs font-medium
                 bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all
                 disabled:opacity-50`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {loading ? loadingLabel : children}
    </button>
  );
}

/* ─── Disconnected notice ───────────────────────────────────────────────── */

/** Inline warning shown when the Blender MCP bridge is not connected. */
export function DisconnectedNotice({
  message = 'Connect to Blender MCP first.',
}: {
  message?: string;
}) {
  return <p className={`text-xs ${WARNING_TEXT}`}>{message}</p>;
}

/* ─── Result block ──────────────────────────────────────────────────────── */

/** Success / error output rendered beneath a pipeline form after a run. */
export function ResultBlock({
  result,
  error,
}: {
  result: string | null;
  error: string | null;
}) {
  if (!result && !error) return null;
  return (
    <div className="mt-3">
      {result && (
        <div className={`flex items-start gap-2 p-3 ${MCP_FORM_RADIUS} ${SUCCESS_RESULT}`}>
          <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
          <pre className="text-xs font-mono text-text-muted whitespace-pre-wrap">{result}</pre>
        </div>
      )}
      {error && (
        <div className={`flex items-start gap-2 p-3 ${MCP_FORM_RADIUS} ${ERROR_RESULT}`}>
          <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}
    </div>
  );
}
