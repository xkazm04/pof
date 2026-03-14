import { describe, it, expect } from 'vitest';
import { pofRegistry } from '@/lib/dzin/panel-definitions';

const BATCH2_PANELS = [
  {
    type: 'arpg-combat-effects',
    label: 'Effects -- GameplayEffect',
    domain: 'arpg-combat',
  },
  {
    type: 'arpg-combat-tag-deps',
    label: 'Tag Deps -- Dependencies',
    domain: 'arpg-combat',
  },
  {
    type: 'arpg-combat-effect-timeline',
    label: 'Effect Timeline',
    domain: 'arpg-combat',
  },
] as const;

describe.each(BATCH2_PANELS)('pofRegistry $type registration', ({ type, domain }) => {
  it(`has ${type} registered`, () => {
    expect(pofRegistry.has(type)).toBe(true);
  });

  it('get returns definition with all required fields populated', () => {
    const def = pofRegistry.get(type);
    expect(def).toBeDefined();
    expect(def!.type).toBe(type);
    expect(def!.label).toBeTruthy();
    expect(def!.defaultRole).toBeTruthy();
    expect(def!.sizeClass).toBeTruthy();
    expect(def!.complexity).toBeTruthy();
    expect(def!.domains.length).toBeGreaterThan(0);
    expect(def!.description).toBeTruthy();
    expect(def!.capabilities.length).toBeGreaterThan(0);
    expect(def!.useCases.length).toBeGreaterThan(0);
    expect(def!.inputs.length).toBeGreaterThan(0);
    expect(def!.outputs.length).toBeGreaterThan(0);
    expect(def!.densityModes).toBeDefined();
    expect(def!.component).toBeDefined();
  });

  it(`getByDomain ${domain} includes ${type}`, () => {
    const panels = pofRegistry.getByDomain(domain);
    const types = panels.map((p) => p.type);
    expect(types).toContain(type);
  });

  it('densityModes has entries for micro, compact, and full', () => {
    const def = pofRegistry.get(type)!;
    expect(def.densityModes.micro).toBeDefined();
    expect(def.densityModes.micro!.minWidth).toBeGreaterThan(0);
    expect(def.densityModes.micro!.minHeight).toBeGreaterThan(0);
    expect(def.densityModes.micro!.description).toBeTruthy();

    expect(def.densityModes.compact).toBeDefined();
    expect(def.densityModes.compact!.minWidth).toBeGreaterThan(0);
    expect(def.densityModes.compact!.minHeight).toBeGreaterThan(0);
    expect(def.densityModes.compact!.description).toBeTruthy();

    expect(def.densityModes.full).toBeDefined();
    expect(def.densityModes.full!.minWidth).toBeGreaterThan(0);
    expect(def.densityModes.full!.minHeight).toBeGreaterThan(0);
    expect(def.densityModes.full!.description).toBeTruthy();
  });

  it('inputs array has featureMap and defs entries', () => {
    const def = pofRegistry.get(type)!;
    const inputNames = def.inputs.map((i) => i.name);
    expect(inputNames).toContain('featureMap');
    expect(inputNames).toContain('defs');
  });

  it('outputs array has at least one entry', () => {
    const def = pofRegistry.get(type)!;
    expect(def.outputs.length).toBeGreaterThanOrEqual(1);
  });
});
