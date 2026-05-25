'use client';

import { AlertTriangle, KeyRound, RefreshCw, ShieldAlert, WifiOff, type LucideIcon } from 'lucide-react';

export type TileErrorKind = 'not-configured' | 'rate-limit' | 'auth' | 'network' | 'generic';

export interface TileErrorClassification {
  kind: TileErrorKind;
  icon: LucideIcon;
  headline: string;
  hint?: string;
}

const NOT_CONFIGURED_HINTS: Array<[RegExp, string]> = [
  [
    /SCENARIO_API_KEY|SCENARIO_API_SECRET/i,
    'Set SCENARIO_API_KEY and SCENARIO_API_SECRET in the app .env, then restart the dev server.',
  ],
  [
    /LEONARDO_API_KEY/i,
    'Set LEONARDO_API_KEY in the app .env, then restart the dev server.',
  ],
];

export function classifyTileError(error: string): TileErrorClassification {
  if (/not configured|not set in environment|missing.*api.?key/i.test(error)) {
    const hint =
      NOT_CONFIGURED_HINTS.find(([re]) => re.test(error))?.[1] ??
      'A required API key is not configured. Add it to the app .env and restart the dev server.';
    return { kind: 'not-configured', icon: KeyRound, headline: 'Provider not configured', hint };
  }
  if (/\b429\b|rate[- ]?limit|too many requests/i.test(error)) {
    return {
      kind: 'rate-limit',
      icon: AlertTriangle,
      headline: 'Rate limit reached',
      hint: 'The provider is throttling requests. Wait a moment, then retry.',
    };
  }
  if (/\b401\b|\b403\b|unauthor|forbidden|invalid api/i.test(error)) {
    return {
      kind: 'auth',
      icon: ShieldAlert,
      headline: 'Authentication failed',
      hint: 'The API key was rejected. Confirm it is valid and has access to this endpoint.',
    };
  }
  if (/failed to fetch|network|timed out|timeout|ENOTFOUND|ECONNRE|fetch failed/i.test(error)) {
    return {
      kind: 'network',
      icon: WifiOff,
      headline: 'Network error',
      hint: 'Could not reach the provider. Check your connection, then retry.',
    };
  }
  return { kind: 'generic', icon: AlertTriangle, headline: 'Request failed' };
}

export interface TileErrorProps {
  error: string;
  onRetry?: () => void;
  testId?: string;
}

export function TileError({ error, onRetry, testId }: TileErrorProps) {
  const c = classifyTileError(error);
  const Icon = c.icon;
  const canRetry = Boolean(onRetry) && c.kind !== 'not-configured';
  return (
    <div
      data-testid={testId}
      data-error-kind={c.kind}
      role="alert"
      className="flex items-start gap-2 text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1.5"
    >
      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-medium">{c.headline}</div>
        {c.hint && <div className="text-red-300/80">{c.hint}</div>}
        <div className="text-[10px] text-red-300/50 truncate" title={error}>
          {error}
        </div>
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            data-testid={testId ? `${testId}-retry` : undefined}
            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-red-500/15 hover:bg-red-500/25 text-red-200 text-[10px] font-medium"
          >
            <RefreshCw className="w-3 h-3" aria-hidden /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
