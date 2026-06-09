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
    const run = this.commandChain
      .catch(() => undefined)
      .then(() => this.sendCommandRaw(command));
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
      const timer = setTimeout(() => {
        socket.removeListener('data', onData);
        resolve(err('Command timed out'));
      }, UI_TIMEOUTS.blenderTcpTimeout);

      const onData = (chunk: Buffer) => {
        buffer += chunk.toString('utf-8');
        try {
          const response: BlenderResponse = JSON.parse(buffer);
          clearTimeout(timer);
          socket.removeListener('data', onData);

          if (response.status === 'error') {
            resolve(err(response.message));
          } else {
            resolve(ok(response.result));
          }
        } catch {
          // Incomplete JSON — wait for more data
        }
      };

      socket.on('data', onData);

      const payload = JSON.stringify(command);
      socket.write(payload, 'utf-8', (writeErr) => {
        if (writeErr) {
          clearTimeout(timer);
          socket.removeListener('data', onData);
          resolve(err(`Write failed: ${writeErr.message}`));
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
