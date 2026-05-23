# 06-TM Leonardo PBR Pipeline + Master Materials + Arena 3D-Texture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give PoF a real Leonardo PBR texture pipeline (download-then-delete, advanced 2D options, upscaler, the 3D-texture-on-OBJ endpoint), consolidate the UE project's materials onto a parameterised `M_ARPG_Surface_Master`, and re-texture the arena via the 3D endpoint with an honest A/B fallback to the existing PS-3 textures.

**Architecture:** Three sequenced slices. **Part A** extends `src/lib/leonardo.ts` (a server-side fetch client) and its API route — pure TypeScript, unit-tested with vitest by mocking `fetch`. **Part B** adds two new UE Python scripts (a master material + a reparent pass) that mirror the proven `build_arena_ue.py` material code, plus a local prompt edit guarded by a vitest snapshot. **Part C** adds three new UE Python scripts + a PoF runner that drive the Part-A 3D endpoint, judged by Gemini A/B with a documented fallback. A→B→C: A enables C, B is how C's PBR set is applied.

**Tech Stack:** TypeScript / Next.js 16 (PoF app), vitest (mocked `fetch`), UE5.7 Python (`unreal` module via `UnrealEditor.exe -ExecutePythonScript=`), Leonardo AI REST API, Gemini vision (`gemini-recognize.mjs`).

---

## Parallel-CLI isolation contract (read before touching anything)

This is **branch #6 of 8 parallel CLIs** sharing the same two repos. To avoid collisions:

- **DO touch (PoF app):** `src/lib/leonardo.ts`, `src/app/api/leonardo/route.ts`, `src/lib/prompts/material-configurator.ts`, new test files under `src/__tests__/leonardo/` and `src/__tests__/materials/`.
- **DO touch (UE project, `C:\Users\kazda\Documents\Unreal Projects\PoF`):** `Content/Python/build_master_material.py` (new), `Content/Python/reparent_materials.py` (new), `Content/Python/export_arena_obj.py` (new), `Content/Python/retexture_arena_3d.py` (new); new assets under `/Game/Materials/` and `/Game/ArenaBuild/Textures3D/`.
- **DO NOT edit:** `Content/Python/build_arena.py`, `Content/Python/build_arena_ue.py`, `Content/Python/setup_characters_ue.py` (branches #5 / #2). Do **not** edit the shared gotchas pack, `module-registry.ts`, or `prompt-context.ts` (branch #1) — the Constant3Vector gotcha lives **locally** in `material-configurator.ts`.
- **Commits:** PoF app repo — commit **locally only** (do not push; the user pushes manually). UE project repo (`github.com/xkazm04/pof-exp`) — push is allowed.
- **Leonardo:** every generation is **download-then-delete**. Never leave a generation on the account.

## File structure

| File | New/Mod | Responsibility |
|------|---------|----------------|
| `src/lib/leonardo.ts` | Mod | Leonardo client: `generateImage` (advanced opts + cleanup), `deleteGeneration`, `downloadThenDelete`, `upscaleImage`, `generateTextureOn3DModel` |
| `src/app/api/leonardo/route.ts` | Mod | POST route; `mode` field routes to image / upscale / texture3d; back-compat prompt-only |
| `src/lib/prompts/material-configurator.ts` | Mod | Add Constant3Vector gotcha + prefer-MaterialInstance guidance to best-practices |
| `src/__tests__/leonardo/leonardo-client.test.ts` | New | Request-shape + download-then-delete protocol tests (mocked fetch) |
| `src/__tests__/leonardo/leonardo-route.test.ts` | New | Route mode-routing + back-compat tests |
| `src/__tests__/materials/material-configurator.test.ts` | New | Snapshot guard for the prompt edits |
| `Content/Python/build_master_material.py` | New (UE) | Create `/Game/Materials/M_ARPG_Surface_Master` |
| `Content/Python/reparent_materials.py` | New (UE) | Create `MI_Arena_*` + `MI_EnemyRed` instances of the master; reassign SM_Arena slots |
| `Content/Python/export_arena_obj.py` | New (UE) | Export `SM_Arena` to a UV-mapped OBJ |
| `Content/Python/retexture_arena_3d.py` | New (UE) | Import the 3D PBR maps; make `MI_Arena_3D`; apply to slots |
| `scripts/retexture-arena-runner.mjs` | New | Node runner: OBJ → `generateTextureOn3DModel` → download PBR maps |
| `docs/improvements/06-textures-materials/runs/2026-05-23-run.md` | New | Findings doc |

---

# PART A — Leonardo PBR pipeline (PoF app)

### Task A1: `deleteGeneration` + `downloadThenDelete` + option types

**Files:**
- Modify: `src/lib/leonardo.ts`
- Test: `src/__tests__/leonardo/leonardo-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/leonardo/leonardo-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deleteGeneration, downloadThenDelete } from '@/lib/leonardo';

const BASE = 'https://cloud.leonardo.ai/api/rest/v1';

interface Call { url: string; method: string; body?: unknown }

/** A fetch mock that records every call and matches by URL substring + method. */
function installFetch(handler: (url: string, method: string) => {
  ok?: boolean; status?: number; body?: unknown; bytes?: ArrayBuffer;
}): { calls: Call[] } {
  const calls: Call[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(init.body) : undefined });
    const r = handler(url, method);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: () => Promise.resolve(r.body ?? {}),
      text: () => Promise.resolve(JSON.stringify(r.body ?? {})),
      arrayBuffer: () => Promise.resolve(r.bytes ?? new ArrayBuffer(8)),
    };
  }) as unknown as typeof fetch;
  return { calls };
}

beforeEach(() => { process.env.LEONARDO_API_KEY = 'test-key'; });
afterEach(() => { vi.restoreAllMocks(); });

describe('deleteGeneration', () => {
  it('issues a DELETE to /generations/{id}', async () => {
    const { calls } = installFetch(() => ({ body: {} }));
    await deleteGeneration('gen-123');
    const del = calls.find((c) => c.method === 'DELETE');
    expect(del).toBeDefined();
    expect(del!.url).toBe(`${BASE}/generations/gen-123`);
  });
});

describe('downloadThenDelete', () => {
  it('fetches the image bytes THEN deletes the generation', async () => {
    const { calls } = installFetch(() => ({ bytes: new ArrayBuffer(16), body: {} }));
    const bytes = await downloadThenDelete('https://cdn.leonardo.ai/img.png', 'gen-9');
    expect(bytes.byteLength).toBe(16);
    const getIdx = calls.findIndex((c) => c.url.includes('cdn.leonardo.ai'));
    const delIdx = calls.findIndex((c) => c.method === 'DELETE');
    expect(getIdx).toBeGreaterThanOrEqual(0);
    expect(delIdx).toBeGreaterThan(getIdx); // download precedes delete
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/__tests__/leonardo/leonardo-client.test.ts`
Expected: FAIL — `deleteGeneration`/`downloadThenDelete` are not exported.

- [ ] **Step 3: Implement**

In `src/lib/leonardo.ts`, after the existing constants block, add the model id and a JSON-headers helper, and append the two functions. Edit the top constants:

```typescript
const LEONARDO_API_BASE = 'https://cloud.leonardo.ai/api/rest/v1';
const LUCID_ORIGIN_MODEL_ID = '7b592283-e8a7-4c5a-9ba6-d18c31f258b9';
export const LUCID_REALISM_MODEL_ID = '05ce0082-2d80-4a2d-8653-4d1c85e2418e';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;
```

Add a headers helper next to `getApiKey`:

```typescript
function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${getApiKey()}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}
```

Append these exports at the end of the file:

```typescript
/** Remove a generation from the Leonardo account (the local copy is the only retained one). */
export async function deleteGeneration(generationId: string): Promise<void> {
  const res = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    logger.warn(`[leonardo] deleteGeneration ${generationId} returned ${res.status}`);
    return;
  }
  logger.info(`[leonardo] Deleted generation ${generationId}`);
}

/**
 * Download an image's bytes, then delete its generation. The returned bytes are
 * the only retained copy — enforces the download-then-delete protocol.
 */
export async function downloadThenDelete(imageUrl: string, generationId: string): Promise<Uint8Array> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Leonardo image download failed (${imgRes.status})`);
  const bytes = new Uint8Array(await imgRes.arrayBuffer());
  await deleteGeneration(generationId);
  return bytes;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/__tests__/leonardo/leonardo-client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leonardo.ts src/__tests__/leonardo/leonardo-client.test.ts
git commit -m "feat(leonardo): add deleteGeneration + downloadThenDelete (cleanup protocol)"
```

---

### Task A2: `generateImage(prompt, opts?)` — advanced options + cleanup, back-compat

**Files:**
- Modify: `src/lib/leonardo.ts:40-99`
- Test: `src/__tests__/leonardo/leonardo-client.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `leonardo-client.test.ts`:

```typescript
import { generateImage } from '@/lib/leonardo';

function installGenFetch(opts: { status?: string } = {}): { calls: Call[] } {
  const status = opts.status ?? 'COMPLETE';
  return installFetch((url, method) => {
    if (method === 'POST' && url.endsWith('/generations')) {
      return { body: { sdGenerationJob: { generationId: 'gen-1' } } };
    }
    if (method === 'GET' && url.includes('/generations/gen-1')) {
      return { body: { generations_by_pk: { status, generated_images: [{ url: 'https://cdn.leonardo.ai/x.png', id: 'img-1' }] } } };
    }
    if (url.includes('cdn.leonardo.ai')) return { bytes: new ArrayBuffer(4) };
    return { body: {} }; // DELETE
  });
}

describe('generateImage', () => {
  it('back-compat: string-only call sends the legacy 512x512 Lucid Origin body', async () => {
    const { calls } = installGenFetch();
    const result = await generateImage('a stone wall', { pollIntervalMs: 1 });
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/generations'));
    expect(post!.body).toEqual({
      modelId: '7b592283-e8a7-4c5a-9ba6-d18c31f258b9',
      prompt: 'a stone wall',
      width: 512,
      height: 512,
      num_images: 1,
      contrast: 3.5,
    });
    expect(result.imageUrl).toBe('https://cdn.leonardo.ai/x.png');
    expect(result.generationId).toBe('gen-1');
  });

  it('cleanup=true (default) downloads bytes then DELETEs the generation', async () => {
    const { calls } = installGenFetch();
    const result = await generateImage('a stone wall', { pollIntervalMs: 1 });
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/generations/gen-1'))).toBe(true);
    expect(result.imageBase64).toBeDefined();
  });

  it('cleanup=false leaves the generation (no DELETE)', async () => {
    const { calls } = installGenFetch();
    await generateImage('x', { pollIntervalMs: 1, cleanup: false });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('opts add tiling + model + dimensions to the request body', async () => {
    const { calls } = installGenFetch();
    await generateImage('seamless rock', {
      pollIntervalMs: 1, modelId: '05ce0082-2d80-4a2d-8653-4d1c85e2418e',
      width: 1024, height: 1024, tiling: true, transparency: 'foreground', contrast: 4, numImages: 2,
    });
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/generations'));
    expect(post!.body).toEqual({
      modelId: '05ce0082-2d80-4a2d-8653-4d1c85e2418e',
      prompt: 'seamless rock',
      width: 1024, height: 1024, num_images: 2, contrast: 4,
      tiling: true, transparency: 'foreground',
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/__tests__/leonardo/leonardo-client.test.ts -t generateImage`
Expected: FAIL — `pollIntervalMs`/`opts`/`imageBase64` not supported.

- [ ] **Step 3: Implement — replace the existing `generateImage` (lines 36-99)**

```typescript
export interface GenerateImageOptions {
  modelId?: string;
  width?: number;
  height?: number;
  tiling?: boolean;
  transparency?: 'disabled' | 'foreground';
  contrast?: number;
  numImages?: number;
  /** Download bytes + delete the generation after completion. Default true. */
  cleanup?: boolean;
  /** Poll interval; defaults to POLL_INTERVAL_MS. Lowered in tests. */
  pollIntervalMs?: number;
}

export interface GenerateImageResult {
  imageUrl: string;
  generationId: string;
  /** base64 of the downloaded bytes — present when cleanup ran. */
  imageBase64?: string;
}

/** Start an image generation, poll to completion, optionally download-then-delete. */
export async function generateImage(
  prompt: string,
  opts: GenerateImageOptions = {},
): Promise<GenerateImageResult> {
  const trimmedPrompt = prompt.slice(0, 1500);
  const pollMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;

  const body: Record<string, unknown> = {
    modelId: opts.modelId ?? LUCID_ORIGIN_MODEL_ID,
    prompt: trimmedPrompt,
    width: opts.width ?? 512,
    height: opts.height ?? 512,
    num_images: opts.numImages ?? 1,
    contrast: opts.contrast ?? 3.5,
  };
  if (opts.tiling) body.tiling = true;
  if (opts.transparency) body.transparency = opts.transparency;

  const genRes = await fetch(`${LEONARDO_API_BASE}/generations`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  if (!genRes.ok) {
    const text = await genRes.text();
    throw new Error(`Leonardo generation failed (${genRes.status}): ${text}`);
  }
  const genData = (await genRes.json()) as GenerationResponse;
  const generationId = genData.sdGenerationJob.generationId;
  logger.info(`[leonardo] Generation started: ${generationId}`);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(pollMs);
    const pollRes = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, {
      headers: authHeaders(),
    });
    if (!pollRes.ok) {
      logger.warn(`[leonardo] Poll attempt ${attempt + 1} failed (${pollRes.status})`);
      continue;
    }
    const pollData = (await pollRes.json()) as PollResponse;
    const gen = pollData.generations_by_pk;
    if (gen?.status === 'COMPLETE' && gen.generated_images.length > 0) {
      const imageUrl = gen.generated_images[0].url;
      logger.info(`[leonardo] Generation complete: ${imageUrl}`);
      if (opts.cleanup === false) return { imageUrl, generationId };
      const bytes = await downloadThenDelete(imageUrl, generationId);
      return { imageUrl, generationId, imageBase64: Buffer.from(bytes).toString('base64') };
    }
    if (gen?.status === 'FAILED') throw new Error('Leonardo generation failed');
  }
  throw new Error(`Leonardo generation timed out after ${(MAX_POLL_ATTEMPTS * pollMs) / 1000}s`);
}
```

(The `getApiKey()` usage moved into `authHeaders`; the standalone `const apiKey = getApiKey()` line is removed.)

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run src/__tests__/leonardo/leonardo-client.test.ts`
Expected: PASS (all generateImage + Task A1 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leonardo.ts src/__tests__/leonardo/leonardo-client.test.ts
git commit -m "feat(leonardo): generateImage advanced options + download-then-delete cleanup"
```

---

### Task A3: `upscaleImage`

**Files:**
- Modify: `src/lib/leonardo.ts`
- Test: `src/__tests__/leonardo/leonardo-client.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { upscaleImage } from '@/lib/leonardo';

describe('upscaleImage', () => {
  it('POSTs the image id + style to /universal-upscaler', async () => {
    const { calls } = installFetch((url, method) => {
      if (method === 'POST' && url.endsWith('/universal-upscaler')) {
        return { body: { universalUpscaler: { id: 'up-1' } } };
      }
      return { body: {} };
    });
    const res = await upscaleImage('img-7', 'GENERAL');
    const post = calls.find((c) => c.url.endsWith('/universal-upscaler'));
    expect(post!.body).toEqual({ generatedImageId: 'img-7', upscalerStyle: 'GENERAL' });
    expect(res.upscaleJobId).toBe('up-1');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/__tests__/leonardo/leonardo-client.test.ts -t upscaleImage`
Expected: FAIL — `upscaleImage` not exported.

- [ ] **Step 3: Implement — append to `src/lib/leonardo.ts`**

```typescript
/**
 * Universal Upscaler. The exact response key is endpoint-version-dependent;
 * parse the common candidates and surface the job id.
 */
export async function upscaleImage(
  generatedImageId: string,
  style: string = 'GENERAL',
): Promise<{ upscaleJobId: string }> {
  const res = await fetch(`${LEONARDO_API_BASE}/universal-upscaler`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ generatedImageId, upscalerStyle: style }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Leonardo upscale failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    universalUpscaler?: { id?: string };
    sdUpscaleJob?: { id?: string };
  };
  const upscaleJobId = data.universalUpscaler?.id ?? data.sdUpscaleJob?.id;
  if (!upscaleJobId) throw new Error('Leonardo upscale returned no job id');
  return { upscaleJobId };
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run src/__tests__/leonardo/leonardo-client.test.ts -t upscaleImage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leonardo.ts src/__tests__/leonardo/leonardo-client.test.ts
git commit -m "feat(leonardo): add upscaleImage (universal upscaler)"
```

---

### Task A4: `generateTextureOn3DModel` (the 3-step OBJ endpoint)

**Files:**
- Modify: `src/lib/leonardo.ts`
- Test: `src/__tests__/leonardo/leonardo-client.test.ts`

> **Note:** the 3D-texture endpoint is FAQ-"legacy"-flagged; request/response field names below follow the `leonardo-api-capabilities` memory and are best-effort. The unit test pins the **request bodies we send** and that we attempt cleanup. The live response shape is verified (and adjusted if needed) in Part C's run.

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { generateTextureOn3DModel } from '@/lib/leonardo';

describe('generateTextureOn3DModel', () => {
  it('uploads the OBJ, starts a texture job, polls, returns PBR urls, attempts cleanup', async () => {
    const { calls } = installFetch((url, method) => {
      if (method === 'POST' && url.endsWith('/models-3d/upload')) {
        return { body: { uploadModelAsset: { modelId: 'm-1', modelUploadUrl: 'https://s3/put' } } };
      }
      if (method === 'PUT' && url.includes('s3/put')) return { body: {} };
      if (method === 'POST' && url.endsWith('/generations-texture')) {
        return { body: { textureGenerationJob: { id: 'tex-1' } } };
      }
      if (method === 'GET' && url.includes('/generations-texture/tex-1')) {
        return { body: { texture_generation: { status: 'COMPLETE',
          albedo: 'https://cdn/albedo.png', normal: 'https://cdn/normal.png', roughness: 'https://cdn/rough.png' } } };
      }
      return { body: {} };
    });
    const objBytes = new Uint8Array([1, 2, 3]);
    const res = await generateTextureOn3DModel({ objBytes, prompt: 'dark dungeon stone', pollIntervalMs: 1 });
    expect(res.albedoUrl).toBe('https://cdn/albedo.png');
    expect(res.normalUrl).toBe('https://cdn/normal.png');
    expect(res.roughnessUrl).toBe('https://cdn/rough.png');
    expect(res.modelAssetId).toBe('m-1');

    const startTex = calls.find((c) => c.method === 'POST' && c.url.endsWith('/generations-texture'));
    expect(startTex!.body).toEqual({ modelAssetId: 'm-1', prompt: 'dark dungeon stone', preview: false });
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('s3/put'))).toBe(true);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true); // cleanup attempt
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/__tests__/leonardo/leonardo-client.test.ts -t generateTextureOn3DModel`
Expected: FAIL — function not exported.

- [ ] **Step 3: Implement — append to `src/lib/leonardo.ts`**

```typescript
export interface Texture3DRequest {
  objBytes: Uint8Array;
  prompt: string;
  preview?: boolean;
  pollIntervalMs?: number;
}

export interface Texture3DResult {
  modelAssetId: string;
  albedoUrl: string;
  normalUrl?: string;
  roughnessUrl?: string;
}

/**
 * Texture a UV-mapped OBJ via the legacy 3-step Leonardo 3D-texture endpoint:
 *   POST /models-3d/upload -> PUT <presigned> -> POST /generations-texture -> poll.
 * Best-effort field parsing (endpoint is legacy). Attempts to delete the job after.
 */
export async function generateTextureOn3DModel(req: Texture3DRequest): Promise<Texture3DResult> {
  const pollMs = req.pollIntervalMs ?? POLL_INTERVAL_MS;

  const upRes = await fetch(`${LEONARDO_API_BASE}/models-3d/upload`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ name: 'arena', modelType: 'OBJ' }),
  });
  if (!upRes.ok) throw new Error(`Leonardo 3D upload init failed (${upRes.status})`);
  const upData = (await upRes.json()) as {
    uploadModelAsset?: { modelId?: string; modelUploadUrl?: string };
  };
  const modelAssetId = upData.uploadModelAsset?.modelId;
  const modelUploadUrl = upData.uploadModelAsset?.modelUploadUrl;
  if (!modelAssetId || !modelUploadUrl) throw new Error('Leonardo 3D upload returned no presigned URL');

  const putRes = await fetch(modelUploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: req.objBytes,
  });
  if (!putRes.ok) throw new Error(`Leonardo OBJ PUT failed (${putRes.status})`);

  const startRes = await fetch(`${LEONARDO_API_BASE}/generations-texture`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ modelAssetId, prompt: req.prompt, preview: req.preview ?? false }),
  });
  if (!startRes.ok) throw new Error(`Leonardo texture job start failed (${startRes.status})`);
  const startData = (await startRes.json()) as { textureGenerationJob?: { id?: string } };
  const jobId = startData.textureGenerationJob?.id;
  if (!jobId) throw new Error('Leonardo texture job returned no id');

  try {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(pollMs);
      const pollRes = await fetch(`${LEONARDO_API_BASE}/generations-texture/${jobId}`, {
        headers: authHeaders(),
      });
      if (!pollRes.ok) continue;
      const data = (await pollRes.json()) as {
        texture_generation?: { status?: string; albedo?: string; normal?: string; roughness?: string };
      };
      const t = data.texture_generation;
      if (t?.status === 'COMPLETE' && t.albedo) {
        return { modelAssetId, albedoUrl: t.albedo, normalUrl: t.normal, roughnessUrl: t.roughness };
      }
      if (t?.status === 'FAILED') throw new Error('Leonardo texture generation failed');
    }
    throw new Error('Leonardo texture generation timed out');
  } finally {
    // Cleanup: delete the texture job (mirrors the generation cleanup protocol).
    const del = await fetch(`${LEONARDO_API_BASE}/generations-texture/${jobId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (!del.ok) logger.warn(`[leonardo] texture job ${jobId} delete returned ${del.status}`);
  }
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run src/__tests__/leonardo/leonardo-client.test.ts`
Expected: PASS (all client tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leonardo.ts src/__tests__/leonardo/leonardo-client.test.ts
git commit -m "feat(leonardo): add generateTextureOn3DModel (3D-texture-on-OBJ endpoint)"
```

---

### Task A5: API route `mode` routing (back-compat)

**Files:**
- Modify: `src/app/api/leonardo/route.ts`
- Test: `src/__tests__/leonardo/leonardo-route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/leonardo/leonardo-route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/leonardo', () => ({
  generateImage: vi.fn(async () => ({ imageUrl: 'u', generationId: 'g', imageBase64: 'YQ==' })),
  upscaleImage: vi.fn(async () => ({ upscaleJobId: 'up-1' })),
  generateTextureOn3DModel: vi.fn(async () => ({ modelAssetId: 'm', albedoUrl: 'a', normalUrl: 'n', roughnessUrl: 'r' })),
}));

import { POST } from '@/app/api/leonardo/route';
import * as leo from '@/lib/leonardo';

function req(body: unknown): Request {
  return new Request('http://localhost/api/leonardo', { method: 'POST', body: JSON.stringify(body) });
}

beforeEach(() => { process.env.LEONARDO_API_KEY = 'k'; vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /api/leonardo', () => {
  it('back-compat: prompt-only routes to image mode', async () => {
    const res = await POST(req({ prompt: 'a sword' }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.imageUrl).toBe('u');
    expect(leo.generateImage).toHaveBeenCalledWith('a sword', {});
  });

  it('mode=image forwards opts', async () => {
    await POST(req({ mode: 'image', prompt: 'rock', opts: { tiling: true } }));
    expect(leo.generateImage).toHaveBeenCalledWith('rock', { tiling: true });
  });

  it('mode=upscale routes to upscaleImage', async () => {
    const res = await POST(req({ mode: 'upscale', imageId: 'img-1', style: 'GENERAL' }));
    const json = await res.json();
    expect(json.data.upscaleJobId).toBe('up-1');
    expect(leo.upscaleImage).toHaveBeenCalledWith('img-1', 'GENERAL');
  });

  it('mode=texture3d routes to generateTextureOn3DModel', async () => {
    const objBase64 = Buffer.from('obj-bytes').toString('base64');
    const res = await POST(req({ mode: 'texture3d', objBase64, prompt: 'stone' }));
    const json = await res.json();
    expect(json.data.albedoUrl).toBe('a');
    expect(leo.generateTextureOn3DModel).toHaveBeenCalled();
  });

  it('rejects missing prompt in image mode', async () => {
    const res = await POST(req({ mode: 'image' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/__tests__/leonardo/leonardo-route.test.ts`
Expected: FAIL — route ignores `mode`/`opts`/`imageId`/`objBase64`.

- [ ] **Step 3: Implement — replace `src/app/api/leonardo/route.ts`**

```typescript
import { apiSuccess, apiError } from '@/lib/api-utils';
import { generateImage, upscaleImage, generateTextureOn3DModel, type GenerateImageOptions } from '@/lib/leonardo';
import { logger } from '@/lib/logger';

type Mode = 'image' | 'upscale' | 'texture3d';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode: Mode = body?.mode ?? 'image';

    if (!process.env.LEONARDO_API_KEY) {
      return apiError('LEONARDO_API_KEY not configured', 500);
    }

    if (mode === 'image') {
      const prompt = body?.prompt;
      if (!prompt || typeof prompt !== 'string') return apiError('Missing or invalid "prompt" field', 400);
      if (prompt.length > 1500) return apiError('Prompt exceeds 1500 character limit', 400);
      const opts: GenerateImageOptions = body?.opts ?? {};
      const result = await generateImage(prompt, opts);
      return apiSuccess(result);
    }

    if (mode === 'upscale') {
      const imageId = body?.imageId;
      if (!imageId || typeof imageId !== 'string') return apiError('Missing "imageId" for upscale', 400);
      const result = await upscaleImage(imageId, typeof body?.style === 'string' ? body.style : 'GENERAL');
      return apiSuccess(result);
    }

    if (mode === 'texture3d') {
      const { objBase64, prompt, preview } = body ?? {};
      if (!objBase64 || typeof objBase64 !== 'string') return apiError('Missing "objBase64" for texture3d', 400);
      if (!prompt || typeof prompt !== 'string') return apiError('Missing "prompt" for texture3d', 400);
      const objBytes = new Uint8Array(Buffer.from(objBase64, 'base64'));
      const result = await generateTextureOn3DModel({ objBytes, prompt, preview: Boolean(preview) });
      return apiSuccess(result);
    }

    return apiError(`Unknown mode "${String(mode)}"`, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[api/leonardo] ${message}`);
    return apiError(message, 500);
  }
}
```

- [ ] **Step 4: Run to confirm pass + full Part-A suite + typecheck**

Run: `npx vitest run src/__tests__/leonardo/ && npm run typecheck`
Expected: PASS (all leonardo tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leonardo/route.ts src/__tests__/leonardo/leonardo-route.test.ts
git commit -m "feat(api/leonardo): mode routing for image/upscale/texture3d (back-compat)"
```

---

### Task A6: Live smoke — one tiling generation, verify download-then-delete

**Files:** none (operational verification)

- [ ] **Step 1:** Confirm `LEONARDO_API_KEY` is present in `C:\Users\kazda\kiro\personas\.env`. If a PoF dev server is already running, do not start another; otherwise run `npm run dev` in the background.

- [ ] **Step 2:** Fire one tiling generation through the route:

```powershell
$body = @{ mode = 'image'; prompt = 'seamless dark fantasy dungeon stone wall, tileable, PBR albedo'; opts = @{ tiling = $true; modelId = '05ce0082-2d80-4a2d-8653-4d1c85e2418e' } } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/leonardo -Method Post -ContentType 'application/json' -Body $body
```

Expected: `success = True`, an `imageUrl`, and a non-empty `imageBase64`.

- [ ] **Step 3:** Verify no leftover generation on the Leonardo account. Either confirm in the Leonardo web UI that the just-created generation is gone, or that the route's server logs show `[leonardo] Deleted generation <id>`. Record the result in the findings doc (Task FINAL).

- [ ] **Step 4: Commit** — nothing to commit; note the smoke result for the findings doc.

---

# PART B — Master material + reparent (UE) + prompt gotcha (PoF)

### Task B1: Constant3Vector gotcha + prefer-MI guidance in `material-configurator.ts`

**Files:**
- Modify: `src/lib/prompts/material-configurator.ts:102-112`
- Test: `src/__tests__/materials/material-configurator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/materials/material-configurator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildMaterialConfiguratorPrompt } from '@/lib/prompts/material-configurator';
import type { MaterialConfiguratorConfig } from '@/components/modules/content/materials/MaterialParameterConfigurator';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
};

const config: MaterialConfiguratorConfig = {
  surfaceType: 'stone',
  features: [],
  outputType: 'instance',
  params: { Roughness: { name: 'Roughness', min: 0, max: 1, defaultValue: 0.8, step: 0.01 } },
};

describe('buildMaterialConfiguratorPrompt — TM gotchas', () => {
  it('carries the Constant3Vector empty-output-pin gotcha', () => {
    const prompt = buildMaterialConfiguratorPrompt(config, ctx);
    expect(prompt).toMatch(/Constant3Vector/);
    expect(prompt).toMatch(/output pin is\s*""/);
    expect(prompt).toMatch(/renders? black/i);
  });

  it('prefers emitting a MaterialInstanceConstant of a shared master', () => {
    const prompt = buildMaterialConfiguratorPrompt(config, ctx);
    expect(prompt).toMatch(/MaterialInstanceConstant/);
    expect(prompt).toMatch(/M_ARPG_Surface_Master/);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/__tests__/materials/material-configurator.test.ts`
Expected: FAIL — strings absent.

- [ ] **Step 3: Implement — edit the `.withBestPractices([...])` array (lines 102-112)**

Append these two entries to the array (after the existing Substrate entry):

```typescript
      'CRITICAL UE5 authoring gotcha: a Constant3Vector expression\'s color output pin is named "" (the empty string), NOT "RGB". connect_material_property(node, "RGB", ...) silently returns false and the material renders black. Use a VectorParameter for tunable colors (its output IS "RGB"), or pass "" when wiring a Constant3Vector.',
      'Prefer emitting a MaterialInstanceConstant of the shared master M_ARPG_Surface_Master over authoring a new one-off Material. Instances share the compiled shader, keep the project consolidated, and expose Albedo/Normal/Roughness texture params + BaseColorTint + TilingScale + EmissiveStrength.',
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run src/__tests__/materials/material-configurator.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts/material-configurator.ts src/__tests__/materials/material-configurator.test.ts
git commit -m "feat(material-configurator): Constant3Vector gotcha + prefer shared-master instances"
```

---

### Task B2: `build_master_material.py` — create `M_ARPG_Surface_Master`

**Files:**
- Create: `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\build_master_material.py`

> Mirrors the proven material-graph code in `build_arena_ue.py` (TextureSample → `connect_material_property` with "RGB"/"R", `SAMPLERTYPE_NORMAL`, `SAMPLERTYPE_LINEAR_GRAYSCALE`). Uses `TextureSampleParameter2D` (parameterised) + a `TextureCoordinate × ScalarParameter` tiling driver + a `VectorParameter` tint. **No Constant3Vector** (we use VectorParameter, whose output IS "RGB").

- [ ] **Step 1: Write the script**

```python
"""
build_master_material.py
========================
Creates /Game/Materials/M_ARPG_Surface_Master — a parameterised PBR master
material that M_Arena_* and M_EnemyRed reparent to (see reparent_materials.py).

Parameters:
  - Albedo / Normal / Roughness  (TextureSampleParameter2D)
  - TilingScale (ScalarParameter, default 1.0) * TextureCoordinate -> all UVs
  - BaseColorTint (VectorParameter, default white) * albedo -> Base Color
  - EmissiveStrength (ScalarParameter, default 0.0) * BaseColorTint -> Emissive

Run headless (NOTE: -ExecutePythonScript, not -run=pythonscript):
    "C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor.exe" ^
        "C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\\PoF.uproject" ^
        -ExecutePythonScript="<abs path to this file>" -unattended -nopause -nosplash
Headless editor exits with code 3 on a clean run (benign).
"""

import unreal

MASTER_PATH = "/Game/Materials/M_ARPG_Surface_Master"

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
asset_lib = unreal.EditorAssetLibrary
mat_lib = unreal.MaterialEditingLibrary


def _log(msg):
    unreal.log("[build_master_material] " + msg)


def split_path(package_path):
    idx = package_path.rfind("/")
    return package_path[:idx], package_path[idx + 1:]


def make_param_sampler(material, param_name, x, y, sampler_type, group="Textures"):
    node = mat_lib.create_material_expression(
        material, unreal.MaterialExpressionTextureSampleParameter2D, x, y)
    node.set_editor_property("parameter_name", param_name)
    node.set_editor_property("group", group)
    node.set_editor_property("sampler_type", sampler_type)
    return node


def main():
    _log("=== build M_ARPG_Surface_Master START ===")
    folder, name = split_path(MASTER_PATH)

    if asset_lib.does_asset_exist(MASTER_PATH):
        asset_lib.delete_asset(MASTER_PATH)  # idempotent rebuild

    factory = unreal.MaterialFactoryNew()
    material = asset_tools.create_asset(name, folder, unreal.Material, factory)
    if material is None:
        raise RuntimeError("failed to create " + MASTER_PATH)

    # --- Tiling driver: TextureCoordinate * TilingScale -> sampler UVs --------
    texcoord = mat_lib.create_material_expression(
        material, unreal.MaterialExpressionTextureCoordinate, -900, -100)
    tiling = mat_lib.create_material_expression(
        material, unreal.MaterialExpressionScalarParameter, -900, 60)
    tiling.set_editor_property("parameter_name", "TilingScale")
    tiling.set_editor_property("default_value", 1.0)
    tiling.set_editor_property("group", "Tiling")
    uv_mul = mat_lib.create_material_expression(
        material, unreal.MaterialExpressionMultiply, -700, -20)
    mat_lib.connect_material_expressions(texcoord, "", uv_mul, "A")
    mat_lib.connect_material_expressions(tiling, "", uv_mul, "B")

    # --- Albedo ---------------------------------------------------------------
    albedo = make_param_sampler(material, "Albedo", -400, -260,
                                unreal.MaterialSamplerType.SAMPLERTYPE_COLOR)
    mat_lib.connect_material_expressions(uv_mul, "", albedo, "UVs")

    tint = mat_lib.create_material_expression(
        material, unreal.MaterialExpressionVectorParameter, -400, -440)
    tint.set_editor_property("parameter_name", "BaseColorTint")
    tint.set_editor_property("default_value", unreal.LinearColor(1.0, 1.0, 1.0, 1.0))
    tint.set_editor_property("group", "Color")

    base_mul = mat_lib.create_material_expression(
        material, unreal.MaterialExpressionMultiply, -150, -300)
    # VectorParameter output IS "RGB" (unlike Constant3Vector, whose pin is "").
    mat_lib.connect_material_expressions(albedo, "RGB", base_mul, "A")
    mat_lib.connect_material_expressions(tint, "RGB", base_mul, "B")
    mat_lib.connect_material_property(base_mul, "", unreal.MaterialProperty.MP_BASE_COLOR)

    # --- Normal ---------------------------------------------------------------
    normal = make_param_sampler(material, "Normal", -400, 0,
                                unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
    mat_lib.connect_material_expressions(uv_mul, "", normal, "UVs")
    mat_lib.connect_material_property(normal, "RGB", unreal.MaterialProperty.MP_NORMAL)

    # --- Roughness ------------------------------------------------------------
    rough = make_param_sampler(material, "Roughness", -400, 260,
                               unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_GRAYSCALE)
    mat_lib.connect_material_expressions(uv_mul, "", rough, "UVs")
    mat_lib.connect_material_property(rough, "R", unreal.MaterialProperty.MP_ROUGHNESS)

    # --- Emissive (enemy): BaseColorTint * EmissiveStrength -> Emissive -------
    emissive_strength = mat_lib.create_material_expression(
        material, unreal.MaterialExpressionScalarParameter, -400, 460)
    emissive_strength.set_editor_property("parameter_name", "EmissiveStrength")
    emissive_strength.set_editor_property("default_value", 0.0)
    emissive_strength.set_editor_property("group", "Emissive")
    emissive_mul = mat_lib.create_material_expression(
        material, unreal.MaterialExpressionMultiply, -150, 400)
    mat_lib.connect_material_expressions(tint, "RGB", emissive_mul, "A")
    mat_lib.connect_material_expressions(emissive_strength, "", emissive_mul, "B")
    mat_lib.connect_material_property(emissive_mul, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)

    mat_lib.recompile_material(material)
    asset_lib.save_asset(MASTER_PATH)

    # Diagnostic: list the exposed scalar + vector + texture params.
    scalars = mat_lib.get_scalar_parameter_names(material)
    vectors = mat_lib.get_vector_parameter_names(material)
    textures = mat_lib.get_texture_parameter_names(material)
    _log("Scalar params: " + ", ".join(str(s) for s in scalars))
    _log("Vector params: " + ", ".join(str(v) for v in vectors))
    _log("Texture params: " + ", ".join(str(t) for t in textures))
    _log("=== build M_ARPG_Surface_Master COMPLETE: " + MASTER_PATH + " ===")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it headless**

Run (PowerShell, single line):

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecutePythonScript="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\build_master_material.py" -unattended -nopause -nosplash
```

Expected log lines: `Scalar params: TilingScale, EmissiveStrength`, `Vector params: BaseColorTint`, `Texture params: Albedo, Normal, Roughness`, then `COMPLETE`. Process exits 3 (benign for headless).

- [ ] **Step 3: Verify the asset exists** — confirm `/Game/Materials/M_ARPG_Surface_Master.uasset` is on disk under `Content/Materials/`. If the param-name diagnostics are missing any of the six params, fix the corresponding `set_editor_property("parameter_name", ...)` and re-run.

- [ ] **Step 4: Commit (UE repo)**

```bash
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" add Content/Python/build_master_material.py Content/Materials/M_ARPG_Surface_Master.uasset
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" commit -m "feat(materials): M_ARPG_Surface_Master parameterised PBR master"
```

---

### Task B3: `reparent_materials.py` — `MI_Arena_*` + `MI_EnemyRed` instances

**Files:**
- Create: `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\reparent_materials.py`

> Creates `MaterialInstanceConstant`s of the master under `/Game/Materials/`, sets texture/tint params to match today's look, and reassigns `SM_Arena`'s slots. Reads the existing `/Game/ArenaBuild/Textures/T_*` textures (does **not** rebuild them). The enemy swap is best-effort + guarded.

- [ ] **Step 1: Write the script**

```python
"""
reparent_materials.py
=====================
Consolidates the arena + enemy materials onto M_ARPG_Surface_Master without a
visual change. Creates MaterialInstanceConstants under /Game/Materials/, sets
their params from the existing /Game/ArenaBuild/Textures/T_* textures, and
reassigns SM_Arena's slots. Idempotent. Does NOT edit build_arena_ue.py or
setup_characters_ue.py (parallel branches own those).

Run headless: -ExecutePythonScript=<abs path>  (see build_master_material.py).
"""

import unreal

MASTER_PATH = "/Game/Materials/M_ARPG_Surface_Master"
SM_ARENA_PATH = "/Game/ArenaBuild/SM_Arena"
TEX = "/Game/ArenaBuild/Textures"

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
asset_lib = unreal.EditorAssetLibrary
mic_lib = unreal.MaterialEditingLibrary

# slot name on SM_Arena -> (instance path, texture surface prefix)
ARENA_SLOTS = {
    "M_Floor":  ("/Game/Materials/MI_Arena_Floor",  "floor"),
    "M_Wall":   ("/Game/Materials/MI_Arena_Wall",   "wall"),
    "M_Pillar": ("/Game/Materials/MI_Arena_Pillar", "pillar"),
}


def _log(msg):
    unreal.log("[reparent_materials] " + msg)


def split_path(p):
    idx = p.rfind("/")
    return p[:idx], p[idx + 1:]


def load(path):
    return asset_lib.load_asset(path) if asset_lib.does_asset_exist(path) else None


def make_instance(inst_path, master):
    folder, name = split_path(inst_path)
    if asset_lib.does_asset_exist(inst_path):
        asset_lib.delete_asset(inst_path)
    factory = unreal.MaterialInstanceConstantFactoryNew()
    inst = asset_tools.create_asset(name, folder, unreal.MaterialInstanceConstant, factory)
    mic_lib.set_material_instance_parent(inst, master)
    return inst


def set_tex(inst, param, tex_path):
    tex = load(tex_path)
    if tex is None:
        unreal.log_warning("[reparent_materials] missing texture " + tex_path)
        return
    mic_lib.set_material_instance_texture_parameter_value(inst, param, tex)


def main():
    _log("=== reparent START ===")
    master = load(MASTER_PATH)
    if master is None:
        raise RuntimeError("master missing; run build_master_material.py first")

    # --- Arena instances ------------------------------------------------------
    made = {}
    for slot, (inst_path, surface) in ARENA_SLOTS.items():
        inst = make_instance(inst_path, master)
        set_tex(inst, "Albedo",    "%s/T_%s_albedo" % (TEX, surface))
        set_tex(inst, "Normal",    "%s/T_%s_normal" % (TEX, surface))
        set_tex(inst, "Roughness", "%s/T_%s_rough" % (TEX, surface))
        mic_lib.set_material_instance_scalar_parameter_value(inst, "TilingScale", 1.0)
        mic_lib.set_material_instance_vector_parameter_value(
            inst, "BaseColorTint", unreal.LinearColor(1.0, 1.0, 1.0, 1.0))
        asset_lib.save_asset(inst_path)
        made[slot] = inst
        _log("Built " + inst_path)

    # --- Reassign SM_Arena slots ---------------------------------------------
    mesh = load(SM_ARENA_PATH)
    if mesh is None:
        unreal.log_warning("[reparent_materials] SM_Arena missing; skipping slot reassign")
    else:
        static_materials = mesh.get_editor_property("static_materials")
        for idx in range(len(static_materials)):
            slot = str(static_materials[idx].get_editor_property("material_slot_name"))
            inst = made.get(slot)
            if inst is not None:
                mesh.set_material(idx, inst)
                _log("Assigned %s -> slot[%d] '%s'" % (inst.get_path_name(), idx, slot))
        asset_lib.save_asset(SM_ARENA_PATH)

    # --- Enemy: MI_EnemyRed (red tint + emissive), best-effort swap ----------
    mi_enemy_path = "/Game/Materials/MI_EnemyRed"
    enemy_inst = make_instance(mi_enemy_path, master)
    mic_lib.set_material_instance_vector_parameter_value(
        enemy_inst, "BaseColorTint", unreal.LinearColor(0.8, 0.05, 0.05, 1.0))
    mic_lib.set_material_instance_scalar_parameter_value(enemy_inst, "EmissiveStrength", 1.5)
    asset_lib.save_asset(mi_enemy_path)
    _log("Built " + mi_enemy_path)

    # Swap any asset/actor referencing the old one-off M_EnemyRed, if findable.
    for candidate in ["/Game/Materials/M_EnemyRed", "/Game/Characters/M_EnemyRed",
                      "/Game/M_EnemyRed"]:
        if asset_lib.does_asset_exist(candidate):
            _log("Found legacy enemy material at " + candidate +
                 " (leave in place; MI_EnemyRed available for manual/automated swap)")
            break

    _log("=== reparent COMPLETE ===")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it headless**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecutePythonScript="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\reparent_materials.py" -unattended -nopause -nosplash
```

Expected: `Built /Game/Materials/MI_Arena_Floor` (+Wall/Pillar/EnemyRed), `Assigned ... -> slot[..]` for the three arena slots, `COMPLETE`. If any `missing texture` warning appears, confirm the `T_*` names against `/Game/ArenaBuild/Textures/` and fix the prefix.

- [ ] **Step 3: Commit (UE repo)**

```bash
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" add Content/Python/reparent_materials.py Content/Materials/MI_Arena_Floor.uasset Content/Materials/MI_Arena_Wall.uasset Content/Materials/MI_Arena_Pillar.uasset Content/Materials/MI_EnemyRed.uasset Content/ArenaBuild/SM_Arena.uasset
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" commit -m "feat(materials): reparent arena + enemy materials onto M_ARPG_Surface_Master"
```

---

### Task B4: Verify Part B — PS-1 functional test green + Gemini "unchanged"

**Files:** none (verification)

- [ ] **Step 1: Run the PS-1 functional test** (gameplay must be unaffected by a material refactor):

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecCmds="Automation RunTests Project.Functional Tests.PoF; Quit" -unattended -nopause -nosplash -TestExit="Automation Test Queue Empty"
```

Expected: the log contains `Result={Success}` for the slice functional test. If `Result={Failure}`, the reparent broke a binding — inspect the per-assertion lines, fix the slot/param mismatch, re-run Task B3.

- [ ] **Step 2: Screenshot + Gemini check** — launch the slice, capture a `HighResShot`, and ask Gemini whether the arena + enemy look the same as before (a refactor, not a re-skin):

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" /Game/Maps/VerticalSlice -game -windowed -ResX=1280 -ResY=720 -ExecCmds="HighResShot 1280x720; Quit" -unattended -nopause -nosplash
```

Then run the Gemini check on the newest PNG in `Saved/Screenshots/` with the prompt "Does this show a textured stone arena with a visible red enemy character? Answer yes or no and describe the surfaces." (use `personas/.claude/skills/leonardo/tools/gemini-recognize.mjs`, loading `GEMINI_API_KEY` from `personas/.env`).

Expected: Gemini confirms a textured stone arena + a red enemy — i.e., visually consistent with the pre-reparent look. Record the verdict in the findings doc.

- [ ] **Step 3:** No commit (verification only). Note results for Task FINAL.

---

# PART C — Arena re-texture via the 3D-texture endpoint

> **Exploratory** — the 3D endpoint is legacy-flagged. Honest fallback: if it fails, returns no usable maps, or Gemini judges it **worse** than PS-3's tiled textures, keep PS-3's textures and record the finding. Parts A+B stand regardless.

### Task C1: `export_arena_obj.py` — export `SM_Arena` to a UV-mapped OBJ

**Files:**
- Create: `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\export_arena_obj.py`

- [ ] **Step 1: Write the script**

```python
"""
export_arena_obj.py
===================
Exports /Game/ArenaBuild/SM_Arena to a UV-mapped OBJ at
Content/ArenaBuild/Arena.obj for Leonardo's 3D-texture endpoint (OBJ + UVs
required). Does NOT touch build_arena.py / build_arena_ue.py.

Run headless: -ExecutePythonScript=<abs path>.
"""

import os
import unreal

SM_ARENA_PATH = "/Game/ArenaBuild/SM_Arena"
OUT_OBJ = os.path.normpath(os.path.join(
    unreal.Paths.project_dir(), "Content", "ArenaBuild", "Arena.obj"))

asset_lib = unreal.EditorAssetLibrary


def _log(msg):
    unreal.log("[export_arena_obj] " + msg)


def main():
    _log("=== export START ===")
    mesh = asset_lib.load_asset(SM_ARENA_PATH)
    if mesh is None:
        raise RuntimeError("SM_Arena missing at " + SM_ARENA_PATH)

    task = unreal.AssetExportTask()
    task.set_editor_property("object", mesh)
    task.set_editor_property("filename", OUT_OBJ)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_identical", True)
    task.set_editor_property("prompt", False)
    task.set_editor_property("exporter", unreal.StaticMeshExporterOBJ())
    ok = unreal.Exporter.run_asset_export_task(task)
    if not ok or not os.path.isfile(OUT_OBJ):
        raise RuntimeError("OBJ export failed; expected " + OUT_OBJ)
    _log("Exported OBJ: %s (%d bytes)" % (OUT_OBJ, os.path.getsize(OUT_OBJ)))
    _log("=== export COMPLETE ===")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it headless**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecutePythonScript="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\export_arena_obj.py" -unattended -nopause -nosplash
```

Expected: `Exported OBJ: ...Arena.obj (N bytes)`.

- [ ] **Step 3: Fallback if `StaticMeshExporterOBJ` is unavailable / produces no UVs.** Re-export from the Blender source headlessly (a NEW throwaway script, not `build_arena.py`): import the existing `Content/ArenaBuild/Arena.fbx`, export OBJ with UVs. Minimal command:

```powershell
& "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" --background --python-expr "import bpy,os; p=r'C:\Users\kazda\Documents\Unreal Projects\PoF\Content\ArenaBuild'; bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.fbx(filepath=os.path.join(p,'Arena.fbx')); bpy.ops.wm.obj_export(filepath=os.path.join(p,'Arena.obj'), export_uv=True, export_normals=True)"
```

Expected: `Arena.obj` written with UVs. Record which path (UE exporter vs Blender fallback) worked.

- [ ] **Step 4: Commit (UE repo)**

```bash
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" add Content/Python/export_arena_obj.py Content/ArenaBuild/Arena.obj
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" commit -m "feat(arena): export SM_Arena to UV-mapped OBJ for 3D-texture endpoint"
```

---

### Task C2: `scripts/retexture-arena-runner.mjs` — drive the 3D endpoint, download PBR maps

**Files:**
- Create: `C:\Users\kazda\kiro\pof\scripts\retexture-arena-runner.mjs`

> A Node runner that reads the OBJ, calls the running PoF route (`mode: texture3d`), and writes the returned PBR maps to `Content/ArenaBuild/textures_3d/`. (The route does the Leonardo call + job cleanup.) If the endpoint errors, the runner prints `ENDPOINT_UNUSABLE` and exits 0 so Part C's fallback path proceeds.

- [ ] **Step 1: Write the runner**

```javascript
// Drives the Leonardo 3D-texture endpoint via the PoF route, downloads PBR maps.
// Usage: node scripts/retexture-arena-runner.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const UE = 'C:/Users/kazda/Documents/Unreal Projects/PoF';
const OBJ = join(UE, 'Content/ArenaBuild/Arena.obj');
const OUT = join(UE, 'Content/ArenaBuild/textures_3d');
const ROUTE = process.env.POF_ORIGIN ?? 'http://localhost:3000';
const PROMPT = 'dark fantasy dungeon stone, weathered cobblestone and carved pillars, PBR, coherent across the mesh';

async function downloadMap(url, name) {
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${name} failed (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const path = join(OUT, name);
  await writeFile(path, bytes);
  console.log(`wrote ${path} (${bytes.length} bytes)`);
  return path;
}

async function main() {
  const objBase64 = (await readFile(OBJ)).toString('base64');
  const res = await fetch(`${ROUTE}/api/leonardo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'texture3d', objBase64, prompt: PROMPT }),
  });
  const json = await res.json();
  if (!json.success) {
    console.log('ENDPOINT_UNUSABLE: ' + json.error);
    return; // exit 0 -> fallback path
  }
  await mkdir(OUT, { recursive: true });
  await downloadMap(json.data.albedoUrl, 'arena3d_albedo.png');
  await downloadMap(json.data.normalUrl, 'arena3d_normal.png');
  await downloadMap(json.data.roughnessUrl, 'arena3d_rough.png');
  console.log('PBR_MAPS_READY');
}

main().catch((e) => { console.log('ENDPOINT_UNUSABLE: ' + e.message); });
```

- [ ] **Step 2: Run it** (PoF dev server must be running; reuse the existing one — do not spawn a duplicate):

Run: `node scripts/retexture-arena-runner.mjs`
Expected: either `PBR_MAPS_READY` with 1-3 written files, or `ENDPOINT_UNUSABLE: <reason>`.

- [ ] **Step 3: Record the outcome.** If `ENDPOINT_UNUSABLE`, skip Tasks C3 and the C4 "apply 3D" branch — go straight to "keep PS-3 textures" in the findings doc and finish at Task FINAL. If `PBR_MAPS_READY`, continue.

- [ ] **Step 4: Commit (app repo, local only)**

```bash
git add scripts/retexture-arena-runner.mjs
git commit -m "feat(arena): runner to drive Leonardo 3D-texture endpoint + download PBR maps"
```

---

### Task C3: `retexture_arena_3d.py` — import maps, make `MI_Arena_3D`, apply

**Files:**
- Create: `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\retexture_arena_3d.py`

> Only run if Task C2 produced PBR maps. Imports them, creates one `MI_Arena_3D` instance of the master, and applies it to all SM_Arena slots (the 3D endpoint produces a coherent per-mesh set, not per-slot).

- [ ] **Step 1: Write the script**

```python
"""
retexture_arena_3d.py
====================
Imports the Leonardo 3D-texture PBR maps from Content/ArenaBuild/textures_3d/,
creates MI_Arena_3D (instance of M_ARPG_Surface_Master), and applies it to all
SM_Arena slots. Only run after retexture-arena-runner.mjs wrote the maps.
Reversible: reparent_materials.py reassigns the per-slot MI_Arena_* to revert.

Run headless: -ExecutePythonScript=<abs path>.
"""

import os
import unreal

MASTER_PATH = "/Game/Materials/M_ARPG_Surface_Master"
SM_ARENA_PATH = "/Game/ArenaBuild/SM_Arena"
SRC_DIR = os.path.normpath(os.path.join(
    unreal.Paths.project_dir(), "Content", "ArenaBuild", "textures_3d"))
TEX_FOLDER = "/Game/ArenaBuild/Textures3D"
MI_3D_PATH = "/Game/Materials/MI_Arena_3D"

MAPS = {  # file -> (asset name, param, is_normal, is_linear)
    "arena3d_albedo.png": ("T_arena3d_albedo", "Albedo", False, False),
    "arena3d_normal.png": ("T_arena3d_normal", "Normal", True, False),
    "arena3d_rough.png":  ("T_arena3d_rough",  "Roughness", False, True),
}

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
asset_lib = unreal.EditorAssetLibrary
mic_lib = unreal.MaterialEditingLibrary


def _log(msg):
    unreal.log("[retexture_arena_3d] " + msg)


def split_path(p):
    idx = p.rfind("/")
    return p[:idx], p[idx + 1:]


def import_tex(fname, asset_name, is_normal, is_linear):
    src = os.path.join(SRC_DIR, fname)
    if not os.path.isfile(src):
        return None
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", src)
    task.set_editor_property("destination_path", TEX_FOLDER)
    task.set_editor_property("destination_name", asset_name)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("automated", True)
    task.set_editor_property("save", True)
    asset_tools.import_asset_tasks([task])
    path = "%s/%s" % (TEX_FOLDER, asset_name)
    tex = asset_lib.load_asset(path) if asset_lib.does_asset_exist(path) else None
    if tex is None:
        return None
    if is_normal:
        tex.set_editor_property("compression_settings",
                                unreal.TextureCompressionSettings.TC_NORMALMAP)
        tex.set_editor_property("srgb", False)
    elif is_linear:
        tex.set_editor_property("srgb", False)
    asset_lib.save_asset(path)
    return tex


def main():
    _log("=== retexture 3D START ===")
    master = asset_lib.load_asset(MASTER_PATH)
    if master is None:
        raise RuntimeError("master missing; run build_master_material.py first")

    folder, name = split_path(MI_3D_PATH)
    if asset_lib.does_asset_exist(MI_3D_PATH):
        asset_lib.delete_asset(MI_3D_PATH)
    inst = asset_tools.create_asset(
        name, folder, unreal.MaterialInstanceConstant,
        unreal.MaterialInstanceConstantFactoryNew())
    mic_lib.set_material_instance_parent(inst, master)

    applied = 0
    for fname, (asset_name, param, is_normal, is_linear) in MAPS.items():
        tex = import_tex(fname, asset_name, is_normal, is_linear)
        if tex is not None:
            mic_lib.set_material_instance_texture_parameter_value(inst, param, tex)
            applied += 1
            _log("Bound %s -> %s" % (asset_name, param))
    if applied == 0:
        raise RuntimeError("no 3D PBR maps found in " + SRC_DIR)

    mic_lib.set_material_instance_scalar_parameter_value(inst, "TilingScale", 1.0)
    asset_lib.save_asset(MI_3D_PATH)

    mesh = asset_lib.load_asset(SM_ARENA_PATH)
    if mesh is None:
        raise RuntimeError("SM_Arena missing")
    static_materials = mesh.get_editor_property("static_materials")
    for idx in range(len(static_materials)):
        mesh.set_material(idx, inst)
    asset_lib.save_asset(SM_ARENA_PATH)
    _log("Applied MI_Arena_3D to %d slots" % len(static_materials))
    _log("=== retexture 3D COMPLETE ===")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it headless**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecutePythonScript="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\retexture_arena_3d.py" -unattended -nopause -nosplash
```

Expected: `Bound T_arena3d_albedo -> Albedo` (+ normal/rough if present), `Applied MI_Arena_3D to N slots`, `COMPLETE`.

- [ ] **Step 3: Commit (UE repo)**

```bash
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" add Content/Python/retexture_arena_3d.py Content/ArenaBuild/Textures3D Content/Materials/MI_Arena_3D.uasset Content/ArenaBuild/SM_Arena.uasset
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" commit -m "feat(arena): apply Leonardo 3D-texture PBR set via MI_Arena_3D"
```

---

### Task C4: Gemini A/B (3D-endpoint vs PS-3) — apply the winner

**Files:** none (decision + possible revert)

- [ ] **Step 1: Screenshot the 3D-textured arena** (same view used in Task B4):

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" /Game/Maps/VerticalSlice -game -windowed -ResX=1280 -ResY=720 -ExecCmds="HighResShot 1280x720; Quit" -unattended -nopause -nosplash
```

- [ ] **Step 2: Gemini A/B.** Compare the new 3D-endpoint screenshot against the PS-3 screenshot (from `docs/features/arpg-vertical-slice/` artifacts, or re-shoot after reverting). Prompt Gemini: "Two screenshots of the same stone arena. A is [3D-endpoint], B is [PS-3 tiled]. Which has more coherent, less obviously-repeating stone texturing? Answer A or B and why." Record the verdict.

- [ ] **Step 3: Apply the winner.**
  - If **3D-endpoint wins:** keep the Task C3 state (already applied). Done.
  - If **PS-3 wins, or 3D was unusable:** revert SM_Arena's slots to the per-slot `MI_Arena_*` by re-running `reparent_materials.py`:

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecutePythonScript="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\reparent_materials.py" -unattended -nopause -nosplash
```

Then commit the revert to the UE repo with a message noting PS-3 won.

- [ ] **Step 4:** Record the A/B verdict + the applied choice in the findings doc (Task FINAL).

---

### Task FINAL: Findings doc + final commits

**Files:**
- Create: `C:\Users\kazda\kiro\pof\docs\improvements\06-textures-materials\runs\2026-05-23-run.md`

- [ ] **Step 1: Write the findings doc** capturing: Part A (functions added, vitest result, live smoke download-then-delete confirmation), Part B (master material params, reparent result, PS-1 verdict, Gemini "unchanged" verdict), Part C (which OBJ-export path worked, whether the 3D endpoint was usable + its real response shape if it differed from the assumed fields, the Gemini A/B verdict, which texture set was applied and why). Be honest about anything that didn't work.

- [ ] **Step 2: Full validation (app repo)**

Run: `npm run validate`
Expected: typecheck + lint + test all green.

- [ ] **Step 3: Commit the findings doc + plan/spec (app repo, local only — do NOT push)**

```bash
git add docs/improvements/06-textures-materials/runs/2026-05-23-run.md docs/superpowers/plans/2026-05-23-tm-leonardo-pbr-pipeline.md
git commit -m "docs(06-TM): run findings + implementation plan"
```

- [ ] **Step 4: Confirm UE repo is committed + pushed.** The UE-side commits (Tasks B2/B3/C1/C3/C4) push to `github.com/xkazm04/pof-exp`:

```bash
git -C "C:\Users\kazda\Documents\Unreal Projects\PoF" push
```

- [ ] **Step 5:** Post a chat summary: what shipped in A/B/C, the Gemini verdicts, and the applied arena texture choice.

---

## Self-review

**1. Spec coverage** (against `2026-05-23-tm-leonardo-pbr-pipeline-design.md`):
- Part A — `deleteGeneration`/`downloadThenDelete` (A1), `generateImage` opts + cleanup (A2), `upscaleImage` (A3), `generateTextureOn3DModel` (A4), route `mode` (A5), tests + live smoke (A1-A6). ✓
- Part B — `build_master_material.py` (B2), `reparent_materials.py` for `M_Arena_*` + `M_EnemyRed` (B3), `material-configurator.ts` Constant3Vector + prefer-MI (B1), vitest snapshot (B1), PS-1 + Gemini (B4). ✓
- Part C — `export_arena_obj.py` + Blender fallback (C1), PoF runner → `generateTextureOn3DModel` → download (C2), `retexture_arena_3d.py` (C3), honest A/B + fallback (C4). ✓
- DoD items 1-6 → Tasks A5/B4-final, B2/B3/B4, C3/C4, B1, FINAL, FINAL. ✓
- Isolation contract (new UE scripts only; no edits to `build_arena*.py`/`setup_characters_ue.py`; local prompt edit; app repo local-commit / UE repo push) — encoded in the isolation section + per-task commit commands. ✓

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Every code step is complete. UE/live steps that can't be vitest-unit-tested use concrete run commands + expected log lines + explicit fallbacks (legacy 3D endpoint, OBJ export) rather than fake unit tests — honest about what's verifiable.

**3. Type consistency:** `GenerateImageOptions`/`GenerateImageResult`/`Texture3DRequest`/`Texture3DResult` defined in A2/A4 are the exact names imported by the route (A5) and asserted by tests. `pollIntervalMs` is on the options interfaces used in tests. Master-material param names (`Albedo`/`Normal`/`Roughness`/`TilingScale`/`BaseColorTint`/`EmissiveStrength`) are identical across B2/B3/C3. Asset paths (`M_ARPG_Surface_Master`, `MI_Arena_*`, `MI_Arena_3D`, `SM_Arena`) are consistent across all UE scripts.
