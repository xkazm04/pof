/**
 * PoF Bridge HTTP Client
 *
 * Communicates with the PillarsOfFortuneBridge UE5 companion plugin over HTTP.
 * All methods return Result<T, string> for explicit success/failure handling.
 *
 * PoF Bridge API reference:
 *   GET  /pof/status                — plugin status & version
 *   GET  /pof/manifest              — full asset manifest (or ?checksum-only=true)
 *   GET  /pof/manifest/blueprint    — single blueprint by ?path=...
 *   POST /pof/test/run              — run a test spec
 *   GET  /pof/test/results          — all test results (or /{testId})
 *   POST /pof/test/run-automation   — run UE5 automation tests
 *   POST /pof/snapshot/capture      — capture snapshot presets
 *   POST /pof/snapshot/baseline     — save baseline snapshots
 *   GET  /pof/snapshot/diff         — get snapshot diff report
 *   POST /pof/compile/live          — trigger live coding compile
 *   GET  /pof/compile/status        — get current compile status
 */

import { type Result } from '@/types/result';
import { UI_TIMEOUTS } from '@/lib/constants';
import { bridgeRequest } from '@/lib/ue5-bridge/shared';
import type {
  PofBridgeStatus,
  AssetManifest,
  BlueprintEntry,
  PofTestSpec,
  PofTestResult,
  PofSnapshotCaptureRequest,
  PofSnapshotDiffReport,
  PofCompileRequest,
  PofCompileResult,
  PofCompileStatus,
} from '@/types/pof-bridge';

// ── Client ──────────────────────────────────────────────────────────────────

export class PofBridgeClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly authToken: string | null;

  constructor(host: string, port: number, authToken?: string) {
    this.baseUrl = `http://${host}:${port}`;
    this.timeout = UI_TIMEOUTS.pofHttpTimeout;
    this.authToken = authToken ?? null;
  }

  // ── Core HTTP helper ──────────────────────────────────────────────────────

  private request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<Result<T, string>> {
    return bridgeRequest<T>(this.baseUrl, {
      method,
      path,
      body,
      timeout: this.timeout,
      label: 'PoF Bridge',
      logPrefix: '[PoF-Bridge]',
      headers: this.authToken ? { 'X-Pof-Auth-Token': this.authToken } : undefined,
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Ping the PoF Bridge plugin and return status info. */
  async getStatus(): Promise<Result<PofBridgeStatus, string>> {
    return this.request<PofBridgeStatus>('GET', '/pof/status');
  }

  /** Fetch the full asset manifest, or just the checksum for change detection. */
  async getManifest(checksumOnly?: boolean): Promise<Result<AssetManifest, string>> {
    const path = checksumOnly ? '/pof/manifest?checksum-only=true' : '/pof/manifest';
    return this.request<AssetManifest>('GET', path);
  }

  /** Fetch a single blueprint entry by asset path. */
  async getBlueprint(assetPath: string): Promise<Result<BlueprintEntry, string>> {
    const encoded = encodeURIComponent(assetPath);
    return this.request<BlueprintEntry>('GET', `/pof/manifest/blueprint?path=${encoded}`);
  }

  /** Submit a test spec for execution in the UE5 editor. */
  async runTest(spec: PofTestSpec): Promise<Result<PofTestResult, string>> {
    return this.request<PofTestResult>('POST', '/pof/test/run', spec);
  }

  /** Retrieve test results. If testId is provided, returns a single result. */
  async getTestResults(testId?: string): Promise<Result<PofTestResult | PofTestResult[], string>> {
    const path = testId ? `/pof/test/results/${encodeURIComponent(testId)}` : '/pof/test/results';
    return this.request<PofTestResult | PofTestResult[]>('GET', path);
  }

  /** Run UE5 automation tests matching a filter string. */
  async runAutomationTests(
    filter: string,
    flags?: string[],
  ): Promise<Result<PofTestResult[], string>> {
    return this.request<PofTestResult[]>('POST', '/pof/test/run-automation', {
      filter,
      flags: flags ?? [],
    });
  }

  /** Capture snapshots for the specified camera presets. */
  async captureSnapshots(
    req: PofSnapshotCaptureRequest,
  ): Promise<Result<PofSnapshotDiffReport, string>> {
    return this.request<PofSnapshotDiffReport>('POST', '/pof/snapshot/capture', req);
  }

  /** Save current captures as baseline for the specified presets. */
  async saveBaseline(presetIds: string[]): Promise<Result<{ saved: number }, string>> {
    return this.request<{ saved: number }>('POST', '/pof/snapshot/baseline', { presetIds });
  }

  /** Get the latest snapshot diff report. */
  async getSnapshotDiff(): Promise<Result<PofSnapshotDiffReport, string>> {
    return this.request<PofSnapshotDiffReport>('GET', '/pof/snapshot/diff');
  }

  /** Trigger a live coding compile (hot-reload). */
  async triggerLiveCoding(req?: PofCompileRequest): Promise<Result<PofCompileResult, string>> {
    return this.request<PofCompileResult>('POST', '/pof/compile/live', req ?? {});
  }

  /** Poll the current compile status. */
  async getCompileStatus(): Promise<Result<PofCompileStatus, string>> {
    return this.request<PofCompileStatus>('GET', '/pof/compile/status');
  }
}
