/**
 * Bridge Doctor — remediation catalog
 *
 * Maps each (channel, failure-kind) tuple to a plain-language explanation and a
 * concrete fix the user can act on without needing engine internals knowledge.
 *
 * This is the "actionable" half of the Doctor — the probes classify the
 * symptom, this module supplies the human-readable cure.
 */

import type { ChannelId, ProbeFailureKind, ProbeResult } from './probes';

export interface RemediationStep {
  /** One-sentence summary of the action. */
  label: string;
  /** Optional copy-pasteable command or path (rendered with a Copy button). */
  copyText?: string;
  /** Where this step is performed. */
  context: 'unreal-editor' | 'console' | 'app';
}

export interface Remediation {
  channel: ChannelId;
  kind: ProbeFailureKind;
  /** Short headline shown in the failure card title. */
  title: string;
  /** Plain-language explanation of what the probe saw. */
  explanation: string;
  /** Ordered, concrete steps to try. */
  steps: RemediationStep[];
  /** Optional URL to a docs anchor. */
  docsHref?: string;
}

// ── Channel metadata ────────────────────────────────────────────────────────

export const CHANNEL_META: Record<ChannelId, { label: string; defaultPort: number; transport: 'http' | 'ws'; purpose: string }> = {
  'pof-bridge': {
    label: 'PoF Bridge',
    defaultPort: 30040,
    transport: 'http',
    purpose: 'Asset manifest, test runner, snapshot capture, live-coding compile',
  },
  'remote-control': {
    label: 'Remote Control',
    defaultPort: 30010,
    transport: 'http',
    purpose: 'Read/write UObject properties, invoke UFUNCTIONs, asset search',
  },
  'ws-live-state': {
    label: 'Live State (WebSocket)',
    defaultPort: 30041,
    transport: 'ws',
    purpose: 'Live editor snapshots, property watches, PIE / selection events',
  },
};

// ── Remediation table ───────────────────────────────────────────────────────

/**
 * Pure function: given a probe result, return the remediation.
 * Returns null when the probe succeeded (no remediation needed).
 */
export function remediationFor(result: ProbeResult): Remediation | null {
  if (result.ok) return null;
  return buildRemediation(result.channel, result.kind);
}

function buildRemediation(channel: ChannelId, kind: ProbeFailureKind): Remediation {
  const meta = CHANNEL_META[channel];

  switch (kind) {
    case 'editor-not-running':
      return {
        channel,
        kind,
        title: 'Unreal Editor not reachable',
        explanation: `Nothing is answering on ${meta.label} at port ${meta.defaultPort}. The editor is probably closed, or it was started without the right plugins enabled.`,
        steps: [
          { label: 'Open the Unreal Editor on this machine', context: 'unreal-editor' },
          { label: 'Wait for the project to finish loading (the title bar must show your project name)', context: 'unreal-editor' },
          channel === 'pof-bridge'
            ? { label: 'In Edit → Plugins, enable "Pillars of Fortune Bridge"', context: 'unreal-editor' }
            : channel === 'remote-control'
              ? { label: 'In Edit → Plugins, enable "Remote Control API" (the built-in plugin)', context: 'unreal-editor' }
              : { label: 'The WebSocket is provided by the PoF Bridge plugin — confirm it is enabled', context: 'unreal-editor' },
          { label: 'Re-run diagnostics from this panel', context: 'app' },
        ],
      };

    case 'timeout':
      return {
        channel,
        kind,
        title: `${meta.label} timed out`,
        explanation: `A connection attempt to port ${meta.defaultPort} hung past the time budget. Common causes: the editor is mid-startup, a firewall is silently dropping packets, or another process is occupying the port.`,
        steps: [
          { label: 'Wait 10–20s if the editor was just launched, then re-run', context: 'app' },
          { label: 'Check which process owns the port', context: 'console', copyText: `netstat -ano | findstr :${meta.defaultPort}` },
          { label: 'Allow the editor through Windows Defender Firewall (inbound TCP rule for the port)', context: 'console' },
          { label: 'Re-run diagnostics from this panel', context: 'app' },
        ],
      };

    case 'auth-rejected':
      return {
        channel,
        kind,
        title: 'Authentication rejected',
        explanation: `${meta.label} answered but refused the auth token (HTTP 401/403). Either no token is set in the app and the plugin requires one, or the value is stale.`,
        steps: [
          { label: 'Open the PoF Bridge plugin settings in Unreal (Project Settings → PoF Bridge) and copy the token', context: 'unreal-editor' },
          { label: 'Paste the token into the Bridge Doctor Settings panel and save', context: 'app' },
          { label: 'Re-run diagnostics from this panel', context: 'app' },
        ],
      };

    case 'plugin-disabled':
      return {
        channel,
        kind,
        title: 'Listener answered, but the plugin route is missing',
        explanation: `Port ${meta.defaultPort} is in use but the expected ${meta.transport.toUpperCase()} route returned 404. The companion plugin is probably not enabled in this project, or you're talking to a different service.`,
        steps: [
          channel === 'remote-control'
            ? { label: 'In Unreal: Edit → Plugins → search "Remote Control API" → Enabled, then restart the editor', context: 'unreal-editor' }
            : { label: 'In Unreal: Edit → Plugins → search "Pillars of Fortune Bridge" → Enabled, then restart the editor', context: 'unreal-editor' },
          { label: 'Confirm the port matches the plugin\'s configured value', context: 'app' },
          { label: 'Re-run diagnostics from this panel', context: 'app' },
        ],
      };

    case 'wrong-port':
      return {
        channel,
        kind,
        title: 'Port mismatch — talking to the wrong service',
        explanation: `Port ${meta.defaultPort} responded, but the payload didn't look like ${meta.label}. You're likely pointed at a different bridge channel, or another tool grabbed the port first.`,
        steps: [
          { label: 'Check which process owns the port', context: 'console', copyText: `netstat -ano | findstr :${meta.defaultPort}` },
          { label: 'Confirm the port number in Settings matches the plugin\'s configured value', context: 'app' },
          { label: 'If a stale dev server is squatting the port, stop it and re-run', context: 'app' },
        ],
      };

    case 'http-error':
      return {
        channel,
        kind,
        title: `${meta.label} returned an unexpected error`,
        explanation: `The probe reached ${meta.label} but received an HTTP error status. The plugin is loaded but in a bad state.`,
        steps: [
          { label: 'Check the Unreal Output Log for plugin errors', context: 'unreal-editor' },
          { label: 'Restart the Unreal Editor', context: 'unreal-editor' },
          { label: 'Re-run diagnostics from this panel', context: 'app' },
        ],
      };

    case 'unknown':
    default:
      return {
        channel,
        kind: 'unknown',
        title: 'Unrecognised failure',
        explanation: `${meta.label} probe failed in a way the Doctor doesn't have a specific fix for. Inspect the raw error below and try the generic restart path.`,
        steps: [
          { label: 'Copy the raw error and check the project Output Log', context: 'unreal-editor' },
          { label: 'Restart the Unreal Editor and the dev server', context: 'console' },
          { label: 'Re-run diagnostics from this panel', context: 'app' },
        ],
      };
  }
}
