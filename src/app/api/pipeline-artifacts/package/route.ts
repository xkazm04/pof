import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  verifyPackagingAll,
  defaultPackagingVerifyDeps,
  packagingCoverage,
  siblingsForPackaging,
} from '@/lib/catalog/acceptance/packagingVerify';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { listAllArtifacts, type PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { gradeArtifact } from '@/lib/catalog/headless';
import { listVerdicts } from '@/lib/status/judge-verdicts-db';
import { resolveStepAcceptance, serverVerdictOverlay, verdictsForStep } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import { packageLedger, type LedgerSibling } from '@/lib/catalog/packaging/packageLedger';
import type { PackageManifest } from '@/lib/catalog/packaging/packageArtifacts';
import type { SiblingArtifact } from '@/lib/catalog/packaging/collect';

/**
 * GET /api/pipeline-artifacts/package?catalogId=&entityId= — the UE Packaging step's package
 * as the lab's "Package on disk" panel shows it: the stored row, the verdict the ONE writer
 * (`verify-packaging` POST) would store now, the rebuilt manifest, and the ledger naming which
 * sibling owes each blocker (`packaging/packageLedger.ts`).
 *
 * `verdict` is `verifyPackagingAll(scope, deps, { apply: false }).results[0].to` — the writer's
 * own fold (package disk truth + the step's static checks + its content hold), never the disk
 * half alone. It writes NO artifact row (`upsertStatus` throws if reached). Like the
 * verify-packaging GET it is NOT read-only on disk: `buildPackage` rebuilds
 * `generated/packages/<catalogId>/<entityId>/` (manifest.json + materialized art) — the ground
 * truth being graded, not app state.
 */

/** Each non-packaging sibling's verdict through the same three layers as its own banner
 *  (checker → server overlay with its stored row → judge bridge), naming the layer that decided. */
function resolveSiblings(catalogId: string, entityId: string, rows: PipelineArtifact[], packagingStep: string): LedgerSibling[] {
  const judged = listVerdicts(catalogId);
  return rows.filter((r) => r.step !== packagingStep).map((r) => {
    const g = gradeArtifact(catalogId, r.step, r.data, entityId);
    if (!g.graded || !g.raw) return { step: r.step, status: r.status, source: 'stored', ...(r.reason ? { reason: r.reason } : {}) };
    const persisted = { status: r.status, ...(r.tier ? { tier: r.tier } : {}), ...(r.reason ? { reason: r.reason } : {}) };
    const overlaid = serverVerdictOverlay(g.raw, persisted);
    const merged = resolveStepAcceptance({
      catalogId, step: r.step, local: g.raw, persisted,
      verdicts: verdictsForStep(judged, entityId, r.step),
      data: r.data, ...(r.updatedAt ? { updatedAt: r.updatedAt } : {}),
    });
    const source = merged.status !== overlaid.status ? 'judge' : overlaid.status !== g.raw.status ? 'drain' : 'checker';
    return { step: r.step, status: merged.status, source, ...(merged.reason ? { reason: merged.reason } : {}) };
  });
}

/** `/Game/...` → the first sibling declaring it — the collector's own first-wins order. */
function declarers(siblings: SiblingArtifact[]): Record<string, string> {
  const by: Record<string, string> = {};
  for (const s of siblings) for (const d of s.ueAssets) by[d] ??= s.step;
  return by;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const catalogId = sp.get('catalogId');
  const entityId = sp.get('entityId');
  if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);
  try {
    const pipeline = getCatalogPipeline(catalogId);
    if (!pipeline) return apiError(`No registered pipeline for catalog "${catalogId}"`, 404);
    const coverage = packagingCoverage(pipeline);
    if (coverage.kind === 'exempt') return apiError(`${catalogId} owns no packaging step — exempt by declaration: ${coverage.reason}`, 404);
    if (coverage.kind === 'none') return apiError(`${catalogId} owns no packaging step and declares no exemption`, 404);
    const step = coverage.label;

    const rows = listAllArtifacts({ catalogId, entityId });
    const row = rows.find((r) => r.step === step);
    if (!row) return apiError(`${catalogId}/${entityId} has no stored "${step}" row — Produce the step first; the packaging sweep grades only persisted rows`, 404);

    // The writer's own sweep, dry-run, over the rows just read — so the manifest the ledger
    // explains is the one the verdict was graded from.
    const siblings = siblingsForPackaging(rows, step);
    const captured: { manifest?: PackageManifest } = {};
    const base = defaultPackagingVerifyDeps();
    const summary = verifyPackagingAll({ catalogId, entityId }, {
      ...base,
      listArtifacts: () => rows,
      listExemptions: () => [],
      getSiblings: () => siblings,
      build: (c, e, s) => (captured.manifest = base.build(c, e, s)),
      upsertStatus: () => { throw new Error('package read route must never write a verdict'); },
    }, { apply: false });
    const would = summary.results.find((r) => r.step === step);
    const built = captured.manifest;
    if (!would || !built) return apiError(`"${step}" was not graded by the packaging sweep`, 500);

    return apiSuccess({
      step,
      stored: { status: row.status, ...(row.tier ? { tier: row.tier } : {}), ...(row.reason ? { reason: row.reason } : {}) },
      verdict: would.to,
      ...(would.reason ? { verdictReason: would.reason } : {}),
      ...(would.detail ? { verdictDetail: would.detail } : {}),
      manifest: built,
      ledger: packageLedger(built, resolveSiblings(catalogId, entityId, rows, step), pipeline.steps.map((s) => s.label), declarers(siblings)),
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'package GET failed', 500);
  }
}
