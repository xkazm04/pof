/**
 * SpawnFormationViz lays the spawn points out per formation inside a 140x140 viewBox.
 * Every formation must keep each spawn marker (r=10) and its role label inside the box,
 * and no two markers may overlap - otherwise the order numbers and roles become unreadable.
 *
 * Measured 2026-11-08 on the 6 shipped SPAWN_POINTS: Line spaced markers 14.3 apart
 * (5 overlapping pairs); Ambush stacked each cluster 20 apart on one x (touching
 * markers, labels drawn inside the next marker) and pushed the last role label to y=146.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SpawnFormationViz, type SpawnFormation } from '@/components/modules/core-engine/sub_bestiary/encounters/SpawnFormationViz';
import { SPAWN_POINTS } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

afterEach(cleanup);

const BOX = 140;
/** A 12px label occupies roughly [y-9, y+3] around its baseline. */
const LABEL_ASCENT = 9;

function layout(formation: SpawnFormation) {
  const { container } = render(<SpawnFormationViz spawnPoints={SPAWN_POINTS} formation={formation} />);
  const markers = Array.from(container.querySelectorAll('g > circle')).map(c => ({
    x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')), r: Number(c.getAttribute('r')),
  }));
  const labels = Array.from(container.querySelectorAll('g > text'))
    .filter(t => /^[a-z]{1,3}$/i.test(t.textContent ?? '') && Number.isNaN(Number(t.textContent)))
    .map(t => ({ x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')) }));
  return { markers, labels };
}

describe.each(['Circle', 'Line', 'Ambush'] as const)('SpawnFormationViz %s formation', (formation) => {
  it('keeps every marker and role label inside the viewBox', () => {
    const { markers, labels } = layout(formation);
    expect(markers).toHaveLength(SPAWN_POINTS.length);
    expect(labels).toHaveLength(SPAWN_POINTS.filter(s => s.role).length);
    const out = [
      ...markers.filter(m => m.x - m.r < 0 || m.x + m.r > BOX || m.y - m.r < 0 || m.y + m.r > BOX).map(m => `marker@${m.x},${m.y}`),
      ...labels.filter(l => l.y > BOX || l.y - LABEL_ASCENT < 0).map(l => `label@${l.x},${l.y}`),
    ];
    expect(out).toEqual([]);
  });

  it('never overlaps two markers or draws a role label inside another marker', () => {
    const { markers, labels } = layout(formation);
    const clashes: string[] = [];
    for (let i = 0; i < markers.length; i++) {
      for (let j = i + 1; j < markers.length; j++) {
        const a = markers[i], b = markers[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) <= a.r + b.r) clashes.push(`markers ${i}/${j}`);
      }
    }
    labels.forEach((l, li) => markers.forEach((m, mi) => {
      const top = l.y - LABEL_ASCENT;
      if (Math.abs(l.x - m.x) < m.r && top < m.y + m.r && l.y > m.y - m.r && Math.abs(l.y - 16 - m.y) > 0.01) {
        clashes.push(`label ${li} in marker ${mi}`);
      }
    }));
    expect(clashes).toEqual([]);
  });
});
