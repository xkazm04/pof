import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false }),
}));

import { useMaterialParameterConfigurator } from '@/components/modules/content/materials/MaterialParameterConfigurator/useMaterialParameterConfigurator';
import type { MaterialConfiguratorConfig } from '@/components/modules/content/materials/MaterialParameterConfigurator';
import type { SurfaceType } from '@/lib/materials/surface-spec';

/**
 * Glass and water carry their own IOR / Opacity defaults in the one surface spec:
 * the dispatched Parameter Defaults must not fall back to the shared BASE_PARAMS
 * values (IOR 1.5, Opacity 1) for a surface whose physics says otherwise.
 */
function dispatched(surface: SurfaceType): MaterialConfiguratorConfig {
  const onGenerate = vi.fn();
  const { result } = renderHook(() => useMaterialParameterConfigurator(onGenerate));
  act(() => result.current.selectSurface(surface));
  act(() => result.current.handleGenerate());
  expect(onGenerate).toHaveBeenCalledTimes(1);
  return onGenerate.mock.calls[0][0] as MaterialConfiguratorConfig;
}

describe('glass and water dispatch their own IOR and Opacity defaults', () => {
  it('water ships IOR 1.33, not glass\'s 1.5', () => {
    expect(dispatched('water').params.IOR.defaultValue).toBe(1.33);
  });
  it('glass keeps IOR 1.5', () => {
    expect(dispatched('glass').params.IOR.defaultValue).toBe(1.5);
  });
  it.each(['glass', 'water'] as const)('%s ships a translucent Opacity (< 1)', (surface) => {
    expect(dispatched(surface).params.Opacity.defaultValue).toBeLessThan(1);
  });
});
