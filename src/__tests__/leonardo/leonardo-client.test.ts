import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deleteGeneration, downloadThenDelete, generateImage, upscaleImage, unzoomImage, generateTextureOn3DModel } from '@/lib/leonardo';

const BASE = 'https://cloud.leonardo.ai/api/rest/v1';

interface Call { url: string; method: string; body?: unknown }

/** A fetch mock that records every call and matches by URL substring + method. */
function installFetch(handler: (url: string, method: string) => {
  ok?: boolean; status?: number; body?: unknown; bytes?: ArrayBuffer;
}): { calls: Call[] } {
  const calls: Call[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: { method?: string; body?: unknown }) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    calls.push({ url, method, body });
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
      // generateImage maps the 'foreground' alias -> Leonardo's 'foreground_only' (API drift fix).
      tiling: true, transparency: 'foreground_only',
    });
  });
});

describe('generateImage advanced controls (ControlNet / inpaint)', () => {
  it('passes controlnets[] through to the generation body verbatim', async () => {
    const { calls } = installGenFetch();
    await generateImage('icon matching this silhouette', {
      pollIntervalMs: 1,
      controlnets: [
        { initImageId: 'img-9', initImageType: 'UPLOADED', preprocessorId: 67, weight: 0.6, strengthType: 'Mid' },
      ],
    });
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/generations'));
    expect(post!.body).toMatchObject({
      controlnets: [
        { initImageId: 'img-9', initImageType: 'UPLOADED', preprocessorId: 67, weight: 0.6, strengthType: 'Mid' },
      ],
    });
  });

  it('sets canvas_request INPAINT + init_image_id (+ mask) for inpaint', async () => {
    const { calls } = installGenFetch();
    await generateImage('repair the cracked region', {
      pollIntervalMs: 1,
      inpaint: { initImageId: 'base-1', maskImageId: 'mask-1' },
    });
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/generations'));
    expect(post!.body).toMatchObject({
      init_image_id: 'base-1',
      canvas_request: true,
      canvas_request_type: 'INPAINT',
      mask_file_id: 'mask-1',
    });
  });

  it('inpaint without a mask omits mask_file_id', async () => {
    const { calls } = installGenFetch();
    await generateImage('extend', { pollIntervalMs: 1, inpaint: { initImageId: 'base-2' } });
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/generations'));
    expect(post!.body).toMatchObject({ init_image_id: 'base-2', canvas_request_type: 'INPAINT' });
    expect((post!.body as Record<string, unknown>).mask_file_id).toBeUndefined();
  });
});

describe('unzoomImage', () => {
  it('POSTs the generated-image id to /variations/unzoom and returns the job id', async () => {
    const { calls } = installFetch((url, method) => {
      if (method === 'POST' && url.endsWith('/variations/unzoom')) {
        return { body: { sdUnzoomJob: { id: 'uz-1' } } };
      }
      return { body: {} };
    });
    const res = await unzoomImage('img-7');
    const post = calls.find((c) => c.url.endsWith('/variations/unzoom'));
    expect(post!.body).toMatchObject({ id: 'img-7', isVariation: false });
    expect(res.unzoomJobId).toBe('uz-1');
  });

  it('forwards an optional prompt for the extended region', async () => {
    const { calls } = installFetch((url) =>
      url.endsWith('/variations/unzoom') ? { body: { sdUnzoomJob: { id: 'uz-2' } } } : { body: {} },
    );
    await unzoomImage('img-8', { prompt: 'more dungeon floor' });
    const post = calls.find((c) => c.url.endsWith('/variations/unzoom'));
    expect((post!.body as Record<string, unknown>).prompt).toBe('more dungeon floor');
  });

  it('throws when the unzoom job returns no id', async () => {
    installFetch(() => ({ body: {} }));
    await expect(unzoomImage('img-9')).rejects.toThrow(/no.*id/i);
  });
});

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

describe('generateTextureOn3DModel', () => {
  const S3 = 'https://s3upload.example/put';

  function install3D(handler?: (url: string, method: string) => ReturnType<Parameters<typeof installFetch>[0]>): { calls: Call[] } {
    return installFetch((url, method) => {
      if (method === 'POST' && url.endsWith('/models-3d/upload')) {
        return { body: { uploadModelAsset: {
          modelId: 'm-1', modelUrl: S3,
          modelFields: JSON.stringify({ key: 'users/x/mesh.obj', Policy: 'p', 'X-Amz-Signature': 's' }),
        } } };
      }
      if (method === 'POST' && url === S3) return { status: 204 };
      if (handler) {
        const r = handler(url, method);
        if (r) return r;
      }
      if (method === 'POST' && url.endsWith('/generations-texture')) {
        return { body: { textureGenerationJob: { id: 'tex-1' } } };
      }
      if (method === 'GET' && url.includes('/generations-texture/tex-1')) {
        return { body: { texture_generation: { status: 'COMPLETE',
          albedo: 'https://cdn/albedo.png', normal: 'https://cdn/normal.png', roughness: 'https://cdn/rough.png' } } };
      }
      return { body: {} };
    });
  }

  it('uploads the OBJ via S3 multipart POST, starts a job, polls, returns PBR urls, cleans up', async () => {
    const { calls } = install3D();
    const objBytes = new Uint8Array([1, 2, 3]);
    const res = await generateTextureOn3DModel({ objBytes, prompt: 'dark dungeon stone', pollIntervalMs: 1 });
    expect(res.albedoUrl).toBe('https://cdn/albedo.png');
    expect(res.normalUrl).toBe('https://cdn/normal.png');
    expect(res.roughnessUrl).toBe('https://cdn/rough.png');
    expect(res.modelAssetId).toBe('m-1');

    const init = calls.find((c) => c.method === 'POST' && c.url.endsWith('/models-3d/upload'));
    expect(init!.body).toEqual({ name: 'arena', modelExtension: 'obj' });
    expect(calls.some((c) => c.method === 'POST' && c.url === S3)).toBe(true); // S3 multipart upload
    const startTex = calls.find((c) => c.method === 'POST' && c.url.endsWith('/generations-texture'));
    expect(startTex!.body).toEqual({ modelId: 'm-1', prompt: 'dark dungeon stone', preview: false });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true); // cleanup
  });

  it('throws a clear error when the texture-generation create endpoint is unavailable (404)', async () => {
    install3D((url, method) => {
      if (method === 'POST' && url.endsWith('/generations-texture')) {
        return { ok: false, status: 404, body: { error: 'Endpoint not found' } };
      }
      return undefined as unknown as ReturnType<Parameters<typeof installFetch>[0]>;
    });
    await expect(
      generateTextureOn3DModel({ objBytes: new Uint8Array([1]), prompt: 'stone', pollIntervalMs: 1 }),
    ).rejects.toThrow(/texture.*generation|404|not available/i);
  });

  it('deletes the uploaded model asset when the S3 upload fails (no leak)', async () => {
    const { calls } = installFetch((url, method) => {
      if (method === 'POST' && url.endsWith('/models-3d/upload')) {
        return { body: { uploadModelAsset: {
          modelId: 'm-leak', modelUrl: S3,
          modelFields: JSON.stringify({ key: 'users/x/mesh.obj' }),
        } } };
      }
      if (method === 'POST' && url === S3) return { ok: false, status: 403 }; // S3 rejects the upload
      return { body: {} }; // DELETE /models-3d/m-leak
    });
    await expect(
      generateTextureOn3DModel({ objBytes: new Uint8Array([1]), prompt: 'stone', pollIntervalMs: 1 }),
    ).rejects.toThrow(/S3 upload failed/i);
    // The model asset created at step 1 must be cleaned up even though step 2 threw.
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/models-3d/m-leak'))).toBe(true);
  });
});

describe('generateImage prompt length', () => {
  it('rejects a prompt longer than the limit instead of silently truncating', async () => {
    installGenFetch(); // would otherwise resolve successfully
    await expect(
      generateImage('x'.repeat(1501), { pollIntervalMs: 1 }),
    ).rejects.toThrow(/1500|limit/i);
  });
});
