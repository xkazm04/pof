import { describe, it, expect } from 'vitest';
import { pofRegistry } from '@/lib/dzin/panel-definitions';

const BATCH1_PANELS = [
  'arpg-combat-attributes',
  'arpg-combat-tags',
  'arpg-combat-abilities',
] as const;

describe.each(BATCH1_PANELS)('pofRegistry %s registration', (panelType) => {
  it('is registered in the registry', () => {
    expect(pofRegistry.has(panelType)).toBe(true);
  });

  it('has all required fields populated', () => {
    const def = pofRegistry.get(panelType);
    expect(def).toBeDefined();
    expect(def!.type).toBe(panelType);
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

  it('is included in getByDomain arpg-combat', () => {
    const panels = pofRegistry.getByDomain('arpg-combat');
    const types = panels.map((p) => p.type);
    expect(types).toContain(panelType);
  });

  it('densityModes has entries for micro, compact, and full', () => {
    const def = pofRegistry.get(panelType)!;
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
    const def = pofRegistry.get(panelType)!;
    const inputNames = def.inputs.map((i) => i.name);
    expect(inputNames).toContain('featureMap');
    expect(inputNames).toContain('defs');
  });

  it('outputs array has at least one entry', () => {
    const def = pofRegistry.get(panelType)!;
    expect(def.outputs.length).toBeGreaterThanOrEqual(1);
  });
});
