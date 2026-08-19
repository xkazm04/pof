// Server-only: persistence for the gate-notification webhook config + last-send
// state, backed by the `settings` table. Mirrors build-schedule-store — the
// "configure once, walk away, get pinged" operator pattern of the nightly build.

import {
  expectRecord, readSettingsBlob, updateSettingsBlob,
  type SettingsBlobRead, type SettingsBlobSpec,
} from '@/lib/settings/settings-blob';
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

/**
 * The webhook config is one JSON string in one `settings` row. An unparseable
 * value used to read as the defaults — `enabled: false` and `webhookUrl: ''` —
 * and the next `setGateNotifyConfig` patch then serialised that empty URL over
 * the real one. The URL was gone, and a corrupt config was indistinguishable
 * from a deliberately disabled one. It stays disabled on the failure path
 * (never post a gate verdict to a URL nobody could read), but it is now logged,
 * flagged, and cannot authorise the write that erased it.
 */
const CONFIG_SPEC: SettingsBlobSpec<GateNotifyConfig> = {
  key: CONFIG_KEY,
  absent: () => ({ ...DEFAULT_GATE_NOTIFY_CONFIG }),
  corrupt: () => ({ ...DEFAULT_GATE_NOTIFY_CONFIG }),
  hydrate: (parsed) => ({
    ...DEFAULT_GATE_NOTIFY_CONFIG,
    ...(expectRecord(parsed, 'gate notify config') as Partial<GateNotifyConfig>),
  }),
};

/** Runtime send state, not configuration — see {@link setGateNotifyState}. */
const STATE_SPEC: SettingsBlobSpec<GateNotifyState> = {
  key: STATE_KEY,
  absent: () => ({ ...DEFAULT_STATE }),
  corrupt: () => ({ ...DEFAULT_STATE }),
  hydrate: (parsed) => ({
    ...DEFAULT_STATE,
    ...(expectRecord(parsed, 'gate notify state') as Partial<GateNotifyState>),
  }),
};

/**
 * The full read, for a caller that wants to REPORT an unreadable webhook config
 * rather than render it as "notifications are switched off".
 */
export function readGateNotifyConfig(): SettingsBlobRead<GateNotifyConfig> {
  return readSettingsBlob(CONFIG_SPEC);
}

export function getGateNotifyConfig(): GateNotifyConfig {
  return readSettingsBlob(CONFIG_SPEC).value;
}

/** Throws `SettingsBlobCorruptError` rather than overwriting an unreadable config. */
export function setGateNotifyConfig(patch: Partial<GateNotifyConfig>): GateNotifyConfig {
  return updateSettingsBlob(CONFIG_SPEC, (current) => ({ ...current, ...patch })).value;
}

export function getGateNotifyState(): GateNotifyState {
  return readSettingsBlob(STATE_SPEC).value;
}

/**
 * The notifier must always be able to record a dispatch outcome, so an
 * unreadable state is preserved under a quarantine key and the write proceeds.
 * Runtime state, not user configuration.
 */
export function setGateNotifyState(patch: Partial<GateNotifyState>): GateNotifyState {
  return updateSettingsBlob(STATE_SPEC, (current) => ({ ...current, ...patch }), {
    onCorrupt: 'preserve-and-continue',
  }).value;
}
