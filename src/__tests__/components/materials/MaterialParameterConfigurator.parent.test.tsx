import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, renderHook, act, within } from '@testing-library/react';
import type { MaterialEntry } from '@/types/pof-bridge';

/**
 * Instance a live UE master (scan-sweep --challenge, material-configurator/B):
 * the bridge manifest (mocked — no real UE) lists two masters and one instance;
 * adopting a master makes its real scalar parameters the sliders and names it
 * as the parent of the dispatched instance. Nothing dispatches until Generate.
 */

const ROCK: MaterialEntry = {
  path: '/Game/M/M_Rock', parentMaterial: null, domain: 'Surface', blendMode: 'Opaque', shadingModel: 'DefaultLit',
  parameters: [
    { name: 'Roughness', type: 'ScalarParameter', defaultValue: 0.3, min: 0, max: 1 },
    { name: 'MossAmount', type: 'ScalarParameter', defaultValue: 0.25, min: 0, max: 1 },
    { name: 'TintColor', type: 'VectorParameter', defaultValue: [1, 1, 1, 1] },
    { name: 'BaseColor', type: 'TextureParameter', defaultTexture: '/Game/T/T_Rock_D' },
    { name: 'UseDetail', type: 'StaticSwitchParameter', defaultValue: false },
  ],
  materialInstances: ['/Game/M/MI_Rock_Wet', '/Game/M/MI_Rock_Dry'],
  textureReferences: [], crossReferences: [], contentHash: 'r',
};

const CLOTH: MaterialEntry = {
  path: '/Game/M/M_Cloth', parentMaterial: null, domain: 'Surface', blendMode: 'Opaque', shadingModel: 'Cloth',
  parameters: [{ name: 'Fuzz', type: 'ScalarParameter', defaultValue: 0.5, min: 0, max: 1 }],
  materialInstances: [], textureReferences: [], crossReferences: [], contentHash: 'c',
};

const ROCK_WET: MaterialEntry = {
  ...ROCK, path: '/Game/M/MI_Rock_Wet', parentMaterial: '/Game/M/M_Rock', materialInstances: [], contentHash: 'w',
};

vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: { materials: [CLOTH, ROCK_WET, ROCK] }, isConnected: true }),
}));

import {
  MaterialParameterConfigurator, type MaterialConfiguratorConfig,
} from '@/components/modules/content/materials/MaterialParameterConfigurator';
import { useMaterialParameterConfigurator } from '@/components/modules/content/materials/MaterialParameterConfigurator/useMaterialParameterConfigurator';
import { getApplicableParams } from '@/components/modules/content/materials/MaterialParameterConfigurator/helpers';

// setup.ts has no afterEach(cleanup).
afterEach(cleanup);

describe('useMaterialParameterConfigurator — adopt a live parent', () => {
  it('adoptParent forces an instance whose sliders and dispatch are the parent scalars at their defaults', () => {
    const onGenerate = vi.fn();
    const { result } = renderHook(() => useMaterialParameterConfigurator(onGenerate));
    act(() => result.current.adoptParent(ROCK));
    expect(onGenerate).not.toHaveBeenCalled();
    expect(result.current.outputType).toBe('instance');
    expect(result.current.applicableParams.map((p) => p.name)).toEqual(['Roughness', 'MossAmount']);

    act(() => result.current.handleGenerate());
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const cfg = onGenerate.mock.calls[0][0] as MaterialConfiguratorConfig;
    expect(cfg.outputType).toBe('instance');
    expect(cfg.parentMaterial?.path).toBe('/Game/M/M_Rock');
    expect(Object.keys(cfg.params).sort()).toEqual(['MossAmount', 'Roughness']);
    expect(cfg.params.Roughness.defaultValue).toBe(0.3);
    expect(cfg.params.MossAmount.defaultValue).toBe(0.25);
  });

  it('clearParent restores the surface sliders and the next dispatch names no parent', () => {
    const onGenerate = vi.fn();
    const { result } = renderHook(() => useMaterialParameterConfigurator(onGenerate));
    act(() => result.current.adoptParent(ROCK));
    act(() => result.current.clearParent());
    expect(result.current.applicableParams).toEqual(getApplicableParams(result.current.surfaceType));
    act(() => result.current.handleGenerate());
    const cfg = onGenerate.mock.calls[0][0] as MaterialConfiguratorConfig;
    expect(cfg.parentMaterial).toBeUndefined();
    expect('parentMaterial' in cfg).toBe(false);
  });
});

describe('MaterialParameterConfigurator — the live masters are actions', () => {
  it('lists masters only (most-instanced first); one click adopts, the chip clears', () => {
    const onGenerate = vi.fn();
    const { container, getByRole, queryByRole } = render(
      <MaterialParameterConfigurator onGenerate={onGenerate} isGenerating={false} />,
    );
    const rock = getByRole('button', { name: /Instance M_Rock/ });
    const cloth = getByRole('button', { name: /Instance M_Cloth/ });
    expect(queryByRole('button', { name: /Instance MI_Rock_Wet/ })).toBeNull();
    expect(rock.compareDocumentPosition(cloth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(rock);
    expect(onGenerate).not.toHaveBeenCalled();
    expect(rock.getAttribute('aria-pressed')).toBe('true');
    expect(within(container).getByRole('slider', { name: /MossAmount/ })).toBeTruthy();
    expect(within(container).queryByRole('slider', { name: /Metallic/ })).toBeNull();

    fireEvent.click(getByRole('button', { name: /Clear parent/ }));
    expect(within(container).queryByRole('slider', { name: /MossAmount/ })).toBeNull();
    expect(within(container).getByRole('slider', { name: /Metallic/ })).toBeTruthy();
  });

  it('choosing Master Material drops the adopted parent', () => {
    const onGenerate = vi.fn();
    const { getByRole } = render(<MaterialParameterConfigurator onGenerate={onGenerate} isGenerating={false} />);
    fireEvent.click(getByRole('button', { name: /Instance M_Rock/ }));
    fireEvent.click(getByRole('button', { name: /^Master Material/ }));
    fireEvent.click(getByRole('button', { name: /^Generate / }));
    const cfg = onGenerate.mock.calls[0][0] as MaterialConfiguratorConfig;
    expect(cfg.outputType).toBe('master');
    expect(cfg.parentMaterial).toBeUndefined();
  });
});
