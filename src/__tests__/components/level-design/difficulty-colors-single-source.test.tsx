/**
 * The threat-colour map has one definition (RoomDetailPanel/constants); the
 * arc chart reads it instead of keeping a copy that can drift.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DifficultyArcChart } from '@/components/modules/content/level-design/DifficultyArcChart';
import { DIFFICULTY_COLORS } from '@/components/modules/content/level-design/RoomDetailPanel/constants';
import { STATUS_SUCCESS, STATUS_LIME, STATUS_WARNING, STATUS_BLOCKER, STATUS_ERROR } from '@/lib/chart-colors';
import type { RoomNode, DifficultyLevel } from '@/types/level-design';

afterEach(cleanup);

const DIR = 'src/components/modules/content/level-design';
const room = (id: string, difficulty: DifficultyLevel): RoomNode => ({
  id, name: `Room ${id}`, type: 'exploration', description: '', encounterDesign: '',
  difficulty, pacing: 'rest', x: 0, y: 0, linkedFiles: [], spawnEntries: [], tags: [],
});

describe('difficulty colours', () => {
  it('the chart keeps no local copy of the map', () => {
    const src = readFileSync(join(process.cwd(), DIR, 'DifficultyArcChart.tsx'), 'utf8');
    expect(src.match(/const DIFFICULTY_COLORS/g) ?? []).toHaveLength(0);
  });

  it('point strokes are unchanged: severity colours 1 to 5 in order', () => {
    const levels: DifficultyLevel[] = [1, 2, 3, 4, 5];
    const { container } = render(
      <DifficultyArcChart rooms={levels.map((d) => room(String(d), d))} difficultyArc={[]} accentColor="var(--text)" onSelectRoom={() => {}} />,
    );
    const strokes = [...container.querySelectorAll('g[role="button"] circle')].map((c) => c.getAttribute('stroke'));
    expect(strokes).toEqual([STATUS_SUCCESS, STATUS_LIME, STATUS_WARNING, STATUS_BLOCKER, STATUS_ERROR]);
    expect(strokes).toEqual(levels.map((d) => DIFFICULTY_COLORS[d]));
  });
});
