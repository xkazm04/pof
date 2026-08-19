/**
 * `aoStrength` was a full phantom: in the params, in every preset, with a
 * slider — and read by NOTHING. `aoTexture` was uploadable, stored and reset,
 * and never reached the preview. These assert the AO decision (wired, not
 * removed): an AO map reaches `aoMap`, and moving AO Strength is observable as
 * a real `aoMapIntensity` change.
 */
import { describe, it, expect } from 'vitest';
import { buildStandardMaterialProps } from '@/components/modules/visual-gen/material-lab/materialPreviewProps';
import type { PBRParams } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

const PARAMS: PBRParams = {
  baseColor: '#8b6914',
  metallic: 0.2,
  roughness: 0.7,
  normalStrength: 1.4,
  aoStrength: 1,
};

const NO_MAPS = { albedo: null, normal: null, metallic: null, roughness: null, ao: null };

// Opaque stand-ins for THREE.Texture — the mapping is what is under test.
const AO = { id: 'ao' };
const ALBEDO = { id: 'albedo' };
const NORMAL = { id: 'normal' };

describe('buildStandardMaterialProps', () => {
  it('routes an AO map into aoMap — the channel that used not to exist', () => {
    const props = buildStandardMaterialProps(PARAMS, { ...NO_MAPS, ao: AO });
    expect(props.aoMap).toBe(AO);
  });

  it('makes an AO Strength change observable', () => {
    const full = buildStandardMaterialProps(PARAMS, { ...NO_MAPS, ao: AO });
    const dialled = buildStandardMaterialProps({ ...PARAMS, aoStrength: 0.25 }, { ...NO_MAPS, ao: AO });
    expect(full.aoMapIntensity).toBe(1);
    expect(dialled.aoMapIntensity).toBe(0.25);
    expect(dialled.aoMapIntensity).not.toBe(full.aoMapIntensity);
  });

  it('keeps the base colour tint only when there is no albedo map', () => {
    expect(buildStandardMaterialProps(PARAMS, NO_MAPS).color).toBe('#8b6914');
    expect(buildStandardMaterialProps(PARAMS, { ...NO_MAPS, albedo: ALBEDO }).color).toBeUndefined();
  });

  it('applies normalScale only alongside a normal map', () => {
    expect(buildStandardMaterialProps(PARAMS, NO_MAPS).normalScale).toBeUndefined();
    expect(buildStandardMaterialProps(PARAMS, { ...NO_MAPS, normal: NORMAL }).normalScale).toEqual([1.4, 1.4]);
  });

  it('passes the scalars straight through', () => {
    const props = buildStandardMaterialProps(PARAMS, NO_MAPS);
    expect(props.metalness).toBe(0.2);
    expect(props.roughness).toBe(0.7);
  });
});
