/**
 * Registry of 2D (prompt → image) generation providers, plus the one orchestration
 * that actually runs one and lands the result somewhere PoF can serve.
 *
 * WHY THIS EXISTS. Until this module there was no 2D provider abstraction and no
 * button anywhere in the app that turned a prompt into an image: Leonardo was
 * hardcoded in `/api/leonardo`, Scenario in `/api/scenario`, and
 * `qwen-image-runner.ts` — a complete, tested, injectable text-to-image runner with
 * a real quota-fallback chain — had zero production importers.
 *
 * MIRRORED, NOT EXTRACTED — deliberately. `providers.ts` (3D) types a 3D-only
 * vocabulary (`GenerationMode` = text-to-3d | image-to-3d, `vramGb`, `mcpBacked`)
 * and is not writable in this change, so nothing is imported from it. What is
 * copied is the SHAPE that was proven there:
 *   - registry membership is NOT capability;
 *   - a provider that cannot run is refused WITH the reason, never greyed out mute;
 *   - the default preselection is something that can actually run, or nothing.
 * Factoring the two registries into one generic core is phase-2 work and needs both
 * files writable in the same commit.
 *
 * The 2D side adds one axis the 3D side does not have: a provider can be fully
 * wired and still unrunnable because THIS server holds no API key. "Nothing
 * implements it" and "nobody gave it a key" are different sentences with different
 * fixes, so both are carried verbatim to the UI (`missingKey` marks the second).
 */

export interface ImageProvider {
  id: string;
  name: string;
  description: string;
  /**
   * Env vars, ANY ONE of which supplies this provider's key. Empty ⇒ the provider
   * needs no key (none today; kept so a local runner can join without a special case).
   */
  keyEnv: readonly string[];
  /** True when a PoF runner drives this provider prompt → file on disk TODAY. */
  runnerBacked: boolean;
  /**
   * Why this entry cannot run here regardless of keys. Required whenever
   * `runnerBacked` is false — a registry entry with no stated reason is exactly the
   * silent "Coming Soon" this module exists to stop.
   */
  notWiredReason?: string;
  /** Exactly one entry carries this: what a fresh panel preselects when it can run. */
  official?: boolean;
}

export const IMAGE_PROVIDERS: readonly ImageProvider[] = [
  {
    id: 'leonardo',
    name: 'Leonardo',
    description:
      'Cloud text-to-image (Lucid Origin). The 2D front the gap-loop batch scripts have used all along — src/lib/leonardo.ts generateImage(): start → poll → download-then-delete, so the bytes come back and nothing is left on the account. Needs LEONARDO_API_KEY.',
    keyEnv: ['LEONARDO_API_KEY'],
    runnerBacked: true,
    official: true,
  },
  {
    id: 'qwen-image',
    name: 'Qwen-Image',
    description:
      'Cloud text-to-image (DashScope qwen-image-2.0-pro → max → plus quota chain) via src/lib/visual-gen/qwen-image-runner.ts. Strongest of the two at READABLE TEXT IN THE IMAGE and multi-layer UI/infographic layouts — pick it for icon sheets, HUD mockups and labelled plates. Reuses the DashScope account (QWEN_API_KEY) on a separate per-model quota from the Qwen-VL critique seam.',
    keyEnv: ['QWEN_API_KEY', 'DASHSCOPE_API_KEY'],
    runnerBacked: true,
  },
  {
    id: 'scenario',
    name: 'Scenario',
    description:
      'Cloud PBR texture generation (/api/scenario) — albedo + normal + roughness for a material, with a seam/tileability pass on the albedo.',
    keyEnv: ['SCENARIO_API_KEY'],
    runnerBacked: false,
    notWiredReason:
      'Scenario produces a PBR TEXTURE SET (albedo/normal/roughness), not a single image — this front would have to throw away the maps that are the point of it. It runs from the Material Lab via /api/scenario, where the extra maps and the seam verdict are actually used.',
  },
];

export function getImageProviderById(id: string): ImageProvider | undefined {
  return IMAGE_PROVIDERS.find((p) => p.id === id);
}

/** How (or whether) PoF can actually run a 2D provider on THIS server. */
export interface ImageProviderExecution {
  /** True when a runner exists AND a key for it is present in `env`. */
  executable: boolean;
  /** Which path drives it. Absent when nothing does. */
  path?: 'runner';
  /** The env var that supplied the key. A NAME, never a value. */
  keySource?: string;
  /** Why it cannot run. Always present when `executable` is false. */
  reason?: string;
  /** True when the runner is wired and the ONLY thing missing is a key. */
  missingKey?: boolean;
}

/**
 * Resolve a 2D provider's execution state against an environment. Pure, and the
 * single source of truth for "can this prompt be submitted?" — the route refuses on
 * it and the panel disables on it, so a click can never take a path the button says
 * is unavailable.
 */
export function imageProviderExecution(
  provider: ImageProvider,
  env: Record<string, string | undefined>,
): ImageProviderExecution {
  if (!provider.runnerBacked) {
    return {
      executable: false,
      reason:
        provider.notWiredReason ??
        `No runner drives ${provider.name} from this front — it is registry metadata only.`,
    };
  }
  if (provider.keyEnv.length === 0) return { executable: true, path: 'runner' };
  const keySource = provider.keyEnv.find((k) => (env[k] ?? '').trim() !== '');
  if (!keySource) {
    return {
      executable: false,
      missingKey: true,
      reason:
        `${provider.name} has no API key on this server — set ` +
        `${provider.keyEnv.join(' or ')} and restart. The runner is wired; only the key is missing.`,
    };
  }
  return { executable: true, path: 'runner', keySource };
}

/** The serialisable per-provider verdict the client renders. No key VALUES cross this. */
export interface ImageProviderCapability {
  id: string;
  name: string;
  description: string;
  executable: boolean;
  reason?: string;
  missingKey?: boolean;
  official?: boolean;
}

/** Every provider with its verdict, for the panel. Pure. */
export function imageProviderCapabilities(
  env: Record<string, string | undefined>,
): ImageProviderCapability[] {
  return IMAGE_PROVIDERS.map((p) => {
    const exec = imageProviderExecution(p, env);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      executable: exec.executable,
      ...(exec.reason ? { reason: exec.reason } : {}),
      ...(exec.missingKey ? { missingKey: true } : {}),
      ...(p.official ? { official: true } : {}),
    };
  });
}

/**
 * The provider a fresh panel should preselect: the official one when it can run
 * here, else the first that can, else `undefined` — which the UI must report as
 * "nothing on this server can generate a 2D image" rather than preselecting an
 * entry whose first click is guaranteed to fail. Pure.
 */
export function defaultImageProvider(
  env: Record<string, string | undefined>,
): ImageProvider | undefined {
  const runnable = IMAGE_PROVIDERS.filter((p) => imageProviderExecution(p, env).executable);
  return runnable.find((p) => p.official) ?? runnable[0];
}

// ---------------------------------------------------------------------------
// Where a generated image lands, and how it is served.
// ---------------------------------------------------------------------------

/**
 * Generated 2D images land in `generated/images/` — a NEW dir, deliberately not
 * `generated/icons/`: that library is keyed `(catalogId, step)` and matched on the
 * generator's exact filename rule, with no entity dimension, so a free-prompt image
 * has no honest name there. It is served by `/api/visual-gen/image/:name` under the
 * same discipline as the 3D `ASSET_DIRS` routes: a basename allow-list (no
 * separators, no `..`, extension whitelist) plus a realpath re-check inside the real
 * dir, which also refuses a symlink pointing out of it.
 */
export const GENERATED_IMAGE_DIR = 'images';
export const GENERATED_IMAGE_ENDPOINT = '/api/visual-gen/image';

const IMAGE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpg|jpeg|webp)$/;

/** A safe basename to read from `generated/images/`, or null. Pure. */
export function safeGeneratedImageName(name: string): string | null {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  return IMAGE_NAME_RE.test(name) ? name : null;
}

/** The serving URL for one generated image. Pure. */
export function generatedImageUrl(name: string): string {
  return `${GENERATED_IMAGE_ENDPOINT}/${encodeURIComponent(name)}`;
}

/** `<provider>_<stamp>.<ext>` — provider-tagged so the file names its own origin. Pure. */
export function generatedImageName(providerId: string, stamp: number, ext = 'png'): string {
  return `${providerId.replace(/[^A-Za-z0-9_-]/g, '-')}_${stamp}.${ext}`;
}

/**
 * The real format of some bytes, from their magic number — so a JPEG returned by a
 * provider is never written to a `.png` the serve route then labels `image/png`.
 * Pure; null when the bytes are none of the three.
 */
export function sniffImageExt(bytes: Uint8Array): 'png' | 'jpg' | 'webp' | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (
    bytes.length >= 12 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

// ---------------------------------------------------------------------------
// The one prompt → image orchestration.
// ---------------------------------------------------------------------------

export interface TwoDGenerateRequest {
  prompt: string;
  /** Registry id; absent → `defaultImageProvider(env)`. */
  providerId?: string;
  /** Qwen only, e.g. '1328*1328'. */
  size?: string;
  /** Leonardo only; default 512×512. */
  width?: number;
  height?: number;
}

/** Every I/O this orchestration performs, injectable — no test ever calls a paid provider. */
export interface TwoDGenerateDeps {
  env: Record<string, string | undefined>;
  /** Absolute dir the file lands in, forward-slashed. The route passes `<cwd>/generated/images`. */
  outDir: string;
  now?: () => number;
  qwen?: (spec: {
    prompt: string;
    outputPath: string;
    size?: string;
    apiKey?: string;
  }) => Promise<{ ok: boolean; error?: string; imagePath?: string; imageUrl?: string; model?: string }>;
  leonardo?: (
    prompt: string,
    opts: { width?: number; height?: number; numImages?: number },
  ) => Promise<{ imageUrl: string; generationId: string; imageBase64?: string }>;
  writeFile?: (path: string, data: Uint8Array) => Promise<void>;
}

export interface TwoDGenerateResult {
  ok: boolean;
  /** The provider's OWN reason when it failed. Always present when `ok` is false. */
  error?: string;
  /**
   * True when the request could never have run HERE (unwired provider, missing key,
   * empty prompt) — as opposed to a provider that was asked and failed. The route
   * maps the first to 400 and the second to 502 on this flag, not on the wording.
   */
  refused?: boolean;
  providerId: string;
  providerName: string;
  /** Served URL — present ONLY when real bytes landed on disk. Never a placeholder. */
  url?: string;
  name?: string;
  /** The provider's upstream URL, for provenance. */
  sourceUrl?: string;
  /** Which model in a fallback chain actually produced the image. */
  model?: string;
  durationMs: number;
}

async function defaultWriteFile(path: string, data: Uint8Array): Promise<void> {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

/**
 * Run one prompt through one 2D provider and write the image under `outDir`.
 *
 * Never throws: a refusal, a provider failure or a write failure all come back as
 * `{ ok: false, error }` carrying the provider's own words, so the panel reports the
 * reason instead of a dead button (catalog Rule 4). `url` is set only after bytes
 * exist on disk — there is no branch that returns a placeholder.
 */
export async function generateTwoDImage(
  req: TwoDGenerateRequest,
  deps: TwoDGenerateDeps,
): Promise<TwoDGenerateResult> {
  const now = deps.now ?? Date.now;
  const started = now();
  const provider = (req.providerId ? getImageProviderById(req.providerId) : undefined)
    ?? (req.providerId ? undefined : defaultImageProvider(deps.env));
  const done = (r: Omit<TwoDGenerateResult, 'durationMs' | 'providerId' | 'providerName'>): TwoDGenerateResult => ({
    ...r,
    providerId: provider?.id ?? (req.providerId ?? ''),
    providerName: provider?.name ?? (req.providerId ? `"${req.providerId}"` : '(none)'),
    durationMs: now() - started,
  });

  if (!provider) {
    return done({
      ok: false,
      refused: true,
      error: req.providerId
        ? `Unknown 2D provider "${req.providerId}". Known: ${IMAGE_PROVIDERS.map((p) => p.id).join(', ')}.`
        : 'No 2D provider can run on this server — every registry entry is either unwired or missing its API key.',
    });
  }

  const prompt = (req.prompt ?? '').trim();
  if (!prompt) {
    return done({ ok: false, refused: true, error: 'Describe the image first — the prompt was empty.' });
  }

  const exec = imageProviderExecution(provider, deps.env);
  if (!exec.executable) {
    return done({ ok: false, refused: true, error: exec.reason ?? 'This provider cannot run here.' });
  }

  const write = deps.writeFile ?? defaultWriteFile;
  const stamp = now();
  const apiKey = exec.keySource ? deps.env[exec.keySource] : undefined;

  if (provider.id === 'qwen-image') {
    const name = generatedImageName(provider.id, stamp, 'png'); // DashScope returns PNG
    const outputPath = `${deps.outDir}/${name}`;
    const run = deps.qwen ?? (async (spec) => {
      const { runQwenImage } = await import('@/lib/visual-gen/qwen-image-runner');
      return runQwenImage(spec, { writeFile: write });
    });
    let r: Awaited<ReturnType<NonNullable<TwoDGenerateDeps['qwen']>>>;
    try {
      r = await run({ prompt, outputPath, size: req.size, apiKey });
    } catch (e) {
      return done({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    if (!r.ok) return done({ ok: false, error: r.error ?? 'Qwen-Image failed without a reason.' });
    return done({ ok: true, url: generatedImageUrl(name), name, sourceUrl: r.imageUrl, model: r.model });
  }

  if (provider.id === 'leonardo') {
    const run = deps.leonardo ?? (async (p, opts) => {
      const { generateImage } = await import('@/lib/leonardo');
      return generateImage(p, opts);
    });
    let res: Awaited<ReturnType<NonNullable<TwoDGenerateDeps['leonardo']>>>;
    try {
      res = await run(prompt, { width: req.width ?? 512, height: req.height ?? 512, numImages: 1 });
    } catch (e) {
      return done({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    if (!res.imageBase64) {
      return done({
        ok: false,
        sourceUrl: res.imageUrl,
        error:
          'Leonardo returned a generation URL but no bytes to save, so nothing was written. ' +
          'That happens when the download-then-delete cleanup is off; the image is not retrievable from here.',
      });
    }
    const bytes = new Uint8Array(Buffer.from(res.imageBase64, 'base64'));
    const name = generatedImageName(provider.id, stamp, sniffImageExt(bytes) ?? 'png');
    try {
      await write(`${deps.outDir}/${name}`, bytes);
    } catch (e) {
      return done({
        ok: false,
        sourceUrl: res.imageUrl,
        error: `image generated but could not be saved: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
    return done({ ok: true, url: generatedImageUrl(name), name, sourceUrl: res.imageUrl });
  }

  // Unreachable for the registry as it stands — a runner-backed id with no branch
  // here is a wiring bug, and it says so rather than falling through as a success.
  return done({
    ok: false,
    error: `${provider.name} is marked runner-backed but this orchestration has no branch for "${provider.id}".`,
  });
}
