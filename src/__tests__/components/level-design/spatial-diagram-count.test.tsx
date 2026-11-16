/** The "N/M systems" header counts the diagram's nodes, not a literal 3. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('@/components/modules/content/level-design/LevelDesignSpatialDiagram/constants', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/modules/content/level-design/LevelDesignSpatialDiagram/constants')>();
  const extra = { ...real.NODES[0], id: 'ld-4', label: 'Navigation', dependencies: [] };
  return { ...real, NODES: [...real.NODES, extra] };
});

import { LevelDesignSpatialDiagram } from '@/components/modules/content/level-design/LevelDesignSpatialDiagram';

afterEach(cleanup);

describe('LevelDesignSpatialDiagram header count', () => {
  it('reads 0/4 for a 4-node diagram', () => {
    const { container } = render(
      <LevelDesignSpatialDiagram onRunPrompt={() => {}} isRunning={false} activeItemId={null} />,
    );
    expect(container.textContent).toContain('0/4 systems');
  });
});
