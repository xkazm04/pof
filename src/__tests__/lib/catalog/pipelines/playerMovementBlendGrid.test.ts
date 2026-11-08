import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import '@/lib/catalog/pipelines/player-movement';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { resolveUeRoot } from '@/lib/catalog/acceptance/ueStaticCheckers';

/**
 * The Blend Space Grid step copy must describe the grid the UE module actually builds: read
 * `GRID` from `Content/Python/player_movement/build_blend_space.py` and assert the step names its
 * direction count, clip count and sample count. Skipped when no UE project is on this machine.
 */
const root = resolveUeRoot();
const script = root ? path.join(root, 'Content', 'Python', 'player_movement', 'build_blend_space.py') : null;
const present = !!script && fs.existsSync(script);

function readGrid(file: string): { directions: number; clips: number; samples: number } {
  const src = fs.readFileSync(file, 'utf8');
  const body = src.slice(src.indexOf('GRID = ['));
  const rows = [...body.slice(0, body.indexOf('\n]')).matchAll(/\(\s*(-?[\d.]+)\s*,\s*([\w.]+)\s*,\s*"([^"]+)"\s*\)/g)];
  const dirs = new Set(rows.filter((r) => r[2] !== '0.0').map((r) => (Number(r[1]) === -180 ? 180 : Number(r[1]))));
  return { directions: dirs.size, clips: new Set(rows.map((r) => r[3])).size, samples: rows.length };
}

describe.skipIf(!present)('player-movement Blend Space Grid copy matches the UE module GRID', () => {
  const step = getCatalogPipeline('player-movement')!.steps.find((s) => s.label === 'Blend Space Grid')!;
  const grid = present ? readGrid(script!) : { directions: 0, clips: 0, samples: 0 };
  const label = String(step.accept({}).label);
  const note = String(step.produceNote);

  it('the grid parse is sane (control for the reader)', () => {
    expect(grid.samples).toBeGreaterThan(0);
  });

  it('names the real direction, clip and sample counts', () => {
    expect(label).toContain(`${grid.samples}-sample`);
    expect(label).toContain(`${grid.directions}-direction`);
    expect(label).toContain(`${grid.clips} clips`);
    expect(note).toContain(`${grid.clips} distinct`);
  });

  it('does not claim an 8-way grid', () => {
    expect(label + note).not.toMatch(/8-way/);
  });
});
