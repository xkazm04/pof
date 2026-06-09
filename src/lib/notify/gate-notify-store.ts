// Server-only: persistence for the gate-notification webhook config + last-send
// state, backed by the `settings` table. Mirrors build-schedule-store — the
// "configure once, walk away, get pinged" operator pattern of the nightly build.

import { getSetting, setSetting } from '@/lib/db';
import type { GateNotifyMode } from './verdict-change';
import type { GateNotifyTarget } from './webhook-payload';

const CONFIG_KEY = 'gate_notify';
const STATE_KEY = 'gate_notify_state';

export interface GateNotifyConfig {
  /** Master on/off switch. Disabled by default — opt-in only. */
  enabled: boolean;
  /** Outbound incoming-webhook URL (Slack/Discord/generic). */
  webhookUrl: string;
  /** Payload format for the URL above. */
  target: GateNotifyTarget;
  /** Which verdict changes to send. */
  mode: GateNotifyMode;
}

export const DEFAULT_GATE_NOTIFY_CONFIG: GateNotifyConfig = {
  enabled: false,
  webhookUrl: '',
  target: 'slack',
  mode: 'failures',
};

export type GateNotifySendStatus = 'sent' | 'skipped' | 'error';

export interface GateNotifyState {
  /** ISO timestamp of the last dispatch attempt. */
  lastSentAt: string | null;
  lastStatus: GateNotifySendStatus | null;
  lastDetail: string | null;
  /** Count of successfully delivered notifications. */
  sentCount: number;
}

const DEFAULT_STATE: GateNotifyState = {
  lastSentAt: null,
  lastStatus: null,
  lastDetail: null,
  sentCount: 0,
};

export function getGateNotifyConfig(): GateNotifyConfig {
  const raw = getSetting(CONFIG_KEY);
  if (!raw) return { ...DEFAULT_GATE_NOTIFY_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<GateNotifyConfig>;
    return { ...DEFAULT_GATE_NOTIFY_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_GATE_NOTIFY_CONFIG };
  }
}

export function setGateNotifyConfig(patch: Partial<GateNotifyConfig>): GateNotifyConfig {
  const next = { ...getGateNotifyConfig(), ...patch };
  setSetting(CONFIG_KEY, JSON.stringify(next));
  return next;
}

export function getGateNotifyState(): GateNotifyState {
  const raw = getSetting(STATE_KEY);
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<GateNotifyState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function setGateNotifyState(patch: Partial<GateNotifyState>): GateNotifyState {
  const next = { ...getGateNotifyState(), ...patch };
  setSetting(STATE_KEY, JSON.stringify(next));
  return next;
}
