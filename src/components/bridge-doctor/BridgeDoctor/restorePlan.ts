import type { ChannelId, DiagnosticsReport, ProbeConfig } from '@/lib/bridge-doctor/probes';
import { CHANNEL_ORDER } from './constants';

/** Shape of a remembered config (structurally a KnownGoodConfig without the timestamp). */
export interface GoodConfig {
  host: string;
  pofPort: number;
  rcPort: number;
  wsPort: number;
  authToken: string;
}

export type ConfigChange =
  | { field: 'host'; from: string; to: string }
  | { field: 'pofPort' | 'rcPort' | 'wsPort'; from: number; to: number }
  /** The token is never echoed - only the fact that it differs. */
  | { field: 'authToken'; changed: true };

/** Per-field difference between the live config and the last-known-good one. */
export function diffConfig(live: ProbeConfig, good: GoodConfig): ConfigChange[] {
  const out: ConfigChange[] = [];
  if (live.host !== good.host) out.push({ field: 'host', from: live.host, to: good.host });
  if (live.pofPort !== good.pofPort) out.push({ field: 'pofPort', from: live.pofPort, to: good.pofPort });
  if (live.rcPort !== good.rcPort) out.push({ field: 'rcPort', from: live.rcPort, to: good.rcPort });
  if (live.wsPort !== good.wsPort) out.push({ field: 'wsPort', from: live.wsPort, to: good.wsPort });
  if ((live.authToken ?? '') !== good.authToken) out.push({ field: 'authToken', changed: true });
  return out;
}

/** Which settings fields can make a given channel fail. */
const CHANNEL_FIELDS: Record<ChannelId, ConfigChange['field'][]> = {
  'pof-bridge': ['host', 'pofPort', 'authToken'],
  'remote-control': ['host', 'rcPort'],
  'ws-live-state': ['host', 'wsPort'],
};

/** Failed channels whose own settings differ from the last-known-good config (settings drift). */
export function implicatedChannels(report: DiagnosticsReport | null, diff: ConfigChange[]): ChannelId[] {
  if (!report) return [];
  const changed = new Set<string>(diff.map((c) => c.field));
  return CHANNEL_ORDER.filter(
    (id) => !report.channels[id].ok && CHANNEL_FIELDS[id].some((f) => changed.has(f)),
  );
}

/** Failed channels the diff does not explain - the editor side, not settings drift. */
export function editorSideChannels(report: DiagnosticsReport | null, diff: ConfigChange[]): ChannelId[] {
  if (!report) return [];
  const drift = new Set(implicatedChannels(report, diff));
  return CHANNEL_ORDER.filter((id) => !report.channels[id].ok && !drift.has(id));
}

export function describeChange(c: ConfigChange): string {
  return c.field === 'authToken' ? 'auth token changed' : `${c.field} ${c.from} → ${c.to}`;
}
