import { ACCENT_RED, STATUS_NEUTRAL, STATUS_SUCCESS } from '@/lib/chart-colors';

export function fmtDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

export function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function fmtPct(n: number, fractionDigits = 1): string {
  return `${n.toFixed(fractionDigits)}%`;
}

export function deltaTone(value: number, betterWhenLower = false): string {
  if (Math.abs(value) < 1e-6) return STATUS_NEUTRAL;
  const isPositive = value > 0;
  const good = betterWhenLower ? !isPositive : isPositive;
  return good ? STATUS_SUCCESS : ACCENT_RED;
}

export function deltaArrow(value: number): string {
  if (Math.abs(value) < 1e-6) return '·';
  return value > 0 ? '▲' : '▼';
}

export function fmtSignedNumber(value: number, decimals = 0): string {
  const abs = Math.abs(value).toFixed(decimals);
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${abs}`;
}

export function fmtSignedUsd(value: number): string {
  return `${value >= 0 ? '+' : '−'}$${Math.abs(value).toFixed(4)}`;
}

export function fmtSignedPct(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`;
}

export function fmtSignedDuration(value: number | null): string {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : '−'}${fmtDuration(Math.abs(value))}`;
}
