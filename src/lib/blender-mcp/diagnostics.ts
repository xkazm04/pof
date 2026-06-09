/**
 * Blender MCP connection diagnostics.
 *
 * The raw socket error strings produced by `BlenderMCPService.connect` are
 * unhelpful to non-technical users ("connect ECONNREFUSED 127.0.0.1:9876").
 * This module turns them into an actionable diagnosis — a named failure mode
 * with a plain-language summary, numbered fix steps, and (where relevant) a
 * link to install the Blender MCP addon.
 *
 * Pure + DOM-free so it can be unit-tested and reused by the connection bar,
 * the setup wizard, and the store's auto-retry loop.
 */

import { DEFAULT_BLENDER_PORT } from './types';

/** The Blender MCP addon that PoF talks to over TCP (ahujasid/blender-mcp). */
export const BLENDER_ADDON_REPO_URL = 'https://github.com/ahujasid/blender-mcp';

/**
 * Maximum number of automatic reconnect attempts before the auto-retry loop
 * gives up and leaves the diagnosis on screen for the user to act on.
 */
export const BLENDER_RETRY_MAX_ATTEMPTS = 5;

export type ConnectionFailureMode =
  | 'not-running'
  | 'addon-not-installed'
  | 'wrong-port'
  | 'timeout'
  | 'unreachable-host'
  | 'unknown';

export interface ConnectionDiagnosis {
  /** Discriminator used by the UI to pick an icon / tone. */
  mode: ConnectionFailureMode;
  /** Short headline, e.g. "Blender isn't running". */
  title: string;
  /** One-sentence plain-language explanation of the likely cause. */
  summary: string;
  /** Ordered, concrete steps the user can follow to fix it. */
  steps: string[];
  /** Link to install/enable the addon, when that's part of the fix. */
  addonInstallUrl?: string;
}

interface DiagnosisContext {
  host: string;
  port: number;
}

/**
 * Exponential backoff delay for reconnect attempt `attempt` (0-indexed),
 * capped at `max`. Pure so the store can schedule retries deterministically
 * and tests can assert the schedule.
 */
export function nextRetryDelay(
  attempt: number,
  base: number,
  max: number,
): number {
  return Math.min(base * 2 ** Math.max(0, attempt), max);
}

/**
 * Map a raw connection error string into a structured, user-facing diagnosis.
 * `null`/empty errors yield a generic "can't reach Blender" diagnosis.
 */
export function classifyConnectionError(
  error: string | null | undefined,
  ctx: DiagnosisContext,
): ConnectionDiagnosis {
  const raw = (error ?? '').trim();
  const lower = raw.toLowerCase();
  const portHint = `Confirm Blender's MCP server is listening on port ${ctx.port} (PoF's default is ${DEFAULT_BLENDER_PORT}).`;

  // Connected to a TCP server, but it didn't answer the addon health check.
  if (lower.includes('addon not responding') || lower.includes('not responding')) {
    return {
      mode: 'addon-not-installed',
      title: 'Blender MCP addon not responding',
      summary:
        'PoF reached the port, but the Blender MCP addon did not answer — it is likely not installed, not enabled, or its server is not started.',
      steps: [
        'In Blender, open Edit ▸ Preferences ▸ Add-ons and confirm "Blender MCP" is installed and enabled.',
        'Install it from the addon repository (link below) if it is missing.',
        'Open the sidebar in the 3D Viewport (press N) ▸ BlenderMCP tab and click "Connect to MCP server".',
        'Then retry the connection here.',
      ],
      addonInstallUrl: BLENDER_ADDON_REPO_URL,
    };
  }

  // DNS / host resolution failure — the host name is wrong or unreachable.
  if (
    lower.includes('enotfound') ||
    lower.includes('eai_again') ||
    lower.includes('getaddrinfo') ||
    lower.includes('ehostunreach')
  ) {
    return {
      mode: 'unreachable-host',
      title: 'Host unreachable',
      summary: `The host "${ctx.host}" could not be reached. Check the host address — for a local Blender this should be "localhost".`,
      steps: [
        'If Blender runs on this machine, set the host to "localhost" (or 127.0.0.1).',
        'If Blender runs on another machine, verify the host name/IP is correct and on the same network.',
        'Check that no firewall or VPN is blocking the connection.',
      ],
    };
  }

  // The socket connected but the operation took too long.
  if (
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('etimedout')
  ) {
    return {
      mode: 'timeout',
      title: 'Connection timed out',
      summary:
        'PoF could not get a response from Blender in time. Blender may be busy, blocked by a firewall, or the addon server may not be running.',
      steps: [
        'Confirm Blender is open and not stuck on a modal dialog or heavy operation.',
        'In the BlenderMCP sidebar panel, make sure "Connect to MCP server" is active.',
        'Check that a firewall is not blocking the connection on this port.',
        'Retry — transient timeouts often clear on the next attempt.',
      ],
    };
  }

  // Connection actively refused — nothing is listening on that host:port.
  if (lower.includes('econnrefused') || lower.includes('connection refused')) {
    // A non-default port + refusal most often means a port mismatch.
    if (ctx.port !== DEFAULT_BLENDER_PORT) {
      return {
        mode: 'wrong-port',
        title: 'Wrong port',
        summary: `Nothing is listening on port ${ctx.port}. The Blender MCP addon usually serves on port ${DEFAULT_BLENDER_PORT}.`,
        steps: [
          portHint,
          `Set the port here to ${DEFAULT_BLENDER_PORT} unless you deliberately changed it in the addon.`,
          'In the BlenderMCP sidebar panel, verify the port matches and the server is started.',
          'Then retry the connection.',
        ],
        addonInstallUrl: BLENDER_ADDON_REPO_URL,
      };
    }
    return {
      mode: 'not-running',
      title: "Blender isn't running",
      summary:
        'Nothing accepted the connection. Blender is probably closed, or the MCP addon server has not been started.',
      steps: [
        'Launch Blender if it is not already open.',
        'In the 3D Viewport sidebar (press N) ▸ BlenderMCP tab, click "Connect to MCP server".',
        portHint,
        'Then retry the connection here.',
      ],
      addonInstallUrl: BLENDER_ADDON_REPO_URL,
    };
  }

  // Unrecognized — surface the raw error but still give a checklist.
  return {
    mode: 'unknown',
    title: 'Could not connect to Blender',
    summary: raw
      ? `Unexpected error: ${raw}`
      : 'PoF is not connected to Blender. Start Blender and the MCP addon server, then connect.',
    steps: [
      'Make sure Blender is open with the MCP addon installed and enabled.',
      'Start the addon server from the BlenderMCP sidebar panel.',
      `Verify the host and port (default localhost:${DEFAULT_BLENDER_PORT}).`,
      'Retry the connection.',
    ],
  };
}
