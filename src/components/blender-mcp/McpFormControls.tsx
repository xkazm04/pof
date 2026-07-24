'use client';

import { type ReactNode } from 'react';
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
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
      className={`focus-ring ${className} bg-surface-tertiary border border-border ${MCP_FORM_RADIUS} px-3 py-1.5 text-xs text-text placeholder:text-text-muted${
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
      aria-busy={loading}
      data-testid={dataTestid}
      className={`focus-ring flex items-center gap-1.5 px-3 py-1.5 ${MCP_FORM_RADIUS} text-xs font-medium
                 bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all
                 disabled:opacity-50`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      ) : (
        <Icon size={14} aria-hidden="true" />
      )}
      {loading ? loadingLabel : children}
    </button>
  );
}

/* ─── Disconnected notice ───────────────────────────────────────────────── */

/**
 * Inline warning shown when the Blender MCP bridge is not connected.
 *
 * Carries a glyph as well as the amber hue so the state is not conveyed by
 * color alone (WCAG 1.4.1), matching the StatusToken convention used elsewhere.
 */
export function DisconnectedNotice({
  message = 'Connect to Blender MCP first.',
}: {
  message?: string;
}) {
  return (
    <p className={`flex items-start gap-1.5 text-xs ${WARNING_TEXT}`}>
      <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

/* ─── Result block ──────────────────────────────────────────────────────── */

/**
 * Success / error output rendered beneath a pipeline form after a run.
 *
 * Both blocks are live regions so a run that finishes while focus is still on
 * the form is announced rather than landing silently below the fold, and each
 * carries a short outcome heading so the raw script output is never the only
 * signal of whether the run passed.
 */
export function ResultBlock({
  result,
  error,
}: {
  result: string | null;
  error: string | null;
}) {
  if (!result && !error) return null;
  return (
    <div className="mt-3 space-y-2">
      {result && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-2 p-3 ${MCP_FORM_RADIUS} ${SUCCESS_RESULT}`}
        >
          <CheckCircle
            size={14}
            className="text-green-400 mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-green-400">Run succeeded</p>
            <pre className="mt-1 text-xs font-mono text-text whitespace-pre-wrap break-words">
              {result}
            </pre>
          </div>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className={`flex items-start gap-2 p-3 ${MCP_FORM_RADIUS} ${ERROR_RESULT}`}
        >
          <AlertCircle
            size={14}
            className="text-red-400 mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-400">Run failed</p>
            <p className="mt-1 text-xs text-red-400 break-words">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
