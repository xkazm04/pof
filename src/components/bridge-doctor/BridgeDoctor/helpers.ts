import { type ProbeConfig } from '@/lib/bridge-doctor/probes';

export function parseIntOr(v: string, fallback: number): number {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
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
