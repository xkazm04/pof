/**
 * Validation + status derivation for the `generate-gas-effects` callback.
 *
 * The payload arrives as raw LLM JSON, so nothing here trusts it: every field
 * is type-checked, and the terminal `status` is DERIVED from the evidence
 * (files written + build + seed + DT rows) rather than read from a
 * self-declared "success" the model could simply assert. A run that skipped
 * the seeder is `failed` with a reason, no matter what it claims.
 *
 * Pure — no DB, no fetch — so the contract is unit-testable in isolation.
 */

import { ok, err, type Result } from '@/types/result';
import type { CodegenReport } from '@/lib/ability/spec';

/** The unvalidated wire shape the agent is asked to emit. */
export interface RawCodegenPayload {
  filesWritten?: unknown;
  buildOk?: unknown;
  seedRan?: unknown;
  dataTableRows?: unknown;
  missingTags?: unknown;
  reason?: unknown;
}

function stringArray(x: unknown, field: string): Result<string[], string> {
  if (x === undefined || x === null) return ok([]);
  if (!Array.isArray(x)) return err(`"${field}" must be an array of strings`);
  if (!x.every((v) => typeof v === 'string')) return err(`"${field}" must contain only strings`);
  return ok(x as string[]);
}

function bool(x: unknown, field: string): Result<boolean, string> {
  if (typeof x !== 'boolean') return err(`"${field}" must be a boolean`);
  return ok(x);
}

/**
 * Validate a raw callback payload into a {@link CodegenReport}.
 *
 * `now` is injectable so tests assert a stable `reportedAt`.
 */
export function parseCodegenReport(
  raw: RawCodegenPayload,
  now: () => string = () => new Date().toISOString(),
): Result<CodegenReport, string> {
  if (typeof raw !== 'object' || raw === null) return err('payload must be an object');

  const files = stringArray(raw.filesWritten, 'filesWritten');
  if (!files.ok) return files;
  const tags = stringArray(raw.missingTags, 'missingTags');
  if (!tags.ok) return tags;
  const build = bool(raw.buildOk, 'buildOk');
  if (!build.ok) return build;
  const seed = bool(raw.seedRan, 'seedRan');
  if (!seed.ok) return seed;

  let rows: number | null = null;
  if (raw.dataTableRows !== undefined && raw.dataTableRows !== null) {
    if (typeof raw.dataTableRows !== 'number' || !Number.isFinite(raw.dataTableRows) || raw.dataTableRows < 0) {
      return err('"dataTableRows" must be a non-negative number or null');
    }
    rows = raw.dataTableRows;
  }

  if (raw.reason !== undefined && raw.reason !== null && typeof raw.reason !== 'string') {
    return err('"reason" must be a string');
  }
  const reportedReason = typeof raw.reason === 'string' && raw.reason.trim() ? raw.reason.trim() : undefined;

  // Derived status — the agent cannot declare itself confirmed.
  const shortfalls: string[] = [];
  if (files.data.length === 0) shortfalls.push('no files were written');
  if (!build.data) shortfalls.push('the PoF module did not build');
  if (!seed.data) shortfalls.push('the DT_GeneratedAbilities seeder did not run');
  if (rows === null) shortfalls.push('no DataTable row count was reported');
  else if (rows === 0) shortfalls.push('the seeder saved 0 rows');

  const confirmed = shortfalls.length === 0;

  return ok({
    status: confirmed ? 'confirmed' : 'failed',
    filesWritten: files.data,
    buildOk: build.data,
    seedRan: seed.data,
    dataTableRows: rows,
    missingTags: tags.data,
    ...(confirmed
      ? (reportedReason ? { reason: reportedReason } : {})
      : { reason: reportedReason ?? `Codegen incomplete — ${shortfalls.join('; ')}.` }),
    reportedAt: now(),
  });
}

/** One-line human summary for the status bars. */
export function codegenSummary(r: CodegenReport): string {
  if (r.status === 'confirmed') {
    const rows = r.dataTableRows ?? 0;
    return `${r.filesWritten.length} file${r.filesWritten.length === 1 ? '' : 's'} written · built · DT_GeneratedAbilities seeded (${rows} row${rows === 1 ? '' : 's'})`;
  }
  return r.reason ?? 'Codegen failed for an unreported reason.';
}
