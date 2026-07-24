/**
 * Qwen-Image cloud 2D runner — pure cores (request body / response parse) plus the
 * orchestration (generate → download → write), driven through the injectable HTTP +
 * fs seam so no network, credits, or disk are touched.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  buildQwenImageBody,
  parseImageUrl,
  runQwenImage,
  DEFAULT_QWEN_IMAGE_MODEL,
  QWEN_IMAGE_ENDPOINT,
  type QwenImageDeps,
} from '@/lib/visual-gen/qwen-image-runner';

const genOk = (url: string) =>
  ({
    ok: true,
    json: async () => ({ output: { choices: [{ message: { content: [{ image: url }] } }] } }),
  }) as unknown as Response;
const httpErr = (status: number, body: string) =>
  ({ ok: false, status, text: async () => body }) as unknown as Response;
const download = (bytes: number[]) =>
  ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array(bytes).buffer }) as unknown as Response;

function deps(fetchMock: ReturnType<typeof vi.fn>, writeFile = vi.fn().mockResolvedValue(undefined)): QwenImageDeps {
  return { fetch: fetchMock as unknown as typeof globalThis.fetch, writeFile, now: () => 0 };
}

describe('buildQwenImageBody', () => {
  it('nests the prompt in the DashScope multimodal message shape', () => {
    const body = buildQwenImageBody({ prompt: 'a rune icon', outputPath: 'o.png' }, 'qwen-image-max');
    expect(body.model).toBe('qwen-image-max');
    expect(body.input.messages[0].content[0].text).toBe('a rune icon');
  });

  it('passes size/negative_prompt/watermark through parameters', () => {
    const body = buildQwenImageBody(
      { prompt: 'p', outputPath: 'o.png', size: '1328*1328', negativePrompt: 'blurry', watermark: false },
      'm',
    );
    expect(body.parameters.size).toBe('1328*1328');
    expect(body.parameters.negative_prompt).toBe('blurry');
    expect(body.parameters.watermark).toBe(false);
  });

  it('omits negative_prompt when unset (no empty-string key)', () => {
    const body = buildQwenImageBody({ prompt: 'p', outputPath: 'o.png' }, 'm');
    expect('negative_prompt' in body.parameters).toBe(false);
  });
});

describe('parseImageUrl', () => {
  it('reads the image URL out of the choices envelope', () => {
    expect(parseImageUrl({ output: { choices: [{ message: { content: [{ image: 'https://x/a.png' }] } }] } })).toBe(
      'https://x/a.png',
    );
  });

  it('returns undefined for a malformed / empty envelope', () => {
    expect(parseImageUrl({})).toBeUndefined();
    expect(parseImageUrl({ output: { choices: [] } })).toBeUndefined();
    expect(parseImageUrl({ output: { choices: [{ message: { content: [{ text: 'refused' }] } }] } })).toBeUndefined();
  });
});

describe('runQwenImage', () => {
  it('generates, downloads, and writes the image', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(genOk('https://x/a.png')).mockResolvedValueOnce(download([1, 2, 3]));
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const res = await runQwenImage({ prompt: 'p', outputPath: 'out/a.png', apiKey: 'k' }, deps(fetchMock, writeFile));
    expect(res.ok).toBe(true);
    expect(res.imagePath).toBe('out/a.png');
    expect(res.model).toBe(DEFAULT_QWEN_IMAGE_MODEL);
    expect(fetchMock.mock.calls[0][0]).toBe(QWEN_IMAGE_ENDPOINT);
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile.mock.calls[0][0]).toBe('out/a.png');
  });

  it('fails with a reason when no API key is set', async () => {
    const fetchMock = vi.fn();
    const res = await runQwenImage(
      { prompt: 'p', outputPath: 'o.png', apiKey: '' },
      { ...deps(fetchMock), env: {} },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/QWEN_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the next model on a quota error (separate per-model quota)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(httpErr(429, 'Throttling: free allocated quota exceeded'))
      .mockResolvedValueOnce(genOk('https://x/b.png'))
      .mockResolvedValueOnce(download([9]));
    const res = await runQwenImage(
      { prompt: 'p', outputPath: 'o.png', apiKey: 'k', fallbackModels: ['qwen-image-plus'] },
      deps(fetchMock),
    );
    expect(res.ok).toBe(true);
    expect(res.model).toBe('qwen-image-plus');
  });

  it('reports the reason on a non-quota error without burning fallbacks', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(httpErr(400, 'invalid prompt'));
    const res = await runQwenImage(
      { prompt: 'p', outputPath: 'o.png', apiKey: 'k', fallbackModels: ['qwen-image-plus'] },
      deps(fetchMock),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/HTTP 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports the reason when the download fails (never a silent empty file)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(genOk('https://x/a.png')).mockResolvedValueOnce(httpErr(404, 'gone'));
    const writeFile = vi.fn();
    const res = await runQwenImage({ prompt: 'p', outputPath: 'o.png', apiKey: 'k' }, deps(fetchMock, writeFile));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/download/i);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('reports the reason when every model is quota-exhausted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(httpErr(429, 'quota exceeded'));
    const res = await runQwenImage(
      { prompt: 'p', outputPath: 'o.png', apiKey: 'k', fallbackModels: ['qwen-image-plus'] },
      deps(fetchMock),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/exhausted/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
