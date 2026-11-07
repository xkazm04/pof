/**
 * TacticsMap's slot-rotation arrow used a document-global `<marker id="arrowhead">`.
 * Two other components (models DependencyGraph, ability TagDepsSection) declare the same
 * id, and the module LRU keeps hidden modules mounted, so `url(#arrowhead)` could resolve
 * to a foreign marker (different size and colour). The marker id must be per-instance.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TacticsMap } from '@/components/modules/core-engine/sub_bestiary/encounters/TacticsMap';
import { TACTICS_ENEMIES, TACTICS_ROLE_COLORS } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

afterEach(cleanup);

describe('TacticsMap arrow marker id', () => {
  it('is unique per instance and never the shared "arrowhead" id', () => {
    const { container } = render(
      <div>
        <svg><defs><marker id="arrowhead" /></defs></svg>
        <TacticsMap enemies={TACTICS_ENEMIES} roleColors={TACTICS_ROLE_COLORS} />
        <TacticsMap enemies={TACTICS_ENEMIES} roleColors={TACTICS_ROLE_COLORS} />
      </div>,
    );
    const ids = Array.from(container.querySelectorAll('marker')).map(m => m.getAttribute('id'));
    expect(new Set(ids).size).toBe(ids.length);

    const maps = Array.from(container.querySelectorAll('svg')).slice(1);
    expect(maps).toHaveLength(2);
    for (const svg of maps) {
      const own = svg.querySelector('marker')!.getAttribute('id');
      expect(own).not.toBe('arrowhead');
      const refs = Array.from(svg.querySelectorAll('[marker-end]')).map(p => p.getAttribute('marker-end'));
      expect(refs.length).toBeGreaterThan(0);
      for (const r of refs) expect(r).toBe(`url(#${own})`);
    }
  });
});
