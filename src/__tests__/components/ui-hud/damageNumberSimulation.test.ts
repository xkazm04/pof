import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import { DamageNumberPalette } from '@/components/modules/content/ui-hud/DamageNumberPalette';
import { spawnParticle, updateParticle } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/simulation';
import { DEFAULT_PHYSICS, DEFAULT_COMBAT } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/constants';

/**
 * The simulator claims to mirror UDamageNumberWidget. Its display strings must be the
 * ones DamageNumberWidget.cpp InitDamageNumber prints: "+%.0f" heal, "CRIT! %.0f" crit,
 * "%.0f" normal (UE project Source/PoF/UI/DamageNumberWidget.cpp:70-81).
 */

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('damage number display text', () => {
  it('a crit reads "CRIT! <n>", as the widget prints it', () => {
    const p = spawnParticle(DEFAULT_PHYSICS, { ...DEFAULT_COMBAT, critRate: 1, healPercent: 0 }, 520, 300, 0);
    expect(p.isCrit).toBe(true);
    expect(p.displayText).toBe(`CRIT! ${p.amount}`);
  });

  it('a heal reads "+<n>" and a normal hit "<n>"', () => {
    const heal = spawnParticle(DEFAULT_PHYSICS, { ...DEFAULT_COMBAT, critRate: 0, healPercent: 1 }, 520, 300, 0);
    expect(heal.displayText).toBe(`+${heal.amount}`);
    const hit = spawnParticle(DEFAULT_PHYSICS, { ...DEFAULT_COMBAT, critRate: 0, healPercent: 0 }, 520, 300, 0);
    expect(hit.displayText).toBe(`${hit.amount}`);
  });
});

describe('DamageNumberPalette format strings', () => {
  it('quotes the widget Printf formats, with no space after the heal "+"', () => {
    const { container } = render(createElement(DamageNumberPalette));
    const formats = Array.from(container.querySelectorAll('code')).map((c) => c.textContent);
    expect(formats).toEqual(['"%.0f"', '"CRIT! %.0f"', '"+%.0f"']);
  });
});

describe('merge-mode stack growth', () => {
  it('a merged number keeps its stack scale through the next frame', () => {
    const physics = { ...DEFAULT_PHYSICS, stackMode: 'merge' as const };
    const p = { ...spawnParticle(physics, { ...DEFAULT_COMBAT, critRate: 0, healPercent: 0 }, 520, 300, 0), stackCount: 3, scale: 1.2 };
    const next = updateParticle(p, 1 / 60, physics, [p]);
    expect(next.scale).toBeCloseTo(1.2, 5);
  });

  it('outside merge mode a non-crit stays at scale 1', () => {
    const p = { ...spawnParticle(DEFAULT_PHYSICS, { ...DEFAULT_COMBAT, critRate: 0, healPercent: 0 }, 520, 300, 0), stackCount: 3 };
    expect(updateParticle(p, 1 / 60, DEFAULT_PHYSICS, [p]).scale).toBe(1);
  });
});
