/**
 * Which step is a packaging step — its own module so BOTH L2 sweeps can ask without an import
 * cycle: `packagingVerify` owns the packaging step's verdict, and `staticVerify` must know to
 * leave that step alone (two sweeps writing one status let the last writer launder the other).
 */
import { getCatalogPipeline } from '../pipeline-registry';

/** A step is a packaging step via the explicit StepSpec flag, or the canonical
 *  "UE Packaging" label every catalog pipeline ends with (no 30-file rollout needed). */
export function isPackagingStep(spec: { packaging?: boolean; label: string }): boolean {
  return spec.packaging === true || spec.label === 'UE Packaging';
}

/** The same answer for a stored (catalog, step) — the registered spec when there is one, else the
 *  canonical label. BOTH sweeps' default deps ask this one resolver. */
export function isPackagingLabel(catalogId: string, step: string): boolean {
  const spec = getCatalogPipeline(catalogId)?.steps.find((s) => s.label === step);
  return spec ? isPackagingStep(spec) : step === 'UE Packaging';
}
