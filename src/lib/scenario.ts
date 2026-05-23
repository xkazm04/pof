/**
 * Scenario.gg client — server-side only.
 *
 * Prototype (Option B) for Part C: a drop-in replacement for Leonardo's removed
 * 3D-texture endpoint. Scenario's `txt2img-texture` produces a full seamless PBR
 * map set (albedo / normal / roughness / metallic / height / AO) from a text
 * prompt — exactly what the arena re-texture needs.
 *
 * Flow (per Scenario API docs):
 *   1. POST /generate/txt2img-texture { prompt, modelId?, width?, height? } -> job
 *   2. poll  GET /jobs/{jobId} until status === 'success' -> metadata.assetIds[]
 *   3. for each assetId: GET /assets/{assetId} -> asset.url (+ a type hint)
 *
 * Auth: HTTP Basic, base64(API_KEY:API_SECRET).
 *
 * NOTE: request body field names (modelId/width/height) and the asset
 * type-hint field are best-effort from the public docs and should be confirmed
 * once SCENARIO_API_KEY/SECRET are configured (no key was available at build
 * time). The job/asset orchestration + auth are unit-tested with mocks; the
 * exact field names are isolated in `buildTextureBody` / `classifyPbrMap` /
 * `extractAssetUrl` so a live tweak is a one-line change.
 */

import { logger } from '@/lib/logger';

const SCENARIO_API_BASE = 'https://api.cloud.scenario.com/v1';
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60;

export type PbrMapType = 'albedo' | 'normal' | 'roughness' | 'metallic' | 'height' | 'ao' | 'unknown';

export interface ScenarioTextureOptions {
  prompt: string;
  /** Scenario model/flux id to texture with (account-specific). */
  modelId?: string;
  width?: number;
  height?: number;
  numSamples?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export interface ScenarioTextureMap {
  assetId: string;
  url: string;
  type: PbrMapType;
}

export interface ScenarioTextureResult {
  jobId: string;
  maps: ScenarioTextureMap[];
  albedoUrl?: string;
  normalUrl?: string;
  roughnessUrl?: string;
  metallicUrl?: string;
  heightUrl?: string;
  aoUrl?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeader(): string {
  const key = process.env.SCENARIO_API_KEY;
  if (!key) throw new Error('SCENARIO_API_KEY not set in environment');
  const secret = process.env.SCENARIO_API_SECRET;
  // base64(key:secret); if no secret, assume key is already a full Basic token.
  const token = secret ? Buffer.from(`${key}:${secret}`).toString('base64') : key;
  return `Basic ${token}`;
}

function headers(json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: authHeader(), Accept: 'application/json' };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

/** Bucket a Scenario map type/name string into a known PBR channel. */
export function classifyPbrMap(hint: string): PbrMapType {
  const s = hint.toLowerCase();
  if (/(albedo|basecolor|base[-_ ]?color|diffuse|color)/.test(s)) return 'albedo';
  if (/normal/.test(s)) return 'normal';
  if (/rough/.test(s)) return 'roughness';
  if (/metal/.test(s)) return 'metallic';
  if (/(height|displace)/.test(s)) return 'height';
  if (/(ambient|occlusion|\bao\b)/.test(s)) return 'ao';
  return 'unknown';
}

function buildTextureBody(opts: ScenarioTextureOptions): Record<string, unknown> {
  const body: Record<string, unknown> = { prompt: opts.prompt };
  if (opts.modelId) body.modelId = opts.modelId;
  if (opts.width) body.width = opts.width;
  if (opts.height) body.height = opts.height;
  if (opts.numSamples) body.numSamples = opts.numSamples;
  return body;
}

function extractAssetUrl(asset: Record<string, unknown> | undefined): string | undefined {
  if (!asset) return undefined;
  return (asset.url as string) ?? (asset.downloadUrl as string) ?? undefined;
}

function extractAssetTypeHint(asset: Record<string, unknown> | undefined): string {
  if (!asset) return '';
  const meta = (asset.metadata as Record<string, unknown>) ?? {};
  return String(meta.type ?? meta.mapType ?? asset.type ?? asset.name ?? '');
}

/**
 * Generate a seamless PBR texture set from a text prompt.
 * Returns the full map set plus convenience albedo/normal/roughness URLs.
 */
export async function generateTexture(opts: ScenarioTextureOptions): Promise<ScenarioTextureResult> {
  const pollMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const maxAttempts = opts.maxPollAttempts ?? MAX_POLL_ATTEMPTS;

  // 1. start the texture job
  const startRes = await fetch(`${SCENARIO_API_BASE}/generate/txt2img-texture`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(buildTextureBody(opts)),
  });
  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`Scenario texture job start failed (${startRes.status}): ${text}`);
  }
  const startData = (await startRes.json()) as { job?: { jobId?: string }; jobId?: string };
  const jobId = startData.job?.jobId ?? startData.jobId;
  if (!jobId) throw new Error('Scenario returned no jobId');
  logger.info(`[scenario] texture job started: ${jobId}`);

  // 2. poll the job until success
  let assetIds: string[] = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollMs);
    const pollRes = await fetch(`${SCENARIO_API_BASE}/jobs/${jobId}`, { headers: headers() });
    if (!pollRes.ok) continue;
    const data = (await pollRes.json()) as {
      job?: { status?: string; metadata?: { assetIds?: string[] } };
    };
    const status = data.job?.status?.toLowerCase();
    if (status === 'success') {
      assetIds = data.job?.metadata?.assetIds ?? [];
      break;
    }
    if (status === 'failure' || status === 'failed' || status === 'error') {
      throw new Error(`Scenario texture job ${jobId} failed`);
    }
  }
  if (assetIds.length === 0) throw new Error(`Scenario texture job ${jobId} produced no assets (timed out or empty)`);

  // 3. resolve each asset URL + classify it
  const maps: ScenarioTextureMap[] = [];
  for (const assetId of assetIds) {
    const assetRes = await fetch(`${SCENARIO_API_BASE}/assets/${assetId}`, { headers: headers() });
    if (!assetRes.ok) {
      logger.warn(`[scenario] asset ${assetId} fetch returned ${assetRes.status}`);
      continue;
    }
    const data = (await assetRes.json()) as { asset?: Record<string, unknown> } & Record<string, unknown>;
    const asset = data.asset ?? data;
    const url = extractAssetUrl(asset);
    if (!url) continue;
    maps.push({ assetId, url, type: classifyPbrMap(extractAssetTypeHint(asset)) });
  }
  if (maps.length === 0) throw new Error(`Scenario job ${jobId}: no resolvable asset URLs`);

  const byType = (t: PbrMapType) => maps.find((m) => m.type === t)?.url;
  return {
    jobId,
    maps,
    albedoUrl: byType('albedo') ?? maps[0].url,
    normalUrl: byType('normal'),
    roughnessUrl: byType('roughness'),
    metallicUrl: byType('metallic'),
    heightUrl: byType('height'),
    aoUrl: byType('ao'),
  };
}
