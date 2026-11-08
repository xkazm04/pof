/**
 * eqs-squad-combat-spatial — accessibility + id-uniqueness parity guards
 * (scan-sweep night 2026-11-08). Each block pins one surface to the rule a
 * sibling surface in the same context already follows.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { EQSComponentInventory } from '@/components/modules/game-systems/EQSComponentInventory';

afterEach(cleanup);

describe('EQSComponentInventory — disclosure parity with EQSPipelineDiagram/StepCard', () => {
  it('every card toggle is a typed disclosure button whose aria-controls resolves', () => {
    const { container } = render(<EQSComponentInventory />);
    const toggles = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-testid$="-toggle"]'),
    );
    expect(toggles.length).toBeGreaterThan(0);
    for (const t of toggles) {
      expect(t.getAttribute('type')).toBe('button');
      expect(t.getAttribute('aria-expanded')).toBe('false');
      const controls = t.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      expect(container.querySelector(`[id="${controls}"]`)).not.toBeNull();
    }
    fireEvent.click(toggles[0]);
    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
    const panel = container.querySelector(`[id="${toggles[0].getAttribute('aria-controls')}"]`);
    expect(panel?.hasAttribute('hidden')).toBe(false);
  });
});

describe('SquadChoreographyEditor/FormationView — SVG ids are unique per mount', () => {
  it('two mounted editors get distinct arrow markers, each line pointing at its own', async () => {
    const { SquadChoreographyEditor } = await import('@/components/modules/game-systems/SquadChoreographyEditor');
    const { container } = render(<><SquadChoreographyEditor /><SquadChoreographyEditor /></>);
    const markers = Array.from(container.querySelectorAll('marker')).map((m) => m.id);
    expect(markers.length).toBe(2);
    expect(new Set(markers).size).toBe(2);
    const refs = Array.from(container.querySelectorAll('line[marker-end]'))
      .map((l) => l.getAttribute('marker-end'));
    expect(refs.sort()).toEqual(markers.map((id) => `url(#${id})`).sort());
  });
});

describe('EQS reference views — DOM ids are unique per mount', () => {
  it('two mounts of the pipeline diagram and inventory share no id', async () => {
    const { EQSPipelineDiagram } = await import('@/components/modules/game-systems/EQSPipelineDiagram');
    const { container } = render(
      <><EQSPipelineDiagram /><EQSPipelineDiagram /><EQSComponentInventory /><EQSComponentInventory /></>,
    );
    const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
    // Every reference still resolves after the ids became per-mount.
    for (const el of Array.from(container.querySelectorAll('[aria-controls],[aria-labelledby]'))) {
      const ref = el.getAttribute('aria-controls') ?? el.getAttribute('aria-labelledby');
      expect(container.querySelector(`[id="${ref}"]`)).not.toBeNull();
    }
  });
});

describe('AttackRingVisualizer controls — named like the squad editor sliders', () => {
  it('both sliders have an accessible name and value text; the ring toggle reports pressed state', async () => {
    const { AttackRingVisualizer } = await import('@/components/modules/game-systems/AttackRingVisualizer');
    const { container } = render(<AttackRingVisualizer />);
    const sliders = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="range"]'));
    expect(sliders.length).toBe(2);
    for (const s of sliders) {
      expect(s.getAttribute('aria-label')).toBeTruthy();
      expect(s.getAttribute('aria-valuetext')).toBeTruthy();
    }
    const dist = container.querySelector('[data-testid="attack-ring-distance"]')!;
    expect(dist.getAttribute('aria-valuetext')).toBe(`${(dist as HTMLInputElement).value} UU`);
    const toggle = container.querySelector('[data-testid="attack-ring-inner-toggle"]')!;
    expect(toggle.getAttribute('type')).toBe('button');
    expect(toggle.getAttribute('aria-label')).toBe('bGenerateInnerRing');
    const before = toggle.getAttribute('aria-pressed');
    expect(before === 'true' || before === 'false').toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe(before === 'true' ? 'false' : 'true');
  });
});

describe('EQS spatial diagrams — each SVG is a named image like FormationView', () => {
  it('attack-ring and patrol-points SVGs carry role="img" and a label stating their figures', async () => {
    const { AttackRingVisualizer } = await import('@/components/modules/game-systems/AttackRingVisualizer');
    const { PatrolPointsDistribution } = await import('@/components/modules/game-systems/PatrolPointsDistribution');
    const { EQS_ATTACK_POSITIONS, EQS_PATROL_POINTS } = await import('@/lib/ai-director/eqs-defaults');
    const { container } = render(<><AttackRingVisualizer /><PatrolPointsDistribution /></>);
    const ring = container.querySelector('[data-testid="attack-ring-svg"]')!;
    expect(ring.getAttribute('role')).toBe('img');
    expect(ring.getAttribute('aria-label')).toContain(`${EQS_ATTACK_POSITIONS.numberOfPoints} points`);
    expect(ring.getAttribute('aria-label')).toContain(`${EQS_ATTACK_POSITIONS.attackDistance} UU`);
    const patrol = container.querySelector('[data-testid="patrol-points-svg"] svg')!;
    expect(patrol.getAttribute('role')).toBe('img');
    expect(patrol.getAttribute('aria-label')).toContain(`${EQS_PATROL_POINTS.numberOfPoints} random points`);
    expect(patrol.getAttribute('aria-label')).toContain(`${EQS_PATROL_POINTS.minRadius}`);
    expect(patrol.getAttribute('aria-label')).toContain(`${EQS_PATROL_POINTS.maxRadius}`);
  });
});

describe('PatrolPointsDistribution labels — at the 12px floor and inside the viewBox', () => {
  /** Monospace advance ≈ 0.6em; text-xs = 12px. */
  const MONO_ADVANCE = 0.6;
  const FLOOR_PX = 12;
  it('no label uses a sub-floor fontSize attribute, and each radius label fits horizontally', async () => {
    const { PatrolPointsDistribution } = await import('@/components/modules/game-systems/PatrolPointsDistribution');
    const { container } = render(<PatrolPointsDistribution />);
    const svg = container.querySelector('[data-testid="patrol-points-svg"] svg')!;
    const size = Number(svg.getAttribute('width'));
    const texts = Array.from(svg.querySelectorAll('text'));
    expect(texts.length).toBe(3);
    for (const t of texts) {
      expect(t.getAttribute('font-size')).toBeNull();
      expect(t.getAttribute('class') ?? '').toContain('text-xs');
      const width = (t.textContent ?? '').length * MONO_ADVANCE * FLOOR_PX;
      const x = Number(t.getAttribute('x'));
      const anchor = t.getAttribute('text-anchor') ?? 'start';
      const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(size);
      expect(Number(t.getAttribute('y'))).toBeGreaterThanOrEqual(FLOOR_PX);
    }
  });
});
