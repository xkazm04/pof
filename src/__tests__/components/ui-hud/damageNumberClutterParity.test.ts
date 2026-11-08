import { describe, it, expect, afterEach } from 'vitest';
import { createElement, createRef } from 'react';
import { render, cleanup } from '@testing-library/react';
import { ClutterBadge } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/ClutterBadge';
import { SimulationCanvas } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/SimulationCanvas';
import { DEFAULT_PHYSICS } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/constants';

/**
 * The header badge and the Clutter metric tile grade the same clutterScore. They must
 * agree on the band at every score, or the header says "Clear" over a warning tile.
 */

afterEach(cleanup);

function badgeColor(score: number): string {
  const { container } = render(createElement(ClutterBadge, { score }));
  const color = (container.firstElementChild as HTMLElement).style.color;
  cleanup();
  return color;
}

function tileColor(score: number): string {
  const { container } = render(createElement(SimulationCanvas, {
    isRunning: false, toggleRunning: () => {}, reset: () => {}, particles: [], totalSpawned: 0,
    canvasRef: createRef<HTMLDivElement>(), canvasH: 300, mobMarkers: [],
    metrics: { avgOverlaps: 0, maxSimultaneous: 0, avgReadTime: 1, clutterScore: score },
    physics: DEFAULT_PHYSICS,
  }));
  const label = Array.from(container.querySelectorAll('div')).find((d) => d.textContent === 'Clutter');
  const value = label!.previousElementSibling as HTMLElement;
  const color = value.style.color;
  cleanup();
  return color;
}

describe('clutter band parity', () => {
  it('badge and metric tile use one band for every score 0..100', () => {
    const disagree: number[] = [];
    for (let s = 0; s <= 100; s++) if (badgeColor(s) !== tileColor(s)) disagree.push(s);
    expect(disagree).toEqual([]);
  });
});
