/**
 * Finding collector — aggregates findings across evaluation passes with deduplication.
 */

import type { SubModuleId } from '@/types/modules';
import type { EvalPass } from './module-eval-prompts';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';
export type FindingEffort = 'trivial' | 'small' | 'medium' | 'large';

export interface EvalFinding {
  id: string;
  scanId: string;
  moduleId: SubModuleId;
  pass: EvalPass;
  category: string;
  severity: FindingSeverity;
  file: string | null;
  line: number | null;
  description: string;
  suggestedFix: string;
  effort: FindingEffort;
  timestamp: number;
}

export interface RawFinding {
  category: string;
  severity: string;
  file: string | null;
  line: number | null;
  description: string;
  suggestedFix: string;
  effort: string;
}

export interface ModuleFindings {
  moduleId: SubModuleId;
  findings: EvalFinding[];
  bySeverity: Record<FindingSeverity, number>;
  byCategory: Record<string, EvalFinding[]>;
}

export interface ScanFindings {
  scanId: string;
  timestamp: number;
  totalFindings: number;
  modules: ModuleFindings[];
  bySeverity: Record<FindingSeverity, number>;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_SEVERITIES = new Set<string>(['critical', 'high', 'medium', 'low']);
const VALID_EFFORTS = new Set<string>(['trivial', 'small', 'medium', 'large']);

function validateSeverity(s: string): FindingSeverity {
  return VALID_SEVERITIES.has(s) ? (s as FindingSeverity) : 'medium';
}

function validateEffort(e: string): FindingEffort {
  return VALID_EFFORTS.has(e) ? (e as FindingEffort) : 'medium';
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse raw CLI output into structured findings.
 * The CLI should return a JSON array, but we handle markdown fences and noise.
 */
export function parseFindings(
  raw: string,
  scanId: string,
  moduleId: SubModuleId,
  pass: EvalPass,
): EvalFinding[] {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  // Try to find a JSON array in the output
  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');
  if (arrayStart === -1 || arrayEnd === -1 || arrayEnd <= arrayStart) {
    return [];
  }

  cleaned = cleaned.slice(arrayStart, arrayEnd + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const timestamp = Date.now();
  return parsed
    .filter((item): item is RawFinding =>
      typeof item === 'object' && item !== null && 'description' in item,
    )
    .map((item, i) => ({
      id: `${scanId}-${moduleId}-${pass}-${i}`,
      scanId,
      moduleId,
      pass,
      category: String(item.category ?? 'General'),
      severity: validateSeverity(String(item.severity ?? 'medium')),
      file: item.file ? String(item.file) : null,
      line: typeof item.line === 'number' ? item.line : null,
      description: String(item.description ?? ''),
      suggestedFix: String(item.suggestedFix ?? ''),
      effort: validateEffort(String(item.effort ?? 'medium')),
      timestamp,
    }));
}

// ─── Deduplication ───────────────────────────────────────────────────────────

/**
 * Deduplicate findings that appear across multiple passes.
 * Two findings are duplicates if they reference the same file+line+description (fuzzy).
 */
export function deduplicateFindings(findings: EvalFinding[]): EvalFinding[] {
  const seen = new Map<string, EvalFinding>();

  for (const f of findings) {
    // Create a fingerprint from the key identifying attributes
    const fileKey = f.file ?? '__general__';
    const lineKey = f.line != null ? String(f.line) : '__no_line__';
    // Normalize description for fuzzy matching — lowercase, strip punctuation, first 80 chars
    const descKey = f.description
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .slice(0, 80)
      .trim();
    const fingerprint = `${f.moduleId}::${fileKey}::${lineKey}::${descKey}`;

    const existing = seen.get(fingerprint);
    if (existing) {
      // Keep the one with higher severity
      const severityRank: Record<FindingSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      if (severityRank[f.severity] < severityRank[existing.severity]) {
        seen.set(fingerprint, f);
      }
    } else {
      seen.set(fingerprint, f);
    }
  }

  return Array.from(seen.values());
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Aggregate findings by module with severity counts and category grouping.
 */
export function aggregateFindings(findings: EvalFinding[], scanId: string): ScanFindings {
  const byModule = new Map<string, EvalFinding[]>();

  for (const f of findings) {
    const arr = byModule.get(f.moduleId) ?? [];
    arr.push(f);
    byModule.set(f.moduleId, arr);
  }

  const modules: ModuleFindings[] = [];
  const globalSeverity: Record<FindingSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const [moduleId, modFindings] of byModule) {
    const bySeverity: Record<FindingSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byCategory: Record<string, EvalFinding[]> = {};

    for (const f of modFindings) {
      bySeverity[f.severity]++;
      globalSeverity[f.severity]++;
      const cat = byCategory[f.category] ?? [];
      cat.push(f);
      byCategory[f.category] = cat;
    }

    modules.push({
      moduleId: moduleId as SubModuleId,
      findings: modFindings,
      bySeverity,
      byCategory,
    });
  }

  // Sort modules by total severity (critical first)
  modules.sort((a, b) => {
    const scoreA = a.bySeverity.critical * 1000 + a.bySeverity.high * 100 + a.bySeverity.medium * 10 + a.bySeverity.low;
    const scoreB = b.bySeverity.critical * 1000 + b.bySeverity.high * 100 + b.bySeverity.medium * 10 + b.bySeverity.low;
    return scoreB - scoreA;
  });

  return {
    scanId,
    timestamp: Date.now(),
    totalFindings: findings.length,
    modules,
    bySeverity: globalSeverity,
  };
}
