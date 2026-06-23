/**
 * Parse a VLM critique response (JSON, possibly fenced) into typed dimensions +
 * reasons + the single highest-impact fix. Pure, deterministic, no I/O — defensive
 * against malformed model output (fences, out-of-range scores, missing blocks).
 */
import type { CritiqueDimensions } from './score';

export interface ParsedCritique {
  ok: boolean;
  dimensions?: CritiqueDimensions;
  reasons?: string[];
  topFix?: string;
  error?: string;
}

const DIMS: (keyof CritiqueDimensions)[] = [
  'anticipation', 'weight', 'timing', 'followThrough', 'silhouette', 'believability',
];

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** Strip ```json … ``` fences (the model sometimes wraps despite instructions). */
function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
}

export function parseCritique(text: string): ParsedCritique {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(text));
  } catch {
    return { ok: false, error: 'response was not valid JSON' };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'response was not a JSON object' };
  }
  const obj = raw as Record<string, unknown>;
  const dimsRaw = obj.dimensions;
  if (!dimsRaw || typeof dimsRaw !== 'object') {
    return { ok: false, error: 'response missing the "dimensions" block' };
  }
  const dr = dimsRaw as Record<string, unknown>;
  const dimensions = {} as CritiqueDimensions;
  for (const k of DIMS) {
    const v = dr[k];
    if (typeof v !== 'number' || Number.isNaN(v)) {
      return { ok: false, error: `dimension "${k}" missing or non-numeric` };
    }
    dimensions[k] = clamp(v);
  }
  const reasons = Array.isArray(obj.reasons) ? obj.reasons.filter((r): r is string => typeof r === 'string') : [];
  const topFix = typeof obj.topFix === 'string' ? obj.topFix : '';
  return { ok: true, dimensions, reasons, topFix };
}
