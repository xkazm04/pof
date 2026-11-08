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
