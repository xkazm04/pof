'use client';

import { RefreshCw, WifiOff, ShieldAlert, Clock, ServerCrash, AlertCircle } from 'lucide-react';
import { STATUS_ERROR, STATUS_WARNING, STATUS_INFO, ACCENT_CYAN, statusBg, statusBorder } from '@/lib/chart-colors';

export type FetchErrorType = 'network' | 'auth' | 'timeout' | 'server';

interface ErrorConfig {
  icon: typeof WifiOff;
  color: string;
  title: string;
  guidance: string;
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
}

const ERROR_CONFIG: Record<FetchErrorType, ErrorConfig> = {
  network: {
    icon: WifiOff,
    color: STATUS_WARNING,
    title: 'Connection lost',
    guidance: 'Could not reach the server — check your connection and try again.',
  },
  auth: {
    icon: ShieldAlert,
    color: STATUS_ERROR,
    title: 'Access denied',
    guidance: 'Your session may have expired. Verify your credentials or sign in again.',
    secondaryAction: { label: 'Open Settings', href: '/settings' },
  },
  timeout: {
    icon: Clock,
    color: ACCENT_CYAN,
    title: 'Request timed out',
    guidance: 'The server is taking longer than usual — give it a moment and retry.',
  },
  server: {
    icon: ServerCrash,
    color: STATUS_INFO,
    title: 'Server hiccup',
    guidance: 'Something went wrong on our end. This is usually temporary.',
  },
};

interface FetchErrorProps {
  message: string;
  onRetry: () => void;
  /** Optional error classification for contextual icon, guidance, and actions. */
  errorType?: FetchErrorType;
  /** Override the default secondary action for the given errorType. */
  secondaryAction?: { label: string; onClick: () => void };
}

export function FetchError({ message, onRetry, errorType, secondaryAction }: FetchErrorProps) {
  const config = errorType ? ERROR_CONFIG[errorType] : null;
  const Icon = config?.icon ?? AlertCircle;
  const color = config?.color ?? STATUS_ERROR;
  const title = config?.title ?? 'Something went wrong';
  const guidance = config?.guidance;
  const secondary = secondaryAction ?? config?.secondaryAction;

  return (
    <div className="flex items-center justify-center py-14" role="alert" aria-live="polite">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        {/* Illustration — layered rings with icon */}
        <div className="relative flex items-center justify-center">
          {/* Outer decorative ring */}
          <div
            className="absolute w-20 h-20 rounded-full"
            style={{ backgroundColor: statusBg(color, 0.05) }}
          />
          {/* Middle ring */}
          <div
            className="absolute w-14 h-14 rounded-full"
            style={{
              backgroundColor: statusBg(color, 0.08),
              border: `1px solid ${statusBorder(color, 0.12)}`,
            }}
          />
          {/* Icon circle */}
          <div
            className="relative flex items-center justify-center w-12 h-12 rounded-full"
            style={{ backgroundColor: statusBg(color, 0.12) }}
          >
            <Icon className="w-6 h-6" style={{ color }} strokeWidth={1.5} />
          </div>
        </div>

        {/* Friendly title */}
        <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{title}</p>

        {/* Original error message — muted so it doesn't alarm */}
        <p className="text-xs text-[var(--text-muted)] -mt-2">{message}</p>

        {/* Contextual guidance */}
        {guidance && (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed opacity-80">{guidance}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors"
            style={{
              color,
              backgroundColor: statusBg(color, 0.08),
              border: `1px solid ${statusBorder(color, 0.20)}`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = statusBg(color, 0.20); }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = statusBg(color, 0.08); }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>

          {secondary && (
            'href' in secondary && secondary.href ? (
              <a
                href={secondary.href}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {secondary.label}
              </a>
            ) : (
              <button
                onClick={secondary.onClick}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {secondary.label}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
