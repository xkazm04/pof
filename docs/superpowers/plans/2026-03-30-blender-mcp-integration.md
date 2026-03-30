# Blender MCP Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Blender MCP into PoF's visual-gen and content modules, enabling real 3D asset creation, material authoring, procedural export, and scene composition through a running Blender instance.

**Architecture:** Next.js API route proxy. A singleton `BlenderMCPService` manages a TCP socket to Blender's MCP addon (port 9876). Modules call `/api/blender-mcp/*` endpoints using the existing `apiFetch`/`tryApiFetch` pattern. A shared Zustand store tracks connection state. All service methods return `Result<T, string>`.

**Tech Stack:** Node.js `net` module (TCP), Next.js App Router API routes, Zustand v5 with persist, React 19, TypeScript template functions generating Blender Python code.

**Spec:** `docs/superpowers/specs/2026-03-30-blender-mcp-integration-design.md`

---

## Phase A — Infrastructure

### Task 1: UI_TIMEOUTS Constants

**Files:**
- Modify: `src/lib/constants.ts:87` (add entries before closing `as const`)

- [ ] **Step 1: Add Blender timing constants**

Add these entries just before the closing `} as const;` in `src/lib/constants.ts`:

```typescript
  /** Blender MCP TCP operation timeout. */
  blenderTcpTimeout: 30_000,
  /** Blender connection health check interval. */
  blenderHealthCheck: 15_000,
  /** Base delay for Blender reconnection attempts. */
  blenderReconnectBase: 2_000,
  /** Maximum delay between Blender reconnection attempts. */
  blenderReconnectMax: 30_000,
  /** Polling interval for Blender generation jobs. */
  blenderGenPollInterval: 5_000,
  /** Debounce delay for viewport screenshot requests. */
  blenderScreenshotDebounce: 500,
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat(blender-mcp): add UI_TIMEOUTS entries for Blender timing"
```

---

### Task 2: Blender MCP Types

**Files:**
- Create: `src/lib/blender-mcp/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/blender-mcp/types.ts

// ─── Connection ─────────────────────────────────────────────────────────────

export interface BlenderConnection {
  host: string;
  port: number;
  connected: boolean;
  blenderVersion?: string;
}

export const DEFAULT_BLENDER_HOST = 'localhost';
export const DEFAULT_BLENDER_PORT = 9876;

// ─── TCP Protocol ───────────────────────────────────────────────────────────
// Wire format for Blender MCP addon (ahujasid/blender-mcp addon.py).
// Raw JSON over TCP, try-parse framing (no delimiter, no length prefix).

export interface BlenderCommand {
  type: string;
  params?: Record<string, unknown>;
}

export interface BlenderSuccessResponse {
  status: 'success';
  result: unknown;
}

export interface BlenderErrorResponse {
  status: 'error';
  message: string;
}

export type BlenderResponse = BlenderSuccessResponse | BlenderErrorResponse;

// ─── Scene ──────────────────────────────────────────────────────────────────

export interface ObjectSummary {
  name: string;
  type: string;
  location: [number, number, number];
  visible: boolean;
}

export interface ObjectInfo extends ObjectSummary {
  rotation: [number, number, number];
  scale: [number, number, number];
  modifiers: string[];
  materials: string[];
}

export interface SceneInfo {
  objects: ObjectSummary[];
  activeObject?: string;
  collections: string[];
  frameRange: [number, number];
}

// ─── Execution ──────────────────────────────────────────────────────────────

export interface ExecuteOutput {
  output: string;
}

// ─── Assets ─────────────────────────────────────────────────────────────────

export type AssetSource = 'polyhaven' | 'sketchfab';

export interface AssetResult {
  id: string;
  name: string;
  source: AssetSource;
  category: string;
  thumbnailUrl?: string;
}

export interface ImportedObject {
  objectName: string;
}

// ─── Generation ─────────────────────────────────────────────────────────────

export type GenerationProvider = 'hyper3d' | 'hunyuan3d';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobResult {
  jobId: string;
  status: 'pending' | 'processing';
}

export interface JobStatusResult {
  jobId: string;
  status: JobStatus;
  progress: number;
  resultUrl?: string;
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `blender-mcp/types.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/blender-mcp/types.ts
git commit -m "feat(blender-mcp): add type definitions for Blender MCP protocol"
```

---

### Task 3: BlenderMCPService — TCP Client

**Files:**
- Create: `src/lib/blender-mcp/service.ts`
- Create: `src/__tests__/lib/blender-mcp/service.test.ts`

- [ ] **Step 1: Write failing tests for the TCP service**

```typescript
// src/__tests__/lib/blender-mcp/service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import net from 'net';

// We'll test the service against a local mock TCP server
function createMockBlenderServer(handler: (data: string) => string): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        try {
          JSON.parse(buffer);
          const response = handler(buffer);
          buffer = '';
          socket.write(response);
        } catch { /* incomplete JSON, wait for more */ }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({ server, port: addr.port });
    });
  });
}

describe('BlenderMCPService', () => {
  let mockServer: net.Server;
  let mockPort: number;

  afterEach(async () => {
    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    svc.disconnect();
    await new Promise<void>((r) => mockServer?.close(() => r()));
  });

  it('connects to Blender addon and returns scene info', async () => {
    const sceneData = {
      objects: [{ name: 'Cube', type: 'MESH', location: [0, 0, 0], visible: true }],
      activeObject: 'Cube',
      collections: ['Collection'],
      frameRange: [1, 250],
    };

    ({ server: mockServer, port: mockPort } = await createMockBlenderServer((data) => {
      const cmd = JSON.parse(data);
      if (cmd.type === 'get_scene_info') {
        return JSON.stringify({ status: 'success', result: sceneData });
      }
      return JSON.stringify({ status: 'error', message: 'Unknown command' });
    }));

    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    const connResult = await svc.connect('127.0.0.1', mockPort);
    expect(connResult.ok).toBe(true);

    const sceneResult = await svc.getSceneInfo();
    expect(sceneResult.ok).toBe(true);
    if (sceneResult.ok) {
      expect(sceneResult.data.objects).toHaveLength(1);
      expect(sceneResult.data.objects[0].name).toBe('Cube');
    }
  });

  it('returns error Result on connection failure', async () => {
    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    // Port 1 is almost certainly not running a Blender addon
    const result = await svc.connect('127.0.0.1', 1);
    expect(result.ok).toBe(false);
  });

  it('executes arbitrary Python code', async () => {
    ({ server: mockServer, port: mockPort } = await createMockBlenderServer((data) => {
      const cmd = JSON.parse(data);
      if (cmd.type === 'execute_code') {
        return JSON.stringify({ status: 'success', result: { output: 'Created cube' } });
      }
      return JSON.stringify({ status: 'error', message: 'Unknown' });
    }));

    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    await svc.connect('127.0.0.1', mockPort);

    const result = await svc.executeCode('bpy.ops.mesh.primitive_cube_add()');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.output).toBe('Created cube');
    }
  });

  it('returns error when Blender reports error status', async () => {
    ({ server: mockServer, port: mockPort } = await createMockBlenderServer(() => {
      return JSON.stringify({ status: 'error', message: 'NameError: name "foo" is not defined' });
    }));

    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    await svc.connect('127.0.0.1', mockPort);

    const result = await svc.executeCode('foo()');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('NameError');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/lib/blender-mcp/service.test.ts`
Expected: FAIL — module `@/lib/blender-mcp/service` not found

- [ ] **Step 3: Implement BlenderMCPService**

```typescript
// src/lib/blender-mcp/service.ts
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
  AssetSource,
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

  async connect(host?: string, port?: number): Promise<Result<BlenderConnection, string>> {
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
          resolve(err(`Connected but addon not responding: ${check.error}`));
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

  private sendCommand(command: BlenderCommand): Promise<Result<unknown, string>> {
    return new Promise((resolve) => {
      if (!this.socket || !this.connection.connected) {
        resolve(err('Not connected to Blender'));
        return;
      }

      const socket = this.socket;
      let buffer = '';
      const timer = setTimeout(() => {
        socket.removeAllListeners('data');
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
    const result = await this.sendCommand({ type: 'get_object_info', params: { name } });
    if (!result.ok) return result;
    return ok(result.data as ObjectInfo);
  }

  async executeCode(code: string): Promise<Result<ExecuteOutput, string>> {
    if (!code.trim()) return err('Code cannot be empty');
    if (code.length > 100_000) return err('Code exceeds 100KB limit');
    const result = await this.sendCommand({ type: 'execute_code', params: { code } });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({ output: typeof data?.output === 'string' ? data.output : JSON.stringify(data) });
  }

  async getViewportScreenshot(): Promise<Result<string, string>> {
    const result = await this.sendCommand({
      type: 'get_viewport_screenshot',
      params: { max_size: 800, format: 'png' },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok(typeof data?.screenshot === 'string' ? data.screenshot : '');
  }

  // ── Asset sourcing ──────────────────────────────────────────────────────

  async searchPolyHaven(query: string, category?: string): Promise<Result<AssetResult[], string>> {
    const params: Record<string, unknown> = { asset_type: 'all' };
    if (category) params.categories = category;
    if (query) params.search = query;
    const result = await this.sendCommand({ type: 'search_polyhaven_assets', params });
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

  async downloadPolyHaven(assetId: string, resolution = '1k'): Promise<Result<ImportedObject, string>> {
    const result = await this.sendCommand({
      type: 'download_polyhaven_asset',
      params: { asset_id: assetId, resolution },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({ objectName: String(data?.objectName ?? data?.name ?? assetId) });
  }

  async searchSketchfab(query: string): Promise<Result<AssetResult[], string>> {
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

  async downloadSketchfab(modelId: string): Promise<Result<ImportedObject, string>> {
    const result = await this.sendCommand({
      type: 'download_sketchfab_model',
      params: { model_id: modelId },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({ objectName: String(data?.objectName ?? data?.name ?? modelId) });
  }

  // ── Generation ──────────────────────────────────────────────────────────

  async generateHyper3D(prompt: string): Promise<Result<JobResult, string>> {
    const result = await this.sendCommand({
      type: 'create_rodin_job',
      params: { prompt },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({ jobId: String(data?.jobId ?? ''), status: 'pending' });
  }

  async generateHunyuan3D(prompt: string): Promise<Result<JobResult, string>> {
    const result = await this.sendCommand({
      type: 'create_hunyuan_job',
      params: { prompt },
    });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({ jobId: String(data?.jobId ?? ''), status: 'pending' });
  }

  async pollJobStatus(jobId: string, provider: GenerationProvider): Promise<Result<JobStatusResult, string>> {
    const type = provider === 'hyper3d' ? 'poll_rodin_job_status' : 'poll_hunyuan_job_status';
    const result = await this.sendCommand({ type, params: { job_id: jobId } });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({
      jobId,
      status: (data?.status as JobStatusResult['status']) ?? 'pending',
      progress: Number(data?.progress ?? 0),
      resultUrl: data?.resultUrl as string | undefined,
    });
  }

  async importGeneratedAsset(jobId: string, provider: GenerationProvider): Promise<Result<ImportedObject, string>> {
    const type = provider === 'hyper3d' ? 'import_generated_asset' : 'import_generated_asset_hunyuan';
    const result = await this.sendCommand({ type, params: { job_id: jobId } });
    if (!result.ok) return result;
    const data = result.data as Record<string, unknown>;
    return ok({ objectName: String(data?.objectName ?? data?.name ?? jobId) });
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: BlenderMCPService | null = null;

export function getService(): BlenderMCPService {
  if (!instance) instance = new BlenderMCPService();
  return instance;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/lib/blender-mcp/service.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/blender-mcp/service.ts src/__tests__/lib/blender-mcp/service.test.ts
git commit -m "feat(blender-mcp): implement BlenderMCPService with TCP client and tests"
```

---

### Task 4: Python String Escape Utility

**Files:**
- Create: `src/lib/blender-mcp/escape.ts`

- [ ] **Step 1: Create escape utility**

All Blender Python script templates interpolate user-provided strings (object names, file paths) into Python code. A legitimate name containing `"` or `\` would produce a syntax error. This utility escapes such characters.

```typescript
// src/lib/blender-mcp/escape.ts

/** Escape a string for safe embedding in a Python double-quoted string literal. */
export function py(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
```

All script template functions (Tasks 7-16) must use `py()` to wrap string parameters before interpolation. For example:
```typescript
import { py } from '@/lib/blender-mcp/escape';
// ...
return `obj = bpy.data.objects.get("${py(params.objectName)}")`;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/blender-mcp/escape.ts
git commit -m "feat(blender-mcp): add Python string escape utility for safe interpolation"
```

---

### Task 5: API Routes

**Files:**
- Create: `src/app/api/blender-mcp/route.ts`
- Create: `src/app/api/blender-mcp/scene/route.ts`
- Create: `src/app/api/blender-mcp/execute/route.ts`
- Create: `src/app/api/blender-mcp/screenshot/route.ts`
- Create: `src/app/api/blender-mcp/assets/route.ts`
- Create: `src/app/api/blender-mcp/assets/download/route.ts`
- Create: `src/app/api/blender-mcp/generate/route.ts`
- Create: `src/app/api/blender-mcp/generate/status/route.ts`
- Create: `src/app/api/blender-mcp/generate/import/route.ts`

- [ ] **Step 1: Create connection management route**

```typescript
// src/app/api/blender-mcp/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// POST /api/blender-mcp — { action: 'connect' | 'disconnect' | 'status' }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;
    const svc = getService();

    if (action === 'connect') {
      const result = await svc.connect(body.host, body.port);
      if (!result.ok) return apiError(result.error, 502);
      return apiSuccess({ connection: result.data });
    }

    if (action === 'disconnect') {
      svc.disconnect();
      return apiSuccess({ connection: svc.getStatus() });
    }

    if (action === 'status') {
      return apiSuccess({ connection: svc.getStatus() });
    }

    return apiError('Unknown action', 400);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error', 500);
  }
}
```

- [ ] **Step 2: Create scene info route**

```typescript
// src/app/api/blender-mcp/scene/route.ts
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// GET /api/blender-mcp/scene
export async function GET() {
  const result = await getService().getSceneInfo();
  if (!result.ok) return apiError(result.error, 502);
  return apiSuccess(result.data);
}
```

- [ ] **Step 3: Create object info route**

```typescript
// src/app/api/blender-mcp/object/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// GET /api/blender-mcp/object?name=ObjectName
export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return apiError('name is required', 400);
  const result = await getService().getObjectInfo(name);
  if (!result.ok) return apiError(result.error, 502);
  return apiSuccess(result.data);
}
```

- [ ] **Step 4: Create execute route**

```typescript
// src/app/api/blender-mcp/execute/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// POST /api/blender-mcp/execute — { code: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.code || typeof body.code !== 'string') {
      return apiError('code is required', 400);
    }
    const result = await getService().executeCode(body.code);
    if (!result.ok) return apiError(result.error, 502);
    return apiSuccess(result.data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error', 500);
  }
}
```

- [ ] **Step 4: Create screenshot route**

```typescript
// src/app/api/blender-mcp/screenshot/route.ts
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// GET /api/blender-mcp/screenshot
export async function GET() {
  const result = await getService().getViewportScreenshot();
  if (!result.ok) return apiError(result.error, 502);
  return apiSuccess({ screenshot: result.data });
}
```

- [ ] **Step 5: Create assets search route**

```typescript
// src/app/api/blender-mcp/assets/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { AssetSource } from '@/lib/blender-mcp/types';

// GET /api/blender-mcp/assets?source=polyhaven|sketchfab&query=...&category=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source') as AssetSource | null;
  const query = searchParams.get('query') ?? '';
  const category = searchParams.get('category') ?? undefined;

  const svc = getService();

  if (source === 'sketchfab') {
    const result = await svc.searchSketchfab(query);
    if (!result.ok) return apiError(result.error, 502);
    return apiSuccess({ assets: result.data });
  }

  // Default to polyhaven
  const result = await svc.searchPolyHaven(query, category);
  if (!result.ok) return apiError(result.error, 502);
  return apiSuccess({ assets: result.data });
}
```

- [ ] **Step 6: Create assets download route**

```typescript
// src/app/api/blender-mcp/assets/download/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { AssetSource } from '@/lib/blender-mcp/types';

// POST /api/blender-mcp/assets/download — { source, id, resolution? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const source = body.source as AssetSource;
    const id = body.id as string;

    if (!source || !id) return apiError('source and id are required', 400);

    const svc = getService();

    if (source === 'sketchfab') {
      const result = await svc.downloadSketchfab(id);
      if (!result.ok) return apiError(result.error, 502);
      return apiSuccess(result.data);
    }

    const result = await svc.downloadPolyHaven(id, body.resolution);
    if (!result.ok) return apiError(result.error, 502);
    return apiSuccess(result.data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error', 500);
  }
}
```

- [ ] **Step 7: Create generation routes**

```typescript
// src/app/api/blender-mcp/generate/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { GenerationProvider } from '@/lib/blender-mcp/types';

// POST /api/blender-mcp/generate — { provider, prompt }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const provider = body.provider as GenerationProvider;
    const prompt = body.prompt as string;

    if (!provider || !prompt) return apiError('provider and prompt are required', 400);

    const svc = getService();
    const result = provider === 'hyper3d'
      ? await svc.generateHyper3D(prompt)
      : await svc.generateHunyuan3D(prompt);

    if (!result.ok) return apiError(result.error, 502);
    return apiSuccess(result.data, 201);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error', 500);
  }
}
```

```typescript
// src/app/api/blender-mcp/generate/status/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { GenerationProvider } from '@/lib/blender-mcp/types';

// GET /api/blender-mcp/generate/status?jobId=...&provider=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const provider = searchParams.get('provider') as GenerationProvider | null;

  if (!jobId || !provider) return apiError('jobId and provider are required', 400);

  const result = await getService().pollJobStatus(jobId, provider);
  if (!result.ok) return apiError(result.error, 502);
  return apiSuccess(result.data);
}
```

```typescript
// src/app/api/blender-mcp/generate/import/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { GenerationProvider } from '@/lib/blender-mcp/types';

// POST /api/blender-mcp/generate/import — { jobId, provider }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobId = body.jobId as string;
    const provider = body.provider as GenerationProvider;

    if (!jobId || !provider) return apiError('jobId and provider are required', 400);

    const result = await getService().importGeneratedAsset(jobId, provider);
    if (!result.ok) return apiError(result.error, 502);
    return apiSuccess(result.data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error', 500);
  }
}
```

- [ ] **Step 8: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/app/api/blender-mcp/
git commit -m "feat(blender-mcp): add API routes for all Blender MCP operations"
```

---

### Task 6: Zustand Store

**Files:**
- Create: `src/stores/blenderMCPStore.ts`

- [ ] **Step 1: Create the store**

```typescript
// src/stores/blenderMCPStore.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tryApiFetch } from '@/lib/api-utils';
import type { BlenderConnection } from '@/lib/blender-mcp/types';
import { DEFAULT_BLENDER_HOST, DEFAULT_BLENDER_PORT } from '@/lib/blender-mcp/types';

interface BlenderMCPState {
  // Persisted settings
  host: string;
  port: number;
  autoConnect: boolean;

  // Transient runtime state (reset on rehydration)
  connection: BlenderConnection;
  isConnecting: boolean;
  lastError: string | null;
  recentScreenshots: string[];

  // Actions
  connect: (host?: string, port?: number) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  setSettings: (host: string, port: number, autoConnect: boolean) => void;
  addScreenshot: (dataUrl: string) => void;
  clearScreenshots: () => void;
}

const INITIAL_CONNECTION: BlenderConnection = {
  host: DEFAULT_BLENDER_HOST,
  port: DEFAULT_BLENDER_PORT,
  connected: false,
};

export const useBlenderMCPStore = create<BlenderMCPState>()(
  persist(
    (set, get) => ({
      // Persisted
      host: DEFAULT_BLENDER_HOST,
      port: DEFAULT_BLENDER_PORT,
      autoConnect: false,

      // Transient
      connection: INITIAL_CONNECTION,
      isConnecting: false,
      lastError: null,
      recentScreenshots: [],

      connect: async (host?: string, port?: number) => {
        const h = host ?? get().host;
        const p = port ?? get().port;
        set({ isConnecting: true, lastError: null });

        const result = await tryApiFetch<{ connection: BlenderConnection }>(
          '/api/blender-mcp',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'connect', host: h, port: p }),
          },
        );

        if (result.ok) {
          set({ connection: result.data.connection, isConnecting: false, host: h, port: p });
        } else {
          set({ isConnecting: false, lastError: result.error, connection: { host: h, port: p, connected: false } });
        }
      },

      disconnect: async () => {
        await tryApiFetch('/api/blender-mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'disconnect' }),
        });
        set({ connection: { ...get().connection, connected: false }, lastError: null });
      },

      refreshStatus: async () => {
        const result = await tryApiFetch<{ connection: BlenderConnection }>(
          '/api/blender-mcp',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status' }),
          },
        );
        if (result.ok) {
          set({ connection: result.data.connection });
        }
      },

      setSettings: (host, port, autoConnect) => set({ host, port, autoConnect }),

      addScreenshot: (dataUrl) => {
        set((state) => ({
          recentScreenshots: [dataUrl, ...state.recentScreenshots].slice(0, 3),
        }));
      },

      clearScreenshots: () => set({ recentScreenshots: [] }),
    }),
    {
      name: 'pof-blender-mcp',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        host: state.host,
        port: state.port,
        autoConnect: state.autoConnect,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<BlenderMCPState>) };
        // Reset transient fields on hydration
        merged.connection = INITIAL_CONNECTION;
        merged.isConnecting = false;
        merged.lastError = null;
        merged.recentScreenshots = [];
        return merged;
      },
    },
  ),
);
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/stores/blenderMCPStore.ts
git commit -m "feat(blender-mcp): add Zustand store with persist for connection settings"
```

---

### Task 7: Connection UI Component

**Files:**
- Create: `src/components/blender-mcp/BlenderConnectionBar.tsx`
- Create: `src/components/blender-mcp/ViewportPreview.tsx`

- [ ] **Step 1: Create BlenderConnectionBar**

```typescript
// src/components/blender-mcp/BlenderConnectionBar.tsx
'use client';

import { useState } from 'react';
import { Monitor, Plug, PlugZap, Settings, AlertTriangle } from 'lucide-react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

export function BlenderConnectionBar() {
  const { connection, isConnecting, lastError, host, port, connect, disconnect, setSettings } = useBlenderMCPStore();
  const [showSettings, setShowSettings] = useState(false);
  const [editHost, setEditHost] = useState(host);
  const [editPort, setEditPort] = useState(String(port));

  const handleConnect = () => {
    if (connection.connected) {
      disconnect();
    } else {
      connect(editHost, Number(editPort));
    }
  };

  const handleSaveSettings = () => {
    setSettings(editHost, Number(editPort), false);
    setShowSettings(false);
  };

  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-text-muted" />
          <span className="text-xs font-medium text-text">Blender MCP</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              connection.connected
                ? 'bg-emerald-500/10 text-emerald-400'
                : isConnecting
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-zinc-500/10 text-zinc-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              connection.connected ? 'bg-emerald-400' : isConnecting ? 'bg-amber-400 animate-pulse' : 'bg-zinc-400'
            }`} />
            {connection.connected
              ? `Connected${connection.blenderVersion ? ` (${connection.blenderVersion})` : ''}`
              : isConnecting
                ? 'Connecting...'
                : 'Disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded hover:bg-surface-tertiary text-text-muted hover:text-text transition-colors"
            title="Connection settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              connection.connected
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            } disabled:opacity-50`}
          >
            {connection.connected ? (
              <><Plug className="w-3 h-3" /> Disconnect</>
            ) : (
              <><PlugZap className="w-3 h-3" /> Connect</>
            )}
          </button>
        </div>
      </div>

      {lastError && (
        <div className="flex items-start gap-2 text-[11px] text-red-400 bg-red-500/5 rounded px-2 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{lastError}</span>
        </div>
      )}

      {showSettings && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={editHost}
            onChange={(e) => setEditHost(e.target.value)}
            placeholder="Host"
            className="flex-1 bg-surface-tertiary border border-border rounded px-2 py-1 text-xs text-text"
          />
          <input
            type="number"
            value={editPort}
            onChange={(e) => setEditPort(e.target.value)}
            placeholder="Port"
            className="w-20 bg-surface-tertiary border border-border rounded px-2 py-1 text-xs text-text"
          />
          <button
            onClick={handleSaveSettings}
            className="px-2 py-1 rounded bg-accent/10 text-accent text-xs hover:bg-accent/20"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ViewportPreview component**

```typescript
// src/components/blender-mcp/ViewportPreview.tsx
'use client';

import { useState, useCallback } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

export function ViewportPreview() {
  const { connection, addScreenshot, recentScreenshots } = useBlenderMCPStore();
  const [isCapturing, setIsCapturing] = useState(false);

  const captureScreenshot = useCallback(async () => {
    if (!connection.connected) return;
    setIsCapturing(true);
    const result = await tryApiFetch<{ screenshot: string }>('/api/blender-mcp/screenshot');
    if (result.ok && result.data.screenshot) {
      // Convert base64 to object URL for memory efficiency (per spec)
      const binary = atob(result.data.screenshot);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/png' });
      addScreenshot(URL.createObjectURL(blob));
    }
    setIsCapturing(false);
  }, [connection.connected, addScreenshot]);

  const latestScreenshot = recentScreenshots[0];

  return (
    <div className="rounded-lg border border-border bg-surface-secondary overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-text">Blender Viewport</span>
        <button
          onClick={captureScreenshot}
          disabled={!connection.connected || isCapturing}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-text-muted hover:text-text disabled:opacity-40 transition-colors"
        >
          {isCapturing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Camera className="w-3 h-3" />
          )}
          Capture
        </button>
      </div>
      <div className="aspect-video bg-black/50 flex items-center justify-center">
        {latestScreenshot ? (
          <img src={latestScreenshot} alt="Blender viewport" className="w-full h-full object-contain" />
        ) : (
          <span className="text-xs text-text-muted">
            {connection.connected ? 'Click Capture to preview' : 'Connect to Blender first'}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/blender-mcp/
git commit -m "feat(blender-mcp): add BlenderConnectionBar and ViewportPreview UI components"
```

---

## Phase B — High-Value Integrations

### Task 8: Blender Pipeline Script Templates

**Files:**
- Create: `src/lib/blender-mcp/scripts/convert-fbx.ts`
- Create: `src/lib/blender-mcp/scripts/generate-lods.ts`
- Create: `src/lib/blender-mcp/scripts/optimize-mesh.ts`

- [ ] **Step 1: Create FBX conversion script template**

```typescript
// src/lib/blender-mcp/scripts/convert-fbx.ts
export function convertFbxScript(params: {
  inputPath: string;
  outputPath: string;
  dracoCompression?: boolean;
}): string {
  return `
import bpy
import os

# Clear scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import FBX
bpy.ops.import_scene.fbx(filepath=r"${params.inputPath}")

# Export as glTF
export_settings = {
    "filepath": r"${params.outputPath}",
    "export_format": "GLB",
    "export_draco_mesh_compression_enable": ${params.dracoCompression !== false ? 'True' : 'False'},
}
bpy.ops.export_scene.gltf(**export_settings)

print(f"Converted: ${params.inputPath} -> ${params.outputPath}")
`.trim();
}
```

- [ ] **Step 2: Create LOD generation script template**

```typescript
// src/lib/blender-mcp/scripts/generate-lods.ts
export function generateLodsScript(params: {
  objectName: string;
  lodRatios: number[];  // e.g. [0.5, 0.25, 0.1]
}): string {
  const lodSteps = params.lodRatios
    .map((ratio, i) => `
# LOD ${i + 1} (${Math.round(ratio * 100)}% of original)
lod = obj.copy()
lod.data = obj.data.copy()
lod.name = f"{obj.name}_LOD${i + 1}"
bpy.context.collection.objects.link(lod)
bpy.context.view_layer.objects.active = lod
mod = lod.modifiers.new(name="Decimate", type='DECIMATE')
mod.ratio = ${ratio}
bpy.ops.object.modifier_apply(modifier=mod.name)
lod.location.x += ${(i + 1) * 3}
print(f"  LOD${i + 1}: {len(lod.data.polygons)} faces ({${ratio} * 100:.0f}%)")
`)
    .join('\n');

  return `
import bpy

obj = bpy.data.objects.get("${params.objectName}")
if not obj or obj.type != 'MESH':
    raise ValueError("Object '${params.objectName}' not found or not a mesh")

print(f"Generating LODs for {obj.name} ({len(obj.data.polygons)} faces)")
${lodSteps}
print("LOD generation complete")
`.trim();
}
```

- [ ] **Step 3: Create mesh optimization script template**

```typescript
// src/lib/blender-mcp/scripts/optimize-mesh.ts
export function optimizeMeshScript(params: {
  objectName: string;
  removeDoubles?: boolean;
  recalcNormals?: boolean;
  mergeDistance?: number;
}): string {
  const mergeDistance = params.mergeDistance ?? 0.0001;
  return `
import bpy

obj = bpy.data.objects.get("${params.objectName}")
if not obj or obj.type != 'MESH':
    raise ValueError("Object '${params.objectName}' not found or not a mesh")

bpy.context.view_layer.objects.active = obj
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')

initial_verts = len(obj.data.vertices)

${params.removeDoubles !== false ? `# Remove doubles
bpy.ops.mesh.remove_doubles(threshold=${mergeDistance})` : '# Skip remove doubles'}

${params.recalcNormals !== false ? `# Recalculate normals
bpy.ops.mesh.normals_make_consistent(inside=False)` : '# Skip recalculate normals'}

bpy.ops.object.mode_set(mode='OBJECT')

final_verts = len(obj.data.vertices)
print(f"Optimized {obj.name}: {initial_verts} -> {final_verts} vertices (removed {initial_verts - final_verts})")
`.trim();
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/blender-mcp/scripts/
git commit -m "feat(blender-mcp): add Blender Python script templates for pipeline operations"
```

---

### Task 9: Wire blender-pipeline Module

**Files:**
- Modify: `src/components/modules/visual-gen/blender-pipeline/BlenderSetup.tsx`
- Modify: `src/components/modules/visual-gen/blender-pipeline/ScriptRunner.tsx`
- Modify: `src/components/modules/visual-gen/blender-pipeline/BlenderPipelineView.tsx`
- Modify: `src/components/modules/visual-gen/blender-pipeline/useBlenderStore.ts`

- [ ] **Step 1: Update BlenderSetup to use MCP connection**

Replace the Blender path detection UI in `BlenderSetup.tsx` with the `BlenderConnectionBar` component. Keep the component wrapper but replace its contents:

```typescript
// Replace the inner content of BlenderSetup.tsx
// Import at top:
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { ViewportPreview } from '@/components/blender-mcp/ViewportPreview';

// In the component return, replace path detection with:
// <BlenderConnectionBar />
// <ViewportPreview />
```

Read the current `BlenderSetup.tsx` and replace the Blender path detection section with `<BlenderConnectionBar />` and add `<ViewportPreview />` below it. Keep the outer container styling.

- [ ] **Step 2: Update ScriptRunner to execute via MCP**

Update `ScriptRunner.tsx` to use `tryApiFetch('/api/blender-mcp/execute', ...)` instead of spawning a subprocess. The existing `useBlenderStore.scripts` job tracking remains — just change the execution backend.

In the run handler, replace the subprocess spawn with:
```typescript
import { tryApiFetch } from '@/lib/api-utils';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';

// In the execute handler:
const result = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: scriptCode }),
});
if (result.ok) {
  updateScript(jobId, { status: 'completed', output: result.data.output });
} else {
  updateScript(jobId, { status: 'failed', error: result.error });
}
```

- [ ] **Step 3: Add pipeline operation panels to BlenderPipelineView**

Add new tabs for FBX Conversion, LOD Generation, and Mesh Optimization to the `extraTabs` array in `BlenderPipelineView.tsx`. Each tab renders a form that collects parameters and calls the corresponding script template + execute API.

Example for the LOD tab:
```typescript
import { generateLodsScript } from '@/lib/blender-mcp/scripts/generate-lods';

function LodTab() {
  const [objectName, setObjectName] = useState('');
  const [ratios, setRatios] = useState('0.5, 0.25, 0.1');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    const code = generateLodsScript({
      objectName,
      lodRatios: ratios.split(',').map(Number),
    });
    const res = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (res.ok) setResult(res.data.output);
    else setError(res.error);
  };

  // ... render form with inputs and button
}
```

Follow the same pattern for FBX Conversion (using `convertFbxScript`) and Mesh Optimization (using `optimizeMeshScript`).

- [ ] **Step 4: Verify no type errors and test manually**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/visual-gen/blender-pipeline/
git commit -m "feat(blender-pipeline): wire module to Blender MCP with conversion, LOD, and optimization"
```

---

### Task 10: Wire asset-forge Module

**Files:**
- Modify: `src/components/modules/visual-gen/asset-forge/useForgeStore.ts`
- Modify: `src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx`
- Modify: `src/components/modules/visual-gen/asset-forge/GenerationQueue.tsx`
- Modify: `src/lib/visual-gen/providers.ts`

- [ ] **Step 1: Update provider registry to mark MCP-backed providers**

In `src/lib/visual-gen/providers.ts`, add an `mcpBacked` flag to the `GenerationProvider` type and set it to `true` for Hunyuan3D and Rodin. Change their status from `'coming-soon'` to `'available'`.

- [ ] **Step 2: Add MCP job actions to useForgeStore**

Add these actions to `useForgeStore.ts`:

```typescript
import { tryApiFetch } from '@/lib/api-utils';
import type { JobResult, JobStatusResult } from '@/lib/blender-mcp/types';
import { UI_TIMEOUTS } from '@/lib/constants';

// In the store:
submitMcpJob: async (providerId: string, prompt: string) => {
  const provider = providerId === 'rodin' ? 'hyper3d' : 'hunyuan3d';
  const result = await tryApiFetch<JobResult>('/api/blender-mcp/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, prompt }),
  });
  if (!result.ok) return;

  const jobId = result.data.jobId;
  // Add to store jobs array
  get().addJob({ id: jobId, mode: 'text-to-3d', prompt, providerId, status: 'generating' });

  // Start polling
  const poll = setInterval(async () => {
    const status = await tryApiFetch<JobStatusResult>(
      `/api/blender-mcp/generate/status?jobId=${jobId}&provider=${provider}`
    );
    if (!status.ok) return;
    if (status.data.status === 'completed') {
      clearInterval(poll);
      get().updateJob(jobId, { status: 'completed', progress: 100 });
      // Auto-import into Blender
      await tryApiFetch('/api/blender-mcp/generate/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, provider }),
      });
    } else if (status.data.status === 'failed') {
      clearInterval(poll);
      get().updateJob(jobId, { status: 'failed' });
    } else {
      get().updateJob(jobId, { progress: status.data.progress });
    }
  }, UI_TIMEOUTS.blenderGenPollInterval);
},
```

- [ ] **Step 3: Update GenerationPanel to show MCP provider status**

In `GenerationPanel.tsx`, add a check: when an MCP-backed provider is selected, show the `BlenderConnectionBar` if not connected. The "Generate" button should call `submitMcpJob` for MCP-backed providers.

- [ ] **Step 4: Update GenerationQueue to show live progress**

In `GenerationQueue.tsx`, display `progress` percentage for active jobs. Show "Importing to Blender..." state after completion.

- [ ] **Step 5: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add src/components/modules/visual-gen/asset-forge/ src/lib/visual-gen/providers.ts
git commit -m "feat(asset-forge): wire Hunyuan3D and Hyper3D generation via Blender MCP"
```

---

### Task 11: Wire asset-browser Module

**Files:**
- Modify: `src/components/modules/visual-gen/asset-browser/AssetBrowserView.tsx`
- Modify: `src/components/modules/visual-gen/asset-browser/BrowsePanel.tsx`
- Modify: `src/components/modules/visual-gen/asset-browser/useAssetBrowserStore.ts`
- Modify: `src/components/modules/visual-gen/asset-browser/AssetCard.tsx`

- [ ] **Step 1: Add Sketchfab source to the store**

In `useAssetBrowserStore.ts`, extend the `activeSource` type to include `'sketchfab'`. Add a `searchSketchfab` action that calls `/api/blender-mcp/assets?source=sketchfab&query=...`.

- [ ] **Step 2: Add Sketchfab tab to BrowsePanel**

Add a third source button alongside Poly Haven and ambientCG. When selected, calls the MCP-backed search.

- [ ] **Step 3: Add "Import to Blender" button on AssetCard**

Add a conditional button on each `AssetCard` that appears when Blender is connected (`useBlenderMCPStore().connection.connected`). On click, calls `/api/blender-mcp/assets/download` with the asset source and ID.

- [ ] **Step 4: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/visual-gen/asset-browser/
git commit -m "feat(asset-browser): add Sketchfab search and import-to-Blender via MCP"
```

---

## Phase C — Visual-Gen Completions

### Task 12: Wire material-lab Module

**Files:**
- Create: `src/lib/blender-mcp/scripts/create-material.ts`
- Create: `src/lib/blender-mcp/scripts/apply-texture.ts`
- Modify: `src/components/modules/visual-gen/material-lab/MaterialLabView.tsx`
- Modify: `src/components/modules/visual-gen/material-lab/useMaterialStore.ts`

- [ ] **Step 1: Create material script templates**

```typescript
// src/lib/blender-mcp/scripts/create-material.ts
export function createMaterialScript(params: {
  name: string;
  baseColor: [number, number, number];
  metallic: number;
  roughness: number;
  normalStrength?: number;
  aoStrength?: number;
}): string {
  return `
import bpy

mat = bpy.data.materials.new(name="${params.name}")
mat.use_nodes = True
nodes = mat.node_tree.nodes
bsdf = nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (${params.baseColor[0]}, ${params.baseColor[1]}, ${params.baseColor[2]}, 1.0)
bsdf.inputs["Metallic"].default_value = ${params.metallic}
bsdf.inputs["Roughness"].default_value = ${params.roughness}

# Apply to active object if any
obj = bpy.context.active_object
if obj and obj.type == 'MESH':
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

print(f"Created material: {mat.name}")
`.trim();
}
```

```typescript
// src/lib/blender-mcp/scripts/apply-texture.ts
export function applyTextureScript(params: {
  materialName: string;
  textureSlot: 'base_color' | 'normal' | 'metallic' | 'roughness' | 'ao';
  texturePath: string;
}): string {
  const inputMap: Record<string, string> = {
    base_color: 'Base Color',
    normal: 'Normal',
    metallic: 'Metallic',
    roughness: 'Roughness',
    ao: 'Ambient Occlusion',
  };
  const inputName = inputMap[params.textureSlot] ?? 'Base Color';
  const isNonColor = params.textureSlot !== 'base_color';

  return `
import bpy

mat = bpy.data.materials.get("${params.materialName}")
if not mat:
    raise ValueError("Material '${params.materialName}' not found")

nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]

tex_node = nodes.new('ShaderNodeTexImage')
tex_node.image = bpy.data.images.load(r"${params.texturePath}")
${isNonColor ? 'tex_node.image.colorspace_settings.name = "Non-Color"' : ''}

links.new(tex_node.outputs["Color"], bsdf.inputs["${inputName}"])

print(f"Applied texture to {mat.name} -> ${inputName}")
`.trim();
}
```

- [ ] **Step 2: Add Blender actions to material-lab**

In `MaterialLabView.tsx`, add a "Send to Blender" button that:
1. Reads current PBR params from `useMaterialStore`
2. Calls `createMaterialScript()` to generate Python
3. POSTs to `/api/blender-mcp/execute`
4. Captures viewport screenshot

In `useMaterialStore.ts`, add a `sendToBlender` action that orchestrates this flow.

- [ ] **Step 3: Commit**

```bash
git add src/lib/blender-mcp/scripts/create-material.ts src/lib/blender-mcp/scripts/apply-texture.ts src/components/modules/visual-gen/material-lab/
git commit -m "feat(material-lab): add Send to Blender with PBR material creation via MCP"
```

---

### Task 13: Wire auto-rig Module

**Files:**
- Create: `src/lib/blender-mcp/scripts/create-armature.ts`
- Create: `src/lib/blender-mcp/scripts/setup-ik.ts`
- Create: `src/lib/blender-mcp/scripts/auto-weights.ts`
- Modify: `src/components/modules/visual-gen/auto-rig/AutoRigView.tsx`

- [ ] **Step 1: Create armature script template**

```typescript
// src/lib/blender-mcp/scripts/create-armature.ts
export interface BoneDefinition {
  name: string;
  head: [number, number, number];
  tail: [number, number, number];
  parent?: string;
}

export function createArmatureScript(params: {
  armatureName: string;
  bones: BoneDefinition[];
}): string {
  const boneStatements = params.bones.map((b) => `
bone = amt.edit_bones.new("${b.name}")
bone.head = (${b.head.join(', ')})
bone.tail = (${b.tail.join(', ')})
${b.parent ? `bone.parent = amt.edit_bones["${b.parent}"]` : ''}`).join('\n');

  return `
import bpy

bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
armature_obj = bpy.context.active_object
armature_obj.name = "${params.armatureName}"
amt = armature_obj.data
amt.name = "${params.armatureName}_Data"

# Remove default bone
amt.edit_bones.remove(amt.edit_bones[0])

${boneStatements}

bpy.ops.object.mode_set(mode='OBJECT')
print(f"Created armature: ${params.armatureName} with {len(amt.bones)} bones")
`.trim();
}
```

- [ ] **Step 2: Create IK setup and auto-weights scripts**

```typescript
// src/lib/blender-mcp/scripts/setup-ik.ts
export interface IKChainDef {
  boneName: string;
  targetBone: string;
  chainLength: number;
}

export function setupIKScript(params: {
  armatureName: string;
  chains: IKChainDef[];
}): string {
  const chainStatements = params.chains.map((c) => `
bone = obj.pose.bones["${c.boneName}"]
ik = bone.constraints.new('IK')
ik.target = obj
ik.subtarget = "${c.targetBone}"
ik.chain_count = ${c.chainLength}
`).join('\n');

  return `
import bpy

obj = bpy.data.objects.get("${params.armatureName}")
if not obj or obj.type != 'ARMATURE':
    raise ValueError("Armature '${params.armatureName}' not found")

bpy.context.view_layer.objects.active = obj
bpy.ops.object.mode_set(mode='POSE')

${chainStatements}

bpy.ops.object.mode_set(mode='OBJECT')
print("IK constraints applied")
`.trim();
}
```

```typescript
// src/lib/blender-mcp/scripts/auto-weights.ts
export function autoWeightsScript(params: {
  armatureName: string;
  meshName: string;
}): string {
  return `
import bpy

armature = bpy.data.objects.get("${params.armatureName}")
mesh = bpy.data.objects.get("${params.meshName}")
if not armature or not mesh:
    raise ValueError("Armature or mesh not found")

bpy.context.view_layer.objects.active = armature
mesh.select_set(True)
armature.select_set(True)
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

print(f"Auto weights applied: {mesh.name} -> {armature.name}")
`.trim();
}
```

- [ ] **Step 3: Update AutoRigView**

Add a "Create Rig in Blender" button for each preset. When clicked:
1. Convert the rig preset bone hierarchy to `BoneDefinition[]`
2. Call `createArmatureScript()` + execute via MCP
3. Call `setupIKScript()` with the preset's IK chains
4. Capture viewport screenshot

Show `BlenderConnectionBar` at top when Blender features are needed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/blender-mcp/scripts/create-armature.ts src/lib/blender-mcp/scripts/setup-ik.ts src/lib/blender-mcp/scripts/auto-weights.ts src/components/modules/visual-gen/auto-rig/
git commit -m "feat(auto-rig): add automated Blender rigging from rig presets via MCP"
```

---

### Task 14: Wire procedural-engine Module

**Files:**
- Create: `src/lib/blender-mcp/scripts/terrain-to-mesh.ts`
- Create: `src/lib/blender-mcp/scripts/dungeon-to-geometry.ts`
- Create: `src/lib/blender-mcp/scripts/scatter-vegetation.ts`
- Modify: `src/components/modules/visual-gen/procedural-engine/ProceduralEngineView.tsx`
- Modify: `src/components/modules/visual-gen/procedural-engine/useProceduralStore.ts`

- [ ] **Step 1: Create terrain export script**

```typescript
// src/lib/blender-mcp/scripts/terrain-to-mesh.ts
export function terrainToMeshScript(params: {
  heightmap: number[][];  // 2D array of heights
  gridSize: number;
  heightScale: number;
}): string {
  const rows = params.heightmap.length;
  const cols = params.heightmap[0]?.length ?? 0;
  // Serialize heightmap as a flat array string
  const flatHeights = params.heightmap.flat().join(',');

  return `
import bpy
import bmesh

heights = [${flatHeights}]
rows, cols = ${rows}, ${cols}
grid_size = ${params.gridSize}
height_scale = ${params.heightScale}
spacing = grid_size / max(rows, cols)

mesh = bpy.data.meshes.new("Terrain")
obj = bpy.data.objects.new("Terrain", mesh)
bpy.context.collection.objects.link(obj)

bm = bmesh.new()
verts = []
for r in range(rows):
    row_verts = []
    for c in range(cols):
        h = heights[r * cols + c] * height_scale
        v = bm.verts.new((c * spacing, r * spacing, h))
        row_verts.append(v)
    verts.append(row_verts)

bm.verts.ensure_lookup_table()
for r in range(rows - 1):
    for c in range(cols - 1):
        bm.faces.new([verts[r][c], verts[r][c+1], verts[r+1][c+1], verts[r+1][c]])

bm.to_mesh(mesh)
bm.free()

mesh.update()
print(f"Created terrain: {rows}x{cols} grid, {len(mesh.polygons)} faces")
`.trim();
}
```

- [ ] **Step 2: Create dungeon geometry and vegetation scatter scripts**

```typescript
// src/lib/blender-mcp/scripts/dungeon-to-geometry.ts
export type CellType = 'empty' | 'floor' | 'wall' | 'door' | 'corridor';

export function dungeonToGeometryScript(params: {
  grid: CellType[][];
  cellSize: number;
  wallHeight: number;
}): string {
  const rows = params.grid.length;
  const cols = params.grid[0]?.length ?? 0;
  // Encode grid as numeric: empty=0, floor=1, wall=2, door=3, corridor=4
  const typeMap: Record<CellType, number> = { empty: 0, floor: 1, wall: 2, door: 3, corridor: 4 };
  const flatGrid = params.grid.flat().map((c) => typeMap[c]).join(',');

  return `
import bpy

grid = [${flatGrid}]
rows, cols = ${rows}, ${cols}
cell_size = ${params.cellSize}
wall_height = ${params.wallHeight}

collection = bpy.data.collections.new("Dungeon")
bpy.context.scene.collection.children.link(collection)

for r in range(rows):
    for c in range(cols):
        cell = grid[r * cols + c]
        x, y = c * cell_size, r * cell_size

        if cell == 1 or cell == 3 or cell == 4:  # floor, door, corridor
            bpy.ops.mesh.primitive_plane_add(size=cell_size, location=(x, y, 0))
            obj = bpy.context.active_object
            obj.name = f"Floor_{r}_{c}"
            collection.objects.link(obj)
            bpy.context.scene.collection.objects.unlink(obj)

        if cell == 2:  # wall
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, wall_height / 2))
            obj = bpy.context.active_object
            obj.name = f"Wall_{r}_{c}"
            obj.scale = (cell_size / 2, cell_size / 2, wall_height / 2)
            bpy.ops.object.transform_apply(scale=True)
            collection.objects.link(obj)
            bpy.context.scene.collection.objects.unlink(obj)

print(f"Created dungeon: {rows}x{cols} grid")
`.trim();
}
```

```typescript
// src/lib/blender-mcp/scripts/scatter-vegetation.ts
export interface ScatterPoint {
  x: number;
  y: number;
  speciesId: string;
  rotation: number;
  scale: number;
}

export function scatterVegetationScript(params: {
  points: ScatterPoint[];
  speciesNames: Record<string, string>;  // speciesId -> display name
}): string {
  const pointsJson = JSON.stringify(params.points);
  const speciesJson = JSON.stringify(params.speciesNames);

  return `
import bpy
import json
import math

points = json.loads('${pointsJson}')
species = json.loads('${speciesJson}')

collection = bpy.data.collections.new("Vegetation")
bpy.context.scene.collection.children.link(collection)

for i, pt in enumerate(points):
    bpy.ops.mesh.primitive_ico_sphere_add(
        radius=0.3 * pt["scale"],
        location=(pt["x"], pt["y"], 0),
    )
    obj = bpy.context.active_object
    name = species.get(pt["speciesId"], pt["speciesId"])
    obj.name = f"{name}_{i}"
    obj.rotation_euler.z = math.radians(pt["rotation"])
    collection.objects.link(obj)
    bpy.context.scene.collection.objects.unlink(obj)

print(f"Scattered {len(points)} vegetation objects")
`.trim();
}
```

- [ ] **Step 3: Add "Export to Blender" to ProceduralEngineView**

Add an "Export to Blender" button in each generator section (Terrain, Dungeon, Vegetation). When clicked:
1. Take the current generated data from `useProceduralStore`
2. Call the corresponding script template function
3. POST to `/api/blender-mcp/execute`
4. Capture viewport screenshot

Show `BlenderConnectionBar` at the top. Buttons are disabled when not connected.

- [ ] **Step 4: Commit**

```bash
git add src/lib/blender-mcp/scripts/terrain-to-mesh.ts src/lib/blender-mcp/scripts/dungeon-to-geometry.ts src/lib/blender-mcp/scripts/scatter-vegetation.ts src/components/modules/visual-gen/procedural-engine/
git commit -m "feat(procedural-engine): add Blender export for terrain, dungeon, and vegetation via MCP"
```

---

## Phase D — Content Module Upgrades

### Task 15: Wire content/materials Module

**Files:**
- Create: `src/lib/blender-mcp/scripts/shader-patterns/water.ts`
- Create: `src/lib/blender-mcp/scripts/shader-patterns/fire.ts`
- Create: `src/lib/blender-mcp/scripts/shader-patterns/dissolve.ts`
- Create: `src/lib/blender-mcp/scripts/compositor-stack.ts`
- Modify: `src/components/modules/content/materials/MaterialPatternCatalog.tsx`
- Modify: `src/components/modules/content/materials/PostProcessStackBuilder.tsx`

- [ ] **Step 1: Create shader pattern scripts**

```typescript
// src/lib/blender-mcp/scripts/shader-patterns/water.ts
export function waterShaderScript(params: {
  materialName?: string;
  waveScale?: number;
  depthFade?: number;
}): string {
  const name = params.materialName ?? 'Water_Surface';
  return `
import bpy

mat = bpy.data.materials.new(name="${name}")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

output = nodes.new('ShaderNodeOutputMaterial')
glass = nodes.new('ShaderNodeBsdfGlass')
glass.inputs["Roughness"].default_value = 0.05
glass.inputs["IOR"].default_value = 1.333

wave1 = nodes.new('ShaderNodeTexWave')
wave1.wave_type = 'RINGS'
wave1.inputs["Scale"].default_value = ${params.waveScale ?? 8.0}

wave2 = nodes.new('ShaderNodeTexWave')
wave2.wave_type = 'BANDS'
wave2.inputs["Scale"].default_value = ${(params.waveScale ?? 8.0) * 1.5}

mix = nodes.new('ShaderNodeMixRGB')
mix.blend_type = 'ADD'

bump = nodes.new('ShaderNodeBump')
bump.inputs["Strength"].default_value = 0.3

ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.0, 0.1, 0.3, 1.0)
ramp.color_ramp.elements[1].color = (0.0, 0.4, 0.6, 1.0)

links.new(wave1.outputs["Fac"], mix.inputs[1])
links.new(wave2.outputs["Fac"], mix.inputs[2])
links.new(mix.outputs[0], bump.inputs["Height"])
links.new(mix.outputs[0], ramp.inputs["Fac"])
links.new(ramp.outputs["Color"], glass.inputs["Color"])
links.new(bump.outputs["Normal"], glass.inputs["Normal"])
links.new(glass.outputs["BSDF"], output.inputs["Surface"])

# Auto-layout
for i, node in enumerate(nodes):
    node.location = (i * 250 - 600, 0)

print(f"Created water shader: ${name}")
`.trim();
}
```

```typescript
// src/lib/blender-mcp/scripts/shader-patterns/fire.ts
export function fireShaderScript(params: {
  materialName?: string;
  intensity?: number;
}): string {
  const name = params.materialName ?? 'Fire_Embers';
  return `
import bpy

mat = bpy.data.materials.new(name="${name}")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

output = nodes.new('ShaderNodeOutputMaterial')
emission = nodes.new('ShaderNodeEmission')
emission.inputs["Strength"].default_value = ${params.intensity ?? 5.0}

noise = nodes.new('ShaderNodeTexNoise')
noise.inputs["Scale"].default_value = 4.0
noise.inputs["Detail"].default_value = 8.0

ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.3
ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
ramp.color_ramp.elements[1].color = (1.0, 0.15, 0.0, 1.0)
el = ramp.color_ramp.elements.new(0.7)
el.color = (1.0, 0.8, 0.0, 1.0)

mapping = nodes.new('ShaderNodeMapping')
mapping.inputs["Location"].default_value[2] = 1.0

coord = nodes.new('ShaderNodeTexCoord')

links.new(coord.outputs["Object"], mapping.inputs["Vector"])
links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
links.new(ramp.outputs["Color"], emission.inputs["Color"])
links.new(emission.outputs["Emission"], output.inputs["Surface"])

for i, node in enumerate(nodes):
    node.location = (i * 250 - 600, 0)

print(f"Created fire shader: ${name}")
`.trim();
}
```

```typescript
// src/lib/blender-mcp/scripts/shader-patterns/dissolve.ts
export function dissolveShaderScript(params: {
  materialName?: string;
  edgeColor?: [number, number, number];
  threshold?: number;
}): string {
  const name = params.materialName ?? 'Dissolve_Effect';
  const ec = params.edgeColor ?? [1.0, 0.3, 0.0];
  return `
import bpy

mat = bpy.data.materials.new(name="${name}")
mat.use_nodes = True
# blend_method was removed in Blender 4.0; wrap for compatibility
try:
    mat.blend_method = 'CLIP'
except AttributeError:
    pass
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

output = nodes.new('ShaderNodeOutputMaterial')
mix_shader = nodes.new('ShaderNodeMixShader')
principled = nodes.new('ShaderNodeBsdfPrincipled')
emission = nodes.new('ShaderNodeEmission')
emission.inputs["Color"].default_value = (${ec[0]}, ${ec[1]}, ${ec[2]}, 1.0)
emission.inputs["Strength"].default_value = 8.0

noise = nodes.new('ShaderNodeTexNoise')
noise.inputs["Scale"].default_value = 6.0
noise.inputs["Detail"].default_value = 4.0

ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = ${params.threshold ?? 0.4}
ramp.color_ramp.elements[1].position = ${(params.threshold ?? 0.4) + 0.05}

transparent = nodes.new('ShaderNodeBsdfTransparent')

links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
links.new(ramp.outputs["Color"], mix_shader.inputs["Fac"])
links.new(transparent.outputs["BSDF"], mix_shader.inputs[1])
links.new(principled.outputs["BSDF"], mix_shader.inputs[2])
links.new(mix_shader.outputs["Shader"], output.inputs["Surface"])

print(f"Created dissolve shader: ${name}")
`.trim();
}
```

- [ ] **Step 2: Create compositor stack script**

```typescript
// src/lib/blender-mcp/scripts/compositor-stack.ts
export interface CompositorSettings {
  bloom?: { intensity: number; threshold: number; radius: number };
  colorGrading?: { saturation: number; whiteBalance: number };
  dof?: { focalDistance: number; fstop: number };
  vignette?: { intensity: number };
}

export function compositorStackScript(params: CompositorSettings): string {
  return `
import bpy

scene = bpy.context.scene
scene.use_nodes = True
nodes = scene.node_tree.nodes
links = scene.node_tree.links

# Clear existing
for node in nodes:
    if node.type not in ('R_LAYERS', 'COMPOSITE'):
        nodes.remove(node)

render_layer = nodes.get("Render Layers") or nodes.new('CompositorNodeRLayers')
composite = nodes.get("Composite") or nodes.new('CompositorNodeComposite')

last_output = render_layer.outputs["Image"]

${params.bloom ? `
# Bloom
glare = nodes.new('CompositorNodeGlare')
glare.glare_type = 'FOG_GLOW'
glare.quality = 'HIGH'
glare.threshold = ${params.bloom.threshold}
links.new(last_output, glare.inputs[0])
last_output = glare.outputs[0]
` : ''}

${params.colorGrading ? `
# Color Grading
hsv = nodes.new('CompositorNodeHueSat')
hsv.inputs["Saturation"].default_value = ${params.colorGrading.saturation}
links.new(last_output, hsv.inputs["Image"])
last_output = hsv.outputs["Image"]
` : ''}

${params.vignette ? `
# Vignette
lens = nodes.new('CompositorNodeLensdist')
lens.inputs["Distort"].default_value = -${params.vignette.intensity * 0.1}
links.new(last_output, lens.inputs["Image"])
last_output = lens.outputs["Image"]
` : ''}

links.new(last_output, composite.inputs["Image"])

# Auto-layout
for i, node in enumerate(nodes):
    node.location = (i * 300, 0)

print("Compositor stack configured")
`.trim();
}
```

- [ ] **Step 3: Add "Preview in Blender" to content/materials components**

In `MaterialPatternCatalog.tsx`, add a button per pattern entry (Water, Fire, Dissolve) that calls the corresponding shader script via MCP execute. In `PostProcessStackBuilder.tsx`, add a "Preview in Blender" button that collects the current post-process settings and calls `compositorStackScript`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/blender-mcp/scripts/shader-patterns/ src/lib/blender-mcp/scripts/compositor-stack.ts src/components/modules/content/materials/
git commit -m "feat(content/materials): add Blender shader pattern preview and compositor via MCP"
```

---

### Task 16: Wire content/animations Module

**Files:**
- Create: `src/lib/blender-mcp/scripts/combo-animation.ts`
- Create: `src/lib/blender-mcp/scripts/nla-state-machine.ts`
- Modify: `src/components/modules/content/animations/AIComboChoreographer.tsx`
- Modify: `src/components/modules/content/animations/AnimationStateMachine.tsx`

- [ ] **Step 1: Create combo animation script**

```typescript
// src/lib/blender-mcp/scripts/combo-animation.ts
export interface ComboHit {
  time: number;      // seconds
  type: string;      // light, heavy, sweep, etc.
  damage: number;
  rootMotion: number; // distance forward
}

export function comboAnimationScript(params: {
  comboName: string;
  hits: ComboHit[];
  totalDuration: number;
}): string {
  const fps = 30;
  const keyframes = params.hits.map((hit) => {
    const frame = Math.round(hit.time * fps);
    return `
# ${hit.type} hit at frame ${frame}
bpy.context.scene.frame_set(${frame})
armature.pose.bones["Spine"].rotation_quaternion = (0.95, 0.3, 0, 0)
armature.pose.bones["Spine"].keyframe_insert(data_path="rotation_quaternion")
armature.pose.bones["UpperArm.R"].rotation_quaternion = (0.7, 0.7, 0, 0)
armature.pose.bones["UpperArm.R"].keyframe_insert(data_path="rotation_quaternion")
`;
  }).join('\n');

  return `
import bpy

# Create basic armature for preview
bpy.ops.object.armature_add(enter_editmode=False, location=(0, 0, 0))
armature = bpy.context.active_object
armature.name = "${params.comboName}_Preview"

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = ${Math.round(params.totalDuration * fps)}

bpy.ops.object.mode_set(mode='POSE')

# Reset pose at frame 1
scene.frame_set(1)
for bone in armature.pose.bones:
    bone.rotation_quaternion = (1, 0, 0, 0)
    bone.keyframe_insert(data_path="rotation_quaternion")

${keyframes}

# Reset at end
scene.frame_set(${Math.round(params.totalDuration * fps)})
for bone in armature.pose.bones:
    bone.rotation_quaternion = (1, 0, 0, 0)
    bone.keyframe_insert(data_path="rotation_quaternion")

bpy.ops.object.mode_set(mode='OBJECT')
scene.frame_set(1)
print(f"Created combo preview: ${params.comboName} ({len(params.hits)} hits, ${params.totalDuration}s)")
`.trim();
}
```

- [ ] **Step 2: Create NLA state machine script**

```typescript
// src/lib/blender-mcp/scripts/nla-state-machine.ts
export interface AnimState {
  name: string;
  type: string;  // locomotion, combat, reaction, montage
  frameStart: number;
  frameEnd: number;
}

export function nlaStateMachineScript(params: {
  armatureName: string;
  states: AnimState[];
}): string {
  const strips = params.states.map((state, i) => `
# State: ${state.name} (${state.type})
action = bpy.data.actions.new(name="${state.name}")
action.frame_range = (${state.frameStart}, ${state.frameEnd})
track = armature.animation_data.nla_tracks.new()
track.name = "${state.name}"
track.strips.new("${state.name}", ${state.frameStart}, action)
track.mute = ${i > 0 ? 'True' : 'False'}
`).join('\n');

  return `
import bpy

armature = bpy.data.objects.get("${params.armatureName}")
if not armature:
    raise ValueError("Armature '${params.armatureName}' not found")

if not armature.animation_data:
    armature.animation_data_create()

# Clear existing NLA tracks
for track in list(armature.animation_data.nla_tracks):
    armature.animation_data.nla_tracks.remove(track)

${strips}

print(f"Created NLA state machine with {len(armature.animation_data.nla_tracks)} tracks")
`.trim();
}
```

- [ ] **Step 3: Wire AIComboChoreographer and AnimationStateMachine**

In `AIComboChoreographer.tsx`, add a "Preview in Blender" button. When clicked, extract the current combo hits and call `comboAnimationScript` + execute via MCP.

In `AnimationStateMachine.tsx`, add a "Export to Blender NLA" button. Extract state nodes and call `nlaStateMachineScript` + execute via MCP.

Both components should show `BlenderConnectionBar` when MCP features are available.

- [ ] **Step 4: Commit**

```bash
git add src/lib/blender-mcp/scripts/combo-animation.ts src/lib/blender-mcp/scripts/nla-state-machine.ts src/components/modules/content/animations/
git commit -m "feat(content/animations): add Blender combo preview and NLA state machine via MCP"
```

---

### Task 17: Wire content/level-design Module

**Files:**
- Create: `src/lib/blender-mcp/scripts/level-blockout.ts`
- Create: `src/lib/blender-mcp/scripts/level-metadata.ts`
- Modify: `src/components/modules/content/level-design/LevelFlowEditor.tsx`
- Modify: `src/components/modules/content/level-design/ProceduralLevelWizard.tsx`

- [ ] **Step 1: Create level blockout scripts**

```typescript
// src/lib/blender-mcp/scripts/level-blockout.ts
export interface BlockoutRoom {
  id: string;
  name: string;
  type: string;  // combat, puzzle, exploration, boss, safe, transition
  x: number;
  y: number;
  width: number;
  height: number;
  color: [number, number, number];
}

export interface BlockoutConnection {
  fromId: string;
  toId: string;
}

export function levelBlockoutScript(params: {
  rooms: BlockoutRoom[];
  connections: BlockoutConnection[];
  wallHeight: number;
}): string {
  const roomStatements = params.rooms.map((r) => `
# Room: ${r.name} (${r.type})
bpy.ops.mesh.primitive_cube_add(size=1, location=(${r.x}, ${r.y}, ${params.wallHeight / 2}))
obj = bpy.context.active_object
obj.name = "Room_${r.id}"
obj.scale = (${r.width / 2}, ${r.height / 2}, ${params.wallHeight / 2})
bpy.ops.object.transform_apply(scale=True)
mat = bpy.data.materials.new(name="Mat_${r.id}")
mat.diffuse_color = (${r.color[0]}, ${r.color[1]}, ${r.color[2]}, 0.6)
obj.data.materials.append(mat)
obj.display_type = 'SOLID'
rooms_coll.objects.link(obj)
bpy.context.scene.collection.objects.unlink(obj)
`).join('\n');

  return `
import bpy

# Create collections
rooms_coll = bpy.data.collections.new("Rooms")
bpy.context.scene.collection.children.link(rooms_coll)

${roomStatements}

print(f"Created level blockout: ${params.rooms.length} rooms")
`.trim();
}
```

```typescript
// src/lib/blender-mcp/scripts/level-metadata.ts
export interface SpawnPoint {
  x: number;
  y: number;
  type: string;  // player, enemy, loot, boss
}

export function levelMetadataScript(params: {
  spawnPoints: SpawnPoint[];
  zoneMarkers?: Array<{ name: string; x: number; y: number; radius: number }>;
}): string {
  const spawns = params.spawnPoints.map((sp, i) => `
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(${sp.x}, ${sp.y}, 0))
obj = bpy.context.active_object
obj.name = "Spawn_${sp.type}_${i}"
obj.empty_display_size = 0.5
meta_coll.objects.link(obj)
bpy.context.scene.collection.objects.unlink(obj)
`).join('\n');

  return `
import bpy

meta_coll = bpy.data.collections.new("Level_Metadata")
bpy.context.scene.collection.children.link(meta_coll)

${spawns}

print(f"Added ${params.spawnPoints.length} spawn points")
`.trim();
}
```

- [ ] **Step 2: Wire LevelFlowEditor and ProceduralLevelWizard**

In `LevelFlowEditor.tsx`, add "Blockout in Blender" button. Convert room nodes to `BlockoutRoom[]` (using room positions, types, and colors from the SVG editor data), then call `levelBlockoutScript` + execute via MCP.

In `ProceduralLevelWizard.tsx`, add "Export to Blender" button. Reuse the `dungeonToGeometryScript` from Task 13 for grid-based output, plus `levelMetadataScript` for spawn points.

- [ ] **Step 3: Commit**

```bash
git add src/lib/blender-mcp/scripts/level-blockout.ts src/lib/blender-mcp/scripts/level-metadata.ts src/components/modules/content/level-design/
git commit -m "feat(content/level-design): add Blender 3D blockout and metadata export via MCP"
```

---

## Phase E — New Module: Scene Composer

### Task 18: Scene Composer Module

**Files:**
- Create: `src/components/modules/visual-gen/scene-composer/SceneComposerView.tsx`
- Create: `src/components/modules/visual-gen/scene-composer/SceneTree.tsx`
- Create: `src/components/modules/visual-gen/scene-composer/AssetPlacer.tsx`
- Create: `src/components/modules/visual-gen/scene-composer/SceneExporter.tsx`
- Create: `src/components/modules/visual-gen/scene-composer/useSceneComposerStore.ts`
- Create: `src/lib/blender-mcp/scripts/export-scene.ts`
- Modify: `src/lib/module-registry.ts` — add scene-composer to visual-gen category
- Modify: `src/lib/feature-definitions.ts` — add scene-composer prerequisites
- Modify: `src/types/modules.ts` — add 'scene-composer' to SubModuleId union

- [ ] **Step 1: Create useSceneComposerStore**

```typescript
// src/components/modules/visual-gen/scene-composer/useSceneComposerStore.ts
'use client';

import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import type { SceneInfo, ObjectSummary, ExecuteOutput } from '@/lib/blender-mcp/types';

interface SceneComposerState {
  sceneInfo: SceneInfo | null;
  selectedObject: string | null;
  isRefreshing: boolean;
  transformMode: 'translate' | 'rotate' | 'scale';

  refreshScene: () => Promise<void>;
  selectObject: (name: string | null) => void;
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  deleteObject: (name: string) => Promise<void>;
  duplicateObject: (name: string) => Promise<void>;
}

export const useSceneComposerStore = create<SceneComposerState>()((set, get) => ({
  sceneInfo: null,
  selectedObject: null,
  isRefreshing: false,
  transformMode: 'translate',

  refreshScene: async () => {
    set({ isRefreshing: true });
    const result = await tryApiFetch<SceneInfo>('/api/blender-mcp/scene');
    if (result.ok) {
      set({ sceneInfo: result.data, isRefreshing: false });
    } else {
      set({ isRefreshing: false });
    }
  },

  selectObject: (name) => set({ selectedObject: name }),

  setTransformMode: (mode) => set({ transformMode: mode }),

  deleteObject: async (name) => {
    await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `import bpy\nobj = bpy.data.objects.get("${name}")\nif obj:\n    bpy.data.objects.remove(obj, do_unlink=True)` }),
    });
    get().refreshScene();
  },

  duplicateObject: async (name) => {
    await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `import bpy\nobj = bpy.data.objects.get("${name}")\nif obj:\n    new = obj.copy()\n    new.data = obj.data.copy()\n    bpy.context.collection.objects.link(new)` }),
    });
    get().refreshScene();
  },
}));
```

- [ ] **Step 2: Create SceneTree component**

```typescript
// src/components/modules/visual-gen/scene-composer/SceneTree.tsx
'use client';

import { Box, Eye, EyeOff, Trash2, Copy } from 'lucide-react';
import { useSceneComposerStore } from './useSceneComposerStore';

export function SceneTree() {
  const { sceneInfo, selectedObject, selectObject, deleteObject, duplicateObject } = useSceneComposerStore();

  if (!sceneInfo) {
    return <div className="text-xs text-text-muted p-3">No scene loaded. Connect to Blender and refresh.</div>;
  }

  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium text-text-muted px-2 py-1">
        Scene Objects ({sceneInfo.objects.length})
      </div>
      {sceneInfo.objects.map((obj) => (
        <button
          key={obj.name}
          onClick={() => selectObject(obj.name)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
            selectedObject === obj.name
              ? 'bg-accent/10 text-accent'
              : 'text-text hover:bg-surface-tertiary'
          }`}
        >
          <Box className="w-3 h-3 shrink-0" />
          <span className="flex-1 text-left truncate">{obj.name}</span>
          <span className="text-[10px] text-text-muted">{obj.type}</span>
          {obj.visible ? <Eye className="w-3 h-3 text-text-muted" /> : <EyeOff className="w-3 h-3 text-text-muted" />}
          <button
            onClick={(e) => { e.stopPropagation(); duplicateObject(obj.name); }}
            className="p-0.5 rounded hover:bg-surface-tertiary"
            title="Duplicate"
          >
            <Copy className="w-3 h-3 text-text-muted" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteObject(obj.name); }}
            className="p-0.5 rounded hover:bg-red-500/10"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create SceneExporter and export script**

```typescript
// src/lib/blender-mcp/scripts/export-scene.ts
export function exportSceneScript(params: {
  outputPath: string;
  format: 'fbx' | 'gltf';
}): string {
  if (params.format === 'fbx') {
    return `
import bpy
bpy.ops.export_scene.fbx(filepath=r"${params.outputPath}", use_selection=False)
print(f"Exported scene to: ${params.outputPath}")
`.trim();
  }
  return `
import bpy
bpy.ops.export_scene.gltf(filepath=r"${params.outputPath}", export_format="GLB")
print(f"Exported scene to: ${params.outputPath}")
`.trim();
}
```

```typescript
// src/components/modules/visual-gen/scene-composer/SceneExporter.tsx
'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { exportSceneScript } from '@/lib/blender-mcp/scripts/export-scene';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';

export function SceneExporter() {
  const [outputPath, setOutputPath] = useState('');
  const [format, setFormat] = useState<'fbx' | 'gltf'>('gltf');
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    if (!outputPath) return;
    setStatus('Exporting...');
    const code = exportSceneScript({ outputPath, format });
    const result = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    setStatus(result.ok ? `Exported: ${result.data.output}` : `Error: ${result.error}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as 'fbx' | 'gltf')}
          className="bg-surface-tertiary border border-border rounded px-2 py-1 text-xs text-text"
        >
          <option value="gltf">GLB (glTF Binary)</option>
          <option value="fbx">FBX</option>
        </select>
        <input
          type="text"
          value={outputPath}
          onChange={(e) => setOutputPath(e.target.value)}
          placeholder="Output file path..."
          className="flex-1 bg-surface-tertiary border border-border rounded px-2 py-1 text-xs text-text"
        />
        <button
          onClick={handleExport}
          disabled={!outputPath}
          className="flex items-center gap-1 px-3 py-1 rounded bg-accent/10 text-accent text-xs hover:bg-accent/20 disabled:opacity-40"
        >
          <Download className="w-3 h-3" /> Export
        </button>
      </div>
      {status && <div className="text-[11px] text-text-muted">{status}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Create SceneComposerView (main view)**

```typescript
// src/components/modules/visual-gen/scene-composer/SceneComposerView.tsx
'use client';

import { Layers, List, Image, Download } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { ViewportPreview } from '@/components/blender-mcp/ViewportPreview';
import { SceneTree } from './SceneTree';
import { SceneExporter } from './SceneExporter';
import { useSceneComposerStore } from './useSceneComposerStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { useSuspendableEffect } from '@/hooks/useSuspend';

function ComposerTab() {
  const { connection } = useBlenderMCPStore();
  const { refreshScene } = useSceneComposerStore();

  useSuspendableEffect(() => {
    if (connection.connected) refreshScene();
  }, [connection.connected, refreshScene]);

  return (
    <div className="space-y-4">
      <BlenderConnectionBar />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-secondary p-3">
            <h3 className="text-xs font-medium text-text mb-2">Scene Tree</h3>
            <SceneTree />
          </div>
          <div className="rounded-lg border border-border bg-surface-secondary p-3">
            <h3 className="text-xs font-medium text-text mb-2">Export</h3>
            <SceneExporter />
          </div>
        </div>
        <ViewportPreview />
      </div>
    </div>
  );
}

export function SceneComposerView() {
  const mod = SUB_MODULE_MAP['scene-composer'];
  const cat = getCategoryForSubModule('scene-composer');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    { id: 'composer', label: 'Composer', icon: Layers, render: () => <ComposerTab /> },
  ];

  return (
    <ReviewableModuleView
      moduleId="scene-composer"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('scene-composer')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
```

- [ ] **Step 5: Register scene-composer in module-registry.ts**

Add `'scene-composer'` to the `visual-gen` category's `subModules` array. Add a `SUB_MODULE_MAP` entry:

```typescript
'scene-composer': {
  id: 'scene-composer',
  label: 'Scene Composer',
  description: 'Compose complete Blender scenes from assets, materials, and procedural content for UE5 export',
  icon: Layers,
  feasibilityRating: 'moderate',
  quickActions: [
    { id: 'sc-qa-1', label: 'Refresh Scene', prompt: 'Fetch current Blender scene tree' },
    { id: 'sc-qa-2', label: 'Export for UE5', prompt: 'Export scene as FBX/glTF for Unreal Engine import' },
    { id: 'sc-qa-3', label: 'Clean Scene', prompt: 'Remove unused data blocks and optimize scene' },
  ],
  knowledgeTips: [
    { id: 'sc-kt-1', label: 'Collection hierarchy maps to UE5 folder structure on import' },
    { id: 'sc-kt-2', label: 'Name objects with UE5 naming conventions (SM_, SK_, M_) for smooth import' },
  ],
  checklist: [
    { id: 'sc-1', label: 'Scene tree management', description: 'View, select, delete, and duplicate Blender scene objects', prompt: 'Guide through scene tree operations' },
    { id: 'sc-2', label: 'Asset placement', description: 'Place assets from browser/forge into Blender scene', prompt: 'Guide through asset placement workflow' },
    { id: 'sc-3', label: 'Scene export', description: 'Export complete scene as FBX or glTF for UE5', prompt: 'Guide through scene export for UE5 import' },
  ],
},
```

- [ ] **Step 6: Register in feature-definitions.ts**

Add to `MODULE_PREREQUISITES`:
```typescript
'scene-composer': ['asset-viewer', 'blender-pipeline'],
```

- [ ] **Step 7: Add 'scene-composer' to SubModuleId type**

In `src/types/modules.ts`, add `'scene-composer'` to the `SubModuleId` union type.

- [ ] **Step 8: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/components/modules/visual-gen/scene-composer/ src/lib/blender-mcp/scripts/export-scene.ts src/lib/module-registry.ts src/lib/feature-definitions.ts src/types/modules.ts
git commit -m "feat(scene-composer): add new Scene Composer module for full Blender scene composition"
```

---

### Task 19: Final Validation

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 2: Run linter**

Run: `npx eslint src/lib/blender-mcp/ src/stores/blenderMCPStore.ts src/components/blender-mcp/ src/app/api/blender-mcp/ src/components/modules/visual-gen/scene-composer/ --max-warnings=0`
Expected: No errors or warnings

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run`
Expected: All existing tests pass, new service tests pass

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit any fixes**

If any issues found in steps 1-4, fix and commit with descriptive message.
