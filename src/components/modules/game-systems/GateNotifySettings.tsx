'use client';

import { useState, useCallback, useEffect } from 'react';
import { Bell, Send, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO } from '@/lib/chart-colors';
import type { GateNotifyConfig, GateNotifyState } from '@/lib/notify/gate-notify-store';

// `import type` is erased — the server-only store never reaches this bundle.
const DEFAULT_CONFIG: GateNotifyConfig = { enabled: false, webhookUrl: '', target: 'slack', mode: 'failures' };

const TARGET_LABELS: Record<GateNotifyConfig['target'], string> = {
  slack: 'Slack',
  discord: 'Discord',
  generic: 'Generic JSON',
};
const MODE_LABELS: Record<GateNotifyConfig['mode'], string> = {
  all: 'All changes',
  failures: 'Failures',
  regressions: 'Regressions only',
};
const STATUS_COLOR: Record<NonNullable<GateNotifyState['lastStatus']>, string> = {
  sent: STATUS_SUCCESS,
  error: STATUS_ERROR,
  skipped: STATUS_INFO,
};

const URL_PLACEHOLDER: Record<GateNotifyConfig['target'], string> = {
  slack: 'https://hooks.slack.com/services/…',
  discord: 'https://discord.com/api/webhooks/…',
  generic: 'https://your-endpoint.example/notify',
};

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Opt-in webhook config for gate-verdict notifications — the "walk away from the
 * long drain and get pinged on a regression" operator control. Mirrors the
 * NightlyBuildScheduler shape; both sit under unattended-operations settings.
 */
export function GateNotifySettings() {
  const [config, setConfig] = useState<GateNotifyConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<GateNotifyState | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ config: GateNotifyConfig; state: GateNotifyState }>('/api/notify/gate');
      setConfig(data.config);
      setState(data.state);
      setUrlDraft(data.config.webhookUrl);
    } catch { /* keep last-known config */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = useCallback(async (patch: Partial<GateNotifyConfig>) => {
    setBusy(true);
    try {
      const data = await apiFetch<{ config: GateNotifyConfig }>('/api/notify/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...patch }),
      });
      setConfig(data.config);
      setUrlDraft(data.config.webhookUrl);
    } catch { /* surfaced by stale config */ } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    setTestMsg(null);
    try {
      const data = await apiFetch<{ outcome: { status: string; detail: string }; state: GateNotifyState }>(
        '/api/notify/gate',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }) },
      );
      setTestMsg(`${data.outcome.status} — ${data.outcome.detail}`);
      setState(data.state);
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : 'test failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const commitUrl = () => {
    if (urlDraft.trim() !== config.webhookUrl) save({ webhookUrl: urlDraft.trim() });
  };

  const lastStatus = state?.lastStatus ?? null;

  return (
    <div className="rounded border border-border-bright bg-surface-deep/40 p-3 space-y-3" data-testid="pof-gate-notify">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: MODULE_COLORS.systems }} />
          <span className="text-sm font-semibold text-text">Gate Notifications</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            disabled={busy}
            onChange={(e) => save({ enabled: e.target.checked })}
            className="accent-violet-500"
            data-testid="pof-gate-notify-enabled"
          />
          Enabled
        </label>
      </div>

      <p className="text-2xs text-text-muted">
        Ping an outbound webhook when a test-gate verdict changes during a drain — so a long unattended run isn&apos;t a black box.
      </p>

      {/* Webhook URL */}
      <input
        type="url"
        value={urlDraft}
        disabled={busy}
        placeholder={URL_PLACEHOLDER[config.target]}
        onChange={(e) => setUrlDraft(e.target.value)}
        onBlur={commitUrl}
        className="w-full bg-background border border-border-bright rounded px-2 py-1 text-xs text-text font-mono outline-none focus-ring"
        data-testid="pof-gate-notify-url"
      />

      {/* Target + mode */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-2xs text-text-muted">
          Target
          <select
            value={config.target}
            disabled={busy}
            onChange={(e) => save({ target: e.target.value as GateNotifyConfig['target'] })}
            className="bg-background border border-border-bright rounded px-2 py-1 text-xs text-text outline-none focus-ring"
            data-testid="pof-gate-notify-target"
          >
            {(Object.keys(TARGET_LABELS) as GateNotifyConfig['target'][]).map((t) => (
              <option key={t} value={t}>{TARGET_LABELS[t]}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-2xs text-text-muted">
          Notify on
          <select
            value={config.mode}
            disabled={busy}
            onChange={(e) => save({ mode: e.target.value as GateNotifyConfig['mode'] })}
            className="bg-background border border-border-bright rounded px-2 py-1 text-xs text-text outline-none focus-ring"
            data-testid="pof-gate-notify-mode"
          >
            {(Object.keys(MODE_LABELS) as GateNotifyConfig['mode'][]).map((m) => (
              <option key={m} value={m}>{MODE_LABELS[m]}</option>
            ))}
          </select>
        </label>

        <button
          onClick={sendTest}
          disabled={busy || !config.webhookUrl}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-white disabled:opacity-40 transition-colors ml-auto"
          style={{ background: MODULE_COLORS.systems }}
          data-testid="pof-gate-notify-test"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Send test
        </button>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between gap-3 text-2xs text-text-muted flex-wrap border-t border-border pt-2">
        <div className="flex items-center gap-3 flex-wrap">
          {lastStatus ? (
            <span className="flex items-center gap-1">
              last:
              <span className="font-medium" style={{ color: STATUS_COLOR[lastStatus] }}>{lastStatus}</span>
              <span className="font-mono">{fmtTime(state?.lastSentAt ?? null)}</span>
            </span>
          ) : (
            <span>No notifications sent yet</span>
          )}
          <span>delivered: <span className="text-text font-mono">{state?.sentCount ?? 0}</span></span>
        </div>
        {testMsg && <span className="font-mono" data-testid="pof-gate-notify-testmsg">{testMsg}</span>}
      </div>

      {lastStatus && state?.lastDetail && (
        <div className="text-2xs text-text-muted">{state.lastDetail}</div>
      )}
    </div>
  );
}
