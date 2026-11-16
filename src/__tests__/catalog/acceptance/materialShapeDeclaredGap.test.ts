/**
 * materialShape promises "identical null-strictness to fieldsPopulated" — and fieldsPopulated reads
 * a DECLARED gap ("not in the reference") as unpopulated. materialShape used `== null` only, so a
 * Material whose parent material and textures were both written as the gap marker graded pass.
 */
import { describe, it, expect } from 'vitest';
import { materialShape, fieldsPopulated } from '@/lib/catalog/acceptance/dataCheckers';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

const check = materialShape('material', 'Material');

describe('materialShape over a declared gap', () => {
  it('grades a single-master gap pending, exactly as fieldsPopulated does', () => {
    const data = { material: { parentMaterial: REFERENCE_GAP, textures: { value: REFERENCE_GAP } } };
    const pop = fieldsPopulated('material', 'Material', ['parentMaterial', 'textures'])(data);
    expect(pop.status).toBe('pending');
    const res = check(data);
    expect(res.status).toBe('pending');
    expect(res.reason).toContain('parentMaterial');
    expect(res.reason).toContain('textures');
  });

  it('fails a multi-master entry whose field is a declared gap, naming its index', () => {
    const res = check({ material: { parentMaterials: [
      { surface: 'blade', parentMaterial: 'M_Metal', textures: ['T_Blade_D'] },
      { surface: 'grip', parentMaterial: REFERENCE_GAP, textures: ['T_Grip_D'] },
    ] } });
    expect(res.status).toBe('fail');
    expect(res.reason).toContain('parentMaterials[1]');
    expect(res.reason).toContain('parentMaterial');
  });

  it('still passes real values on both shapes', () => {
    expect(check({ material: { parentMaterial: 'M_Metal', textures: ['T_D'] } }).status).toBe('pass');
    expect(check({ material: { parentMaterials: [{ surface: 'blade', parentMaterial: 'M_Metal', textures: ['T_D'] }] } }).status).toBe('pass');
  });
});
