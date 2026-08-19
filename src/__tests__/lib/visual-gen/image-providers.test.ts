/**
 * The 2D provider registry — registry membership is not capability.
 *
 * FORCED-FAILURE SUITE. Before this direction there was no 2D provider abstraction
 * and no prompt→image path in the app at all: Leonardo was hardcoded in its route,
 * Scenario in another, and `qwen-image-runner.ts` — a complete, tested runner with a
 * quota-fallback chain — had zero production importers. Every test below names a
 * state that could not even be expressed then: a provider that is wired but keyless,
 * a provider that is keyed but unwired, and a generation whose failure carries the
 * provider's OWN reason instead of a dead button.
 *
 * No test here calls a paid provider: every provider call goes through the injected
 * `qwen` / `leonardo` seams, and every write goes through the injected `writeFile`.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  IMAGE_PROVIDERS,
  defaultImageProvider,
  generateTwoDImage,
  generatedImageName,
  generatedImageUrl,
  getImageProviderById,
  imageProviderCapabilities,
  imageProviderExecution,
  safeGeneratedImageName,
  sniffImageExt,
  type TwoDGenerateDeps,
} from '@/lib/visual-gen/image-providers';

const NO_KEYS: Record<string, string | undefined> = {};
const LEO_KEY = { LEONARDO_API_KEY: 'leo-secret' };
const QWEN_KEY = { QWEN_API_KEY: 'qwen-secret' };

const provider = (id: string) => {
  const p = getImageProviderById(id);
  if (!p) throw new Error(`no 2D provider ${id}`);
  return p;
};

const OUT = '/tmp/pof-2d-test';
const deps = (over: Partial<TwoDGenerateDeps> = {}): TwoDGenerateDeps => ({
  env: NO_KEYS,
  outDir: OUT,
  now: () => 1700000000000,
  ...over,
});

/** A minimal real JPEG header, so the sniffer has honest bytes to read. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');

describe('registry shape — an unrunnable entry must carry its reason', () => {
  it('every entry with no runner states WHY, in its own words', () => {
    for (const p of IMAGE_PROVIDERS.filter((x) => !x.runnerBacked)) {
      expect(p.notWiredReason, `${p.id} has no notWiredReason`).toBeTruthy();
      expect(p.notWiredReason!.length).toBeGreaterThan(40);
    }
  });

  it('exactly one entry is the official default', () => {
    expect(IMAGE_PROVIDERS.filter((p) => p.official)).toHaveLength(1);
  });

  it('every entry that needs a key names the env var(s) that supply it', () => {
    for (const p of IMAGE_PROVIDERS) {
      expect(p.keyEnv.every((k) => /^[A-Z0-9_]+$/.test(k))).toBe(true);
    }
  });
});

describe('imageProviderExecution — wired-but-keyless is its own sentence', () => {
  it('refuses a wired provider with no key, and says which var to set', () => {
    const exec = imageProviderExecution(provider('leonardo'), NO_KEYS);
    expect(exec.executable).toBe(false);
    expect(exec.missingKey).toBe(true);
    expect(exec.reason).toContain('LEONARDO_API_KEY');
    expect(exec.reason).toContain('only the key is missing');
    expect(exec.path).toBeUndefined();
  });

  it('runs a wired provider whose key is present, and names the var it used', () => {
    expect(imageProviderExecution(provider('leonardo'), LEO_KEY)).toEqual({
      executable: true, path: 'runner', keySource: 'LEONARDO_API_KEY',
    });
  });

  it('accepts either DashScope var for Qwen-Image', () => {
    expect(imageProviderExecution(provider('qwen-image'), QWEN_KEY).keySource).toBe('QWEN_API_KEY');
    expect(imageProviderExecution(provider('qwen-image'), { DASHSCOPE_API_KEY: 'x' }).keySource)
      .toBe('DASHSCOPE_API_KEY');
  });

  it('treats a blank key as no key — a whitespace env var is not a credential', () => {
    const exec = imageProviderExecution(provider('qwen-image'), { QWEN_API_KEY: '   ' });
    expect(exec.executable).toBe(false);
    expect(exec.missingKey).toBe(true);
  });

  it('refuses an unwired provider even with its key set, and says what it really does', () => {
    const exec = imageProviderExecution(provider('scenario'), { SCENARIO_API_KEY: 'sc' });
    expect(exec.executable).toBe(false);
    expect(exec.missingKey).toBeUndefined(); // a key would not help
    expect(exec.reason).toContain('PBR TEXTURE SET');
    expect(exec.reason).toContain('/api/scenario');
  });
});

describe('defaultImageProvider — the preselection can actually run', () => {
  it('is undefined when nothing on this server can run, rather than a doomed first click', () => {
    expect(defaultImageProvider(NO_KEYS)).toBeUndefined();
  });

  it('prefers the official provider when its key is there', () => {
    expect(defaultImageProvider({ ...LEO_KEY, ...QWEN_KEY })?.id).toBe('leonardo');
  });

  it('falls back to the runnable one when the official has no key', () => {
    expect(defaultImageProvider(QWEN_KEY)?.id).toBe('qwen-image');
  });
});

describe('imageProviderCapabilities — what crosses to the browser', () => {
  it('carries each verdict and its reason, and never a key value', () => {
    const caps = imageProviderCapabilities({ ...LEO_KEY });
    const leo = caps.find((c) => c.id === 'leonardo')!;
    const qwen = caps.find((c) => c.id === 'qwen-image')!;
    expect(leo.executable).toBe(true);
    expect(qwen.executable).toBe(false);
    expect(qwen.missingKey).toBe(true);
    expect(qwen.reason).toContain('QWEN_API_KEY');
    expect(JSON.stringify(caps)).not.toContain('leo-secret');
  });
});

describe('output naming + serving discipline', () => {
  it('refuses every traversal / non-image name', () => {
    for (const bad of ['../secret.png', 'a/b.png', 'a\\b.png', '.env', 'x.exe', '', 'x.png.exe', '..']) {
      expect(safeGeneratedImageName(bad), bad).toBeNull();
    }
  });

  it('accepts the names the generator itself writes', () => {
    const name = generatedImageName('qwen-image', 1700000000000);
    expect(name).toBe('qwen-image_1700000000000.png');
    expect(safeGeneratedImageName(name)).toBe(name);
    expect(generatedImageUrl(name)).toBe(`/api/visual-gen/image/${encodeURIComponent(name)}`);
  });

  it('sniffs the real format so a JPEG is never written to a .png', () => {
    expect(sniffImageExt(PNG)).toBe('png');
    expect(sniffImageExt(JPEG)).toBe('jpg');
    expect(sniffImageExt(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]))).toBe('webp');
    expect(sniffImageExt(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('generateTwoDImage — refusals happen BEFORE any provider call', () => {
  it('refuses a keyless provider with the reason, and never calls the runner', async () => {
    const qwen = vi.fn();
    const r = await generateTwoDImage({ prompt: 'a rusty key', providerId: 'qwen-image' }, deps({ qwen }));
    expect(r.ok).toBe(false);
    expect(r.refused).toBe(true);
    expect(r.error).toContain('QWEN_API_KEY');
    expect(qwen).not.toHaveBeenCalled();
  });

  it('refuses when NOTHING can run, and says so instead of picking a doomed provider', async () => {
    const r = await generateTwoDImage({ prompt: 'a rusty key' }, deps());
    expect(r.ok).toBe(false);
    expect(r.refused).toBe(true);
    expect(r.error).toContain('No 2D provider can run on this server');
  });

  it('refuses an empty prompt without spending a credit', async () => {
    const leonardo = vi.fn();
    const r = await generateTwoDImage({ prompt: '   ' }, deps({ env: LEO_KEY, leonardo }));
    expect(r.ok).toBe(false);
    expect(r.refused).toBe(true);
    expect(r.error).toContain('prompt was empty');
    expect(leonardo).not.toHaveBeenCalled();
  });

  it('refuses an unknown provider id by naming the known ones', async () => {
    const r = await generateTwoDImage({ prompt: 'x', providerId: 'midjourney' }, deps({ env: LEO_KEY }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('midjourney');
    expect(r.error).toContain('leonardo');
  });

  it('refuses the unwired registry entry with the entry\'s own reason', async () => {
    const r = await generateTwoDImage(
      { prompt: 'stone wall', providerId: 'scenario' },
      deps({ env: { SCENARIO_API_KEY: 'sc' } }),
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('PBR TEXTURE SET');
  });
});

describe('generateTwoDImage — the Qwen-Image path reaches the runner', () => {
  it('hands the runner the prompt, an output path under outDir, and the resolved key', async () => {
    const qwen = vi.fn(async (spec: { prompt: string; outputPath: string; size?: string; apiKey?: string }) => ({
      ok: true, imagePath: spec.outputPath,
      imageUrl: 'https://dashscope/x.png', model: 'qwen-image-max',
    }));
    const r = await generateTwoDImage(
      { prompt: 'a health potion icon', providerId: 'qwen-image', size: '1328*1328' },
      deps({ env: QWEN_KEY, qwen }),
    );

    expect(qwen).toHaveBeenCalledTimes(1);
    expect(qwen.mock.calls[0][0]).toEqual({
      prompt: 'a health potion icon',
      outputPath: `${OUT}/qwen-image_1700000000000.png`,
      size: '1328*1328',
      apiKey: 'qwen-secret',
    });
    expect(r.ok).toBe(true);
    expect(r.name).toBe('qwen-image_1700000000000.png');
    expect(r.url).toBe('/api/visual-gen/image/qwen-image_1700000000000.png');
    expect(r.sourceUrl).toBe('https://dashscope/x.png');
    expect(r.model).toBe('qwen-image-max'); // which model in the chain actually produced it
    expect(r.providerName).toBe('Qwen-Image');
  });

  it('surfaces the runner\'s OWN reason on failure, and serves no url', async () => {
    const qwen = vi.fn(async () => ({ ok: false, error: 'all Qwen-Image models exhausted. last: HTTP 429' }));
    const r = await generateTwoDImage({ prompt: 'x', providerId: 'qwen-image' }, deps({ env: QWEN_KEY, qwen }));
    expect(r.ok).toBe(false);
    expect(r.refused).toBeUndefined(); // asked and failed — not a refusal
    expect(r.error).toContain('all Qwen-Image models exhausted');
    expect(r.url).toBeUndefined();
  });

  it('reports a thrown runner error instead of escaping', async () => {
    const qwen = vi.fn(async () => { throw new Error('socket hang up'); });
    const r = await generateTwoDImage({ prompt: 'x', providerId: 'qwen-image' }, deps({ env: QWEN_KEY, qwen }));
    expect(r.ok).toBe(false);
    expect(r.error).toBe('socket hang up');
  });
});

describe('generateTwoDImage — the Leonardo path lands real bytes', () => {
  it('writes the returned bytes under outDir with the sniffed extension', async () => {
    const written: Array<[string, Uint8Array]> = [];
    let leoArgs: unknown[] = [];
    const leonardo = vi.fn(async (...args: unknown[]) => {
      leoArgs = args;
      return { imageUrl: 'https://cdn.leonardo/abc', generationId: 'gen-1', imageBase64: b64(JPEG) };
    });
    const r = await generateTwoDImage(
      { prompt: 'a bronze shield' },
      deps({ env: LEO_KEY, leonardo, writeFile: async (p, d) => { written.push([p, d]); } }),
    );

    expect(leoArgs).toEqual(['a bronze shield', { width: 512, height: 512, numImages: 1 }]);
    expect(r.ok).toBe(true);
    expect(r.name).toBe('leonardo_1700000000000.jpg'); // JPEG bytes ⇒ .jpg, not a mislabelled .png
    expect(written).toHaveLength(1);
    expect(written[0][0]).toBe(`${OUT}/leonardo_1700000000000.jpg`);
    expect(Buffer.from(written[0][1]).equals(Buffer.from(JPEG))).toBe(true);
    expect(r.url).toBe('/api/visual-gen/image/leonardo_1700000000000.jpg');
    expect(r.sourceUrl).toBe('https://cdn.leonardo/abc');
  });

  it('does not claim a saved image when the provider returned no bytes', async () => {
    const writeFile = vi.fn();
    const leonardo = vi.fn(async () => ({ imageUrl: 'https://cdn.leonardo/abc', generationId: 'gen-1' }));
    const r = await generateTwoDImage({ prompt: 'x' }, deps({ env: LEO_KEY, leonardo, writeFile }));
    expect(r.ok).toBe(false);
    expect(r.url).toBeUndefined();
    expect(r.error).toContain('no bytes');
    expect(r.sourceUrl).toBe('https://cdn.leonardo/abc'); // provenance survives the failure
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('reports a write failure rather than returning a url to a file that is not there', async () => {
    const leonardo = vi.fn(async () => ({ imageUrl: 'u', generationId: 'g', imageBase64: b64(PNG) }));
    const r = await generateTwoDImage(
      { prompt: 'x' },
      deps({ env: LEO_KEY, leonardo, writeFile: async () => { throw new Error('EACCES'); } }),
    );
    expect(r.ok).toBe(false);
    expect(r.url).toBeUndefined();
    expect(r.error).toContain('could not be saved');
    expect(r.error).toContain('EACCES');
  });

  it('reports a thrown provider error with its message', async () => {
    const leonardo = vi.fn(async () => { throw new Error('Leonardo generation failed (401): bad key'); });
    const r = await generateTwoDImage({ prompt: 'x' }, deps({ env: LEO_KEY, leonardo }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('401');
  });
});
