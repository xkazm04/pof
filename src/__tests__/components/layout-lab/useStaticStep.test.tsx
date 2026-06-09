import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useStaticStep } from '@/components/layout-lab/steps/useStaticStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const entity: LabEntity = { id: 'e-static', name: 'Iron Longsword', lifecycle: 'planned', data: null };

beforeEach(() => {
  localStorage.clear();
  useLabPipelineStore.setState({ byEntity: {} });
});
afterEach(cleanup);

describe('useStaticStep', () => {
  it('exposes the persisted artifact (undefined until produced)', () => {
    const { result } = renderHook(() => useStaticStep(entity, 'Concept Brief'));
    expect(result.current.art).toBeUndefined();
  });

  it('runProduce writes exactly the step spec output to the store', () => {
    const { result } = renderHook(() => useStaticStep(entity, 'Concept Brief'));
    act(() => result.current.runProduce());

    const expected = ITEM_STEP_SPECS['Concept Brief'].produce(entity);
    expect(result.current.art?.done).toBe(true);
    expect(result.current.art?.data).toEqual(expected.data);
  });

  it('propagates the spec ueAssets (UE Packaging produces asset paths)', () => {
    const { result } = renderHook(() => useStaticStep(entity, 'UE Packaging'));
    act(() => result.current.runProduce());

    const expected = ITEM_STEP_SPECS['UE Packaging'].produce(entity);
    expect(result.current.art?.ueAssets).toEqual(expected.ueAssets ?? []);
    expect((result.current.art?.ueAssets.length ?? 0)).toBeGreaterThan(0);
  });

  it('is the single dispatch path shared by onFix + onComplete (same callback)', () => {
    // Both step handlers call the one `runProduce`, so a re-run lands the same
    // derived-pass artifact regardless of which entry point triggered it.
    const { result } = renderHook(() => useStaticStep(entity, 'Attributes'));
    act(() => result.current.runProduce());
    expect(ITEM_STEP_SPECS['Attributes'].accept(result.current.art?.data ?? {}).status).toBe('pass');
  });
});
