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
  ImportedObject,
  JobResult,
  JobStatusResult,
  GenerationProvider,
} from './types';
import { DEFAULT_BLENDER_HOST, DEFAULT_BLENDER_PORT } from './types';

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

  private sendCommand(
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
    const raw = result.data as Record<string, unknown>[];
    const assets: AssetResult[] = Array.isArray(raw)
      ? raw.map((a) => ({
          id: String(a.id ?? ''),
          name: String(a.name ?? ''),
          source: 'polyhaven' as const,
          category: String(a.category ?? ''),
          thumbnailUrl: a.thumbnailUrl as string | undefined,
        }))
      : [];
    return ok(assets);
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
    const data = result.data as Record<string, unknown>;
    return ok({
      objectName: String(data?.objectName ?? data?.name ?? assetId),
    });
  }

  async searchSketchfab(
    query: string,
  ): Promise<Result<AssetResult[], string>> {
    const result = await this.sendCommand({
      type: 'search_sketchfab_models',
      params: { query, downloadable: true },
    });
    if (!result.ok) return result;
    const raw = result.data as Record<string, unknown>[];
    const assets: AssetResult[] = Array.isArray(raw)
      ? raw.map((a) => ({
          id: String(a.id ?? ''),
          name: String(a.name ?? ''),
          source: 'sketchfab' as const,
          category: String(a.category ?? ''),
          thumbnailUrl: a.thumbnailUrl as string | undefined,
        }))
      : [];
    return ok(assets);
  }

  async downloadSketchfab(
    modelId: string,
  ): Promise<Result<ImportedObject, string>> {
    const result = await this.sendCommand({
      type: 'download_sketchfab_model',
      params: { model_id: modelId },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({
      objectName: String(data?.objectName ?? data?.name ?? modelId),
    });
  }

  // ── Generation ──────────────────────────────────────────────────────────

  async generateHyper3D(
    prompt: string,
  ): Promise<Result<JobResult, string>> {
    const result = await this.sendCommand({
      type: 'create_rodin_job',
      params: { prompt },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({
      jobId: String(data?.jobId ?? ''),
      status: 'pending',
    });
  }

  async generateHunyuan3D(
    prompt: string,
  ): Promise<Result<JobResult, string>> {
    const result = await this.sendCommand({
      type: 'create_hunyuan_job',
      params: { prompt },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({
      jobId: String(data?.jobId ?? ''),
      status: 'pending',
    });
  }

  async pollJobStatus(
    jobId: string,
    provider: GenerationProvider,
  ): Promise<Result<JobStatusResult, string>> {
    const type =
      provider === 'hyper3d'
        ? 'poll_rodin_job_status'
        : 'poll_hunyuan_job_status';
    const result = await this.sendCommand({
      type,
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
    const type =
      provider === 'hyper3d'
        ? 'import_generated_asset'
        : 'import_generated_asset_hunyuan';
    const result = await this.sendCommand({
      type,
      params: { job_id: jobId },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({
      objectName: String(data?.objectName ?? data?.name ?? jobId),
    });
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
