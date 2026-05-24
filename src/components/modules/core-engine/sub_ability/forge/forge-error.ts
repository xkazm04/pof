/**
 * Friendly error categorization + shape validation for Ability Forge.
 *
 * The Forge can fail in several distinct ways (offline, timeout, rate limit,
 * malformed AI JSON, missing API key, generic server hiccup). Surface each
 * with a short, non-technical sentence and a retry path instead of dumping
 * raw `e.message` into a red box.
 */

import {
  WifiOff, Clock, Hourglass, Bot, KeyRound, ServerCrash, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import {
  STATUS_ERROR, STATUS_WARNING, STATUS_INFO,
} from '@/lib/chart-colors';
import type { ApiResponse } from '@/types/api';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';

/* ── Error taxonomy ───────────────────────────────────────────────────── */

export type ForgeErrorKind =
  | 'offline'
  | 'timeout'
  | 'rate_limit'
  | 'invalid_response'
  | 'config_missing'
  | 'server_error'
  | 'unknown';

export interface ForgeErrorInfo {
  kind: ForgeErrorKind;
  headline: string;
  message: string;
  tip?: string;
  detail?: string;
  icon: LucideIcon;
  color: string;
  retryable: boolean;
}

const PRESETS: Record<ForgeErrorKind, Omit<ForgeErrorInfo, 'detail'>> = {
  offline: {
    kind: 'offline',
    headline: "You're offline",
    message: 'The forge needs an internet connection to reach the AI model.',
    tip: 'Check your network, then try again.',
    icon: WifiOff,
    color: STATUS_INFO,
    retryable: true,
  },
  timeout: {
    kind: 'timeout',
    headline: 'The forge took too long',
    message: 'The AI did not respond in time. The model may be busy right now.',
    tip: 'Try again in a moment, or shorten your description.',
    icon: Clock,
    color: STATUS_INFO,
    retryable: true,
  },
  rate_limit: {
    kind: 'rate_limit',
    headline: 'Too many forges, too fast',
    message: 'The AI service is rate-limiting your requests.',
    tip: 'Wait about a minute before trying again.',
    icon: Hourglass,
    color: STATUS_WARNING,
    retryable: true,
  },
  invalid_response: {
    kind: 'invalid_response',
    headline: "The AI's reply was unusable",
    message: 'The forge got a response, but it was missing fields or not valid JSON.',
    tip: 'Try again — the AI sometimes drifts. Refining your prompt also helps.',
    icon: Bot,
    color: STATUS_WARNING,
    retryable: true,
  },
  config_missing: {
    kind: 'config_missing',
    headline: 'AI key not configured',
    message: 'The server has no Gemini API key, so the forge cannot run.',
    tip: 'Set GEMINI_API_KEY in .env.local and restart the dev server.',
    icon: KeyRound,
    color: STATUS_ERROR,
    retryable: false,
  },
  server_error: {
    kind: 'server_error',
    headline: 'The server had a hiccup',
    message: 'Something went wrong on our end while talking to the AI.',
    tip: 'Try again — if it keeps failing, check the dev console for details.',
    icon: ServerCrash,
    color: STATUS_ERROR,
    retryable: true,
  },
  unknown: {
    kind: 'unknown',
    headline: 'Something went wrong',
    message: "The forge couldn't generate an ability.",
    tip: 'Try again, or open the dev console to inspect the error.',
    icon: AlertTriangle,
    color: STATUS_ERROR,
    retryable: true,
  },
};

/* ── Classification ──────────────────────────────────────────────────── */

function isOfflineHint(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Classify an error thrown locally (network failure, AbortError, validation). */
export function classifyClientError(e: unknown): ForgeErrorInfo {
  const raw = e instanceof Error ? e.message : String(e);
  const detail = raw || undefined;

  if (e instanceof DOMException && e.name === 'AbortError') {
    return { ...PRESETS.timeout, detail };
  }
  if (isOfflineHint()) {
    return { ...PRESETS.offline, detail };
  }
  // fetch() rejects with TypeError on network failures.
  if (e instanceof TypeError || /failed to fetch|networkerror|err_network/i.test(raw)) {
    return { ...PRESETS.offline, detail };
  }
  if (/timeout|timed out/i.test(raw)) {
    return { ...PRESETS.timeout, detail };
  }
  return { ...PRESETS.unknown, detail };
}

/** Classify an error returned by the server (status + envelope error). */
export function classifyServerError(status: number, serverMessage: string): ForgeErrorInfo {
  const msg = (serverMessage || '').toLowerCase();
  const detail = serverMessage || undefined;

  if (status === 429 || /rate limit|too many/i.test(msg)) {
    return { ...PRESETS.rate_limit, detail };
  }
  if (status === 408 || status === 504 || /timeout|timed out/i.test(msg)) {
    return { ...PRESETS.timeout, detail };
  }
  if (status === 503 && /api key|not configured/i.test(msg)) {
    return { ...PRESETS.config_missing, detail };
  }
  if (
    /empty response|failed to parse|incomplete ability|invalid json/i.test(msg) ||
    status === 502
  ) {
    return { ...PRESETS.invalid_response, detail };
  }
  if (status >= 500) {
    return { ...PRESETS.server_error, detail };
  }
  return { ...PRESETS.unknown, detail };
}

/* ── ForgedAbility shape validation ───────────────────────────────────── */

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every(v => typeof v === 'string');
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/** Runtime validation so a malformed AI reply doesn't crash ForgeResult. */
export function isValidForgedAbility(x: unknown): x is ForgedAbility {
  if (!isObject(x)) return false;

  if (typeof x.className !== 'string' || !x.className) return false;
  if (typeof x.displayName !== 'string') return false;
  if (typeof x.description !== 'string') return false;
  if (typeof x.headerCode !== 'string' || !x.headerCode) return false;
  if (typeof x.cppCode !== 'string' || !x.cppCode) return false;

  if (!isObject(x.tags)) return false;
  const t = x.tags;
  if (typeof t.abilityTag !== 'string') return false;
  if (typeof t.cooldownTag !== 'string') return false;
  if (!isStringArray(t.ownedTags)) return false;
  if (!isStringArray(t.blockedTags)) return false;

  if (!isObject(x.stats)) return false;
  const s = x.stats;
  if (!isFiniteNumber(s.baseDamage)) return false;
  if (!isFiniteNumber(s.manaCost)) return false;
  if (!isFiniteNumber(s.cooldownSec)) return false;
  if (typeof s.damageType !== 'string') return false;

  if (!isObject(x.comboEntry)) return false;
  const c = x.comboEntry;
  if (!isFiniteNumber(c.animDuration)) return false;
  if (!Array.isArray(c.damageWindow) || c.damageWindow.length !== 2) return false;
  if (!c.damageWindow.every(isFiniteNumber)) return false;
  if (!isFiniteNumber(c.recovery)) return false;
  if (!isFiniteNumber(c.comboMultiplier)) return false;

  if (!Array.isArray(x.radarValues) || x.radarValues.length < 5) return false;
  if (!x.radarValues.every(isFiniteNumber)) return false;

  return true;
}

/* ── Fetch wrapper exposing status + categorized errors ──────────────── */

const DEFAULT_TIMEOUT_MS = 60_000;

export async function forgeAbilityRequest(
  prompt: string,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<ForgedAbility> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch('/api/agents/forge-ability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    throw new ForgeRequestError(classifyClientError(e));
  }
  clearTimeout(timeoutId);

  let json: ApiResponse<ForgedAbility>;
  try {
    json = await res.json();
  } catch {
    throw new ForgeRequestError(classifyServerError(res.status, 'Invalid JSON from server'));
  }

  if (!json.success) {
    throw new ForgeRequestError(classifyServerError(res.status, json.error));
  }

  if (!isValidForgedAbility(json.data)) {
    throw new ForgeRequestError({
      ...PRESETS.invalid_response,
      detail: 'Response was valid JSON but missing required ForgedAbility fields.',
    });
  }

  return json.data;
}

/** Thrown by forgeAbilityRequest — carries the categorized info. */
export class ForgeRequestError extends Error {
  readonly info: ForgeErrorInfo;
  constructor(info: ForgeErrorInfo) {
    super(info.headline);
    this.name = 'ForgeRequestError';
    this.info = info;
  }
}
