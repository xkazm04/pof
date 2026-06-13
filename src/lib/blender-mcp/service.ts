import net from 'net';
import { ok, err, type Result } from '@/types/result';
import { logger } from '@/lib/logger';
import { UI_TIMEOUTS } from '@/lib/constants';
import type {
  BlenderCommand,
  BlenderConnection,
  BlenderResponse,
  SceneInfo,
  ObjectInfo,
  ExecuteOutput,
  AssetResult,
  AssetSource,
  ImportedObject,
  JobResult,
  JobStatusResult,
  GenerationProvider,
} from './types';
import { DEFAULT_BLENDER_HOST, DEFAULT_BLENDER_PORT } from './types';

/**
 * Per-provider Blender addon command names. Keeping the create/poll/import
 * verbs for each generation provider in one map makes the branching explicit
 * and means a new provider only touches this table.
 */
const PROVIDER_COMMANDS: Record<
  GenerationProvider,
  { create: string; poll: string; import: string }
> = {
  hyper3d: {
    create: 'create_rodin_job',
    poll: 'poll_rodin_job_status',
    import: 'import_generated_asset',
  },
  hunyuan3d: {
    create: 'create_hunyuan_job',
    poll: 'poll_hunyuan_job_status',
    import: 'import_generated_asset_hunyuan',
  },
};

class BlenderMCPService {
  private socket: net.Socket | null = null;
  /**
   * Bumped on every teardown. Commands queued on the chain capture the epoch
   * at enqueue time and are DISCARDED if it changed before they run — without
   * this, entries queued behind a wedged command survive a disconnect and
   * execute against the next connection's socket (head-of-line stalls on
   * reconnect, plus a fresh cross-wire surface).
   */
  private epoch = 0;
  private connection: BlenderConnection = {
    host: DEFAULT_BLENDER_HOST,
    port: DEFAULT_BLENDER_PORT,
    connected: false,
  };

  // ── Connection ──────────────────────────────────────────────────────────

  async connect(
    host?: string,
    port?: number,
  ): Promise<Result<BlenderConnection, string>> {
    const h = host ?? DEFAULT_BLENDER_HOST;
    const p = port ?? DEFAULT_BLENDER_PORT;

    if (this.socket) {
      this.disconnect();
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        this.connection = { host: h, port: p, connected: false };
        resolve(err(`Connection to ${h}:${p} timed out`));
      }, UI_TIMEOUTS.blenderTcpTimeout);

      socket.connect(p, h, async () => {
        clearTimeout(timer);
        this.socket = socket;
        this.connection = { host: h, port: p, connected: true };

        // Health check — get scene info to verify addon is responsive
        const check = await this.getSceneInfo();
        if (!check.ok) {
          this.disconnect();
          resolve(
            err(`Connected but addon not responding: ${check.error}`),
          );
          return;
        }

        logger.info(`[BlenderMCP] Connected to Blender at ${h}:${p}`);
        resolve(ok(this.connection));
      });

      socket.on('error', (e) => {
        clearTimeout(timer);
        this.connection = { host: h, port: p, connected: false };
        resolve(err(`Connection failed: ${e.message}`));
      });

      socket.on('close', () => {
        this.connection = { ...this.connection, connected: false };
        this.socket = null;
      });
    });
  }

  disconnect(): void {
    this.epoch++;
    // Fresh chain: a reconnect's health check must not queue behind stale
    // commands. Entries still on the old chain are epoch-discarded.
    this.commandChain = Promise.resolve();
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connection = { ...this.connection, connected: false };
  }

  getStatus(): BlenderConnection {
    return { ...this.connection };
  }

  // ── Low-level TCP send/receive ──────────────────────────────────────────

  /** Serializes socket I/O so only one command is ever outstanding at a time. */
  private commandChain: Promise<unknown> = Promise.resolve();

  /**
   * Serialize every command on the shared socket. The wire protocol has no
   * request/response correlation (no id, no length prefix), so two concurrent
   * callers would each attach a `data` listener to the same socket and whichever
   * parsed first could resolve with the *other* command's bytes. Chaining each
   * command after the previous one settles guarantees exactly one outstanding
   * request at a time, which makes the cross-wire impossible.
   */
  private sendCommand(
    command: BlenderCommand,
  ): Promise<Result<unknown, string>> {
    const epoch = this.epoch;
    const run = this.commandChain
      .catch(() => undefined)
      .then(() => {
        // The connection was torn down while this command sat in the queue —
        // running it now would target a different socket than the caller saw.
        if (epoch !== this.epoch) {
          return err('Connection was reset while this command was queued — retry');
        }
        return this.sendCommandRaw(command);
      });
    // Keep the chain alive regardless of this command's outcome.
    this.commandChain = run.catch(() => undefined);
    return run;
  }

  private sendCommandRaw(
    command: BlenderCommand,
  ): Promise<Result<unknown, string>> {
    return new Promise((resolve) => {
      if (!this.socket || !this.connection.connected) {
        resolve(err('Not connected to Blender'));
        return;
      }

      const socket = this.socket;
      let buffer = '';
      let settled = false;

      // ── Incremental parse-readiness gate ──────────────────────────────────
      // The wire protocol has no length prefix, so a large response (e.g. a
      // base64 screenshot) arrives split across many TCP chunks. Re-running
      // JSON.parse on the full accumulated buffer for every chunk is O(n²) over
      // the payload. Instead we scan only the *newly arrived* bytes, tracking
      // structural brace/bracket depth (skipping anything inside JSON string
      // literals, honoring escapes). A complete top-level value is exactly when
      // depth returns to 0 after the first structural char, so we attempt
      // JSON.parse only then — turning the work into a single O(n) scan plus one
      // parse. This is purely a gate: it cannot accept an incomplete object
      // (depth would still be > 0) and cannot reject a complete one (depth hits
      // 0 precisely at the closing brace/bracket), so behavior is unchanged.
      let depth = 0;
      let inString = false;
      let escaped = false;
      let sawStructure = false;
      let scanPos = 0;
      const settle = (result: Result<unknown, string>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.removeListener('data', onData);
        socket.removeListener('close', onClose);
        socket.removeListener('error', onError);
        resolve(result);
      };

      const timer = setTimeout(() => {
        // The single-threaded addon may still flush a LATE response for this
        // command; the protocol has no request id, so those bytes would parse
        // as the NEXT command's response — a permanent off-by-one desync.
        // Poison the connection: tear it down so the stale bytes die with the
        // socket, and queued commands fail fast (epoch bump) instead of
        // silently consuming wrong data.
        settle(err('Command timed out — connection reset to avoid response desync; reconnect to continue'));
        this.disconnect();
      }, UI_TIMEOUTS.blenderTcpTimeout);

      // A wedged in-flight command must not hold the queue for the full
      // timeout when the socket dies — fail it the moment the socket does.
      const onClose = () => settle(err('Connection closed while command was in flight'));
      const onError = (e: Error) => settle(err(`Socket error: ${e.message}`));

      const onData = (chunk: Buffer) => {
        buffer += chunk.toString('utf-8');

        // Advance the structural scan over only the bytes we haven't seen yet.
        let ready = false;
        for (; scanPos < buffer.length; scanPos++) {
          const c = buffer[scanPos];
          if (inString) {
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') inString = false;
            continue;
          }
          if (c === '"') {
            inString = true;
          } else if (c === '{' || c === '[') {
            depth++;
            sawStructure = true;
          } else if (c === '}' || c === ']') {
            depth--;
            // Top-level value just closed — the buffer plausibly holds one
            // complete JSON object/array. Anything before the first structural
            // char (e.g. leading whitespace) leaves sawStructure false.
            if (depth === 0 && sawStructure) {
              ready = true;
              scanPos++; // include this char before breaking out
              break;
            }
          }
        }

        // Only attempt the (potentially expensive) parse once the structure is
        // balanced. An incomplete buffer never reaches depth 0, so we simply
        // wait for more data exactly as before — just without the wasted parse.
        if (!ready) return;
        try {
          const response: BlenderResponse = JSON.parse(buffer);
          if (response.status === 'error') {
            settle(err(response.message));
          } else {
            settle(ok(response.result));
          }
        } catch {
          // Balanced braces but not yet valid JSON (e.g. trailing bytes still
          // in flight). Keep waiting; the next chunk re-evaluates from here.
        }
      };

      socket.on('data', onData);
      socket.on('close', onClose);
      socket.on('error', onError);

      const payload = JSON.stringify(command);
      socket.write(payload, 'utf-8', (writeErr) => {
        if (writeErr) {
          settle(err(`Write failed: ${writeErr.message}`));
        }
      });
    });
  }

  // ── Core tools ──────────────────────────────────────────────────────────

  async getSceneInfo(): Promise<Result<SceneInfo, string>> {
    const result = await this.sendCommand({ type: 'get_scene_info' });
    if (!result.ok) return result;
    return ok(result.data as SceneInfo);
  }

  async getObjectInfo(name: string): Promise<Result<ObjectInfo, string>> {
    const result = await this.sendCommand({
      type: 'get_object_info',
      params: { name },
    });
    if (!result.ok) return result;
    return ok(result.data as ObjectInfo);
  }

  async executeCode(code: string): Promise<Result<ExecuteOutput, string>> {
    if (!code.trim()) return err('Code cannot be empty');
    if (code.length > 100_000) return err('Code exceeds 100KB limit');
    const result = await this.sendCommand({
      type: 'execute_code',
      params: { code },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({
      output:
        typeof data?.output === 'string'
          ? data.output
          : JSON.stringify(data),
    });
  }

  async getViewportScreenshot(): Promise<Result<string, string>> {
    const result = await this.sendCommand({
      type: 'get_viewport_screenshot',
      params: { max_size: 800, format: 'png' },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok(
      typeof data?.screenshot === 'string' ? data.screenshot : '',
    );
  }

  // ── Response mapping helpers ────────────────────────────────────────────

  /** Map a raw addon response to an ImportedObject, falling back to an id. */
  private toImportedObject(raw: unknown, fallbackId: string): ImportedObject {
    const data = raw as Record<string, unknown>;
    return {
      objectName: String(data?.objectName ?? data?.name ?? fallbackId),
    };
  }

  /** Map a raw addon asset list to AssetResults stamped with their source. */
  private mapAssetResults(raw: unknown, source: AssetSource): AssetResult[] {
    if (!Array.isArray(raw)) return [];
    return (raw as Record<string, unknown>[]).map((a) => ({
      id: String(a.id ?? ''),
      name: String(a.name ?? ''),
      source,
      category: String(a.category ?? ''),
      thumbnailUrl: a.thumbnailUrl as string | undefined,
    }));
  }

  /** Send a job-creation command and map the response to a JobResult. */
  private async createJob(
    type: string,
    prompt: string,
  ): Promise<Result<JobResult, string>> {
    const result = await this.sendCommand({ type, params: { prompt } });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({
      jobId: String(data?.jobId ?? ''),
      status: 'pending',
    });
  }

  // ── Asset sourcing ──────────────────────────────────────────────────────

  async searchPolyHaven(
    query: string,
    category?: string,
  ): Promise<Result<AssetResult[], string>> {
    const params: Record<string, unknown> = { asset_type: 'all' };
    if (category) params.categories = category;
    if (query) params.search = query;
    const result = await this.sendCommand({
      type: 'search_polyhaven_assets',
      params,
    });
    if (!result.ok) return result;
    return ok(this.mapAssetResults(result.data, 'polyhaven'));
  }

  async downloadPolyHaven(
    assetId: string,
    resolution = '1k',
  ): Promise<Result<ImportedObject, string>> {
    const result = await this.sendCommand({
      type: 'download_polyhaven_asset',
      params: { asset_id: assetId, resolution },
    });
    if (!result.ok) return result;
    return ok(this.toImportedObject(result.data, assetId));
  }

  async searchSketchfab(
    query: string,
  ): Promise<Result<AssetResult[], string>> {
    const result = await this.sendCommand({
      type: 'search_sketchfab_models',
      params: { query, downloadable: true },
    });
    if (!result.ok) return result;
    return ok(this.mapAssetResults(result.data, 'sketchfab'));
  }

  async downloadSketchfab(
    modelId: string,
  ): Promise<Result<ImportedObject, string>> {
    const result = await this.sendCommand({
      type: 'download_sketchfab_model',
      params: { model_id: modelId },
    });
    if (!result.ok) return result;
    return ok(this.toImportedObject(result.data, modelId));
  }

  // ── Generation ──────────────────────────────────────────────────────────

  async generateHyper3D(
    prompt: string,
  ): Promise<Result<JobResult, string>> {
    return this.createJob(PROVIDER_COMMANDS.hyper3d.create, prompt);
  }

  async generateHunyuan3D(
    prompt: string,
  ): Promise<Result<JobResult, string>> {
    return this.createJob(PROVIDER_COMMANDS.hunyuan3d.create, prompt);
  }

  async pollJobStatus(
    jobId: string,
    provider: GenerationProvider,
  ): Promise<Result<JobStatusResult, string>> {
    const result = await this.sendCommand({
      type: PROVIDER_COMMANDS[provider].poll,
      params: { job_id: jobId },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({
      jobId,
      status:
        (data?.status as JobStatusResult['status']) ?? 'pending',
      progress: Number(data?.progress ?? 0),
      resultUrl: data?.resultUrl as string | undefined,
    });
  }

  async importGeneratedAsset(
    jobId: string,
    provider: GenerationProvider,
  ): Promise<Result<ImportedObject, string>> {
    const result = await this.sendCommand({
      type: PROVIDER_COMMANDS[provider].import,
      params: { job_id: jobId },
    });
    if (!result.ok) return result;
    return ok(this.toImportedObject(result.data, jobId));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: BlenderMCPService | null = null;

export function getService(): BlenderMCPService {
  if (!instance) instance = new BlenderMCPService();
  return instance;
}

/** Reset singleton — used in tests only. */
export function resetService(): void {
  instance = null;
}
