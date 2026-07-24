import { type ProbeConfig } from '@/lib/bridge-doctor/probes';

/** Highest port a TCP listener can bind to — the upper bound for the port fields. */
export const PORT_MAX = 65535;

/**
 * True when the raw field text is a bindable TCP port.
 *
 * The port inputs let the user type freely (including transiently-empty or
 * out-of-range text) and only commit a valid value — this predicate is what
 * tells the UI when to flag the field instead of silently dropping keystrokes.
 */
export function isValidPort(raw: string): boolean {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 && n <= PORT_MAX;
}

export function configMatches(cfg: ProbeConfig, good: { host: string; pofPort: number; rcPort: number; wsPort: number; authToken: string }): boolean {
  return (
    cfg.host === good.host &&
    cfg.pofPort === good.pofPort &&
    cfg.rcPort === good.rcPort &&
    cfg.wsPort === good.wsPort &&
    (cfg.authToken ?? '') === good.authToken
  );
}

export function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
