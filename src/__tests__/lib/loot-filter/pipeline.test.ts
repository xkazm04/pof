import { describe, it, expect } from 'vitest';
import {
  LOOT_FILTER_CATALOG_ID, STEP_GENERATE, STEP_WIRE, STEP_VERIFY, deriveLifecycle,
} from '@/lib/loot-filter/pipeline';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { AcceptanceStatus } from '@/lib/catalog/acceptance/types';

const art = (step: string, status: AcceptanceStatus): PipelineArtifact => ({
  catalogId: LOOT_FILTER_CATALOG_ID, entityId: 'rs', step, data: {}, ueAssets: [], status,
});

describe('deriveLifecycle', () => {
  it('is planned with no artifacts', () => {
    expect(deriveLifecycle([])).toBe('planned');
  });

  it('advances through generated → wired → verified as each step passes', () => {
    expect(deriveLifecycle([art(STEP_GENERATE, 'pass')])).toBe('generated');
    expect(deriveLifecycle([art(STEP_GENERATE, 'pass'), art(STEP_WIRE, 'pass')])).toBe('wired');
    expect(deriveLifecycle([
      art(STEP_GENERATE, 'pass'), art(STEP_WIRE, 'pass'), art(STEP_VERIFY, 'pass'),
    ])).toBe('verified');
  });

  it('stays at the last PASSED step when a later step is only deferred', () => {
    expect(deriveLifecycle([art(STEP_GENERATE, 'pass'), art(STEP_WIRE, 'deferred')])).toBe('generated');
  });

  it('reports failed when generation itself failed', () => {
    expect(deriveLifecycle([art(STEP_GENERATE, 'fail')])).toBe('failed');
  });
});
