import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StateGraphDetailFacet } from '@/components/ecw/facets/state-graph/StateGraphDetailFacet';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const sample: StoredCatalogEntity = {
  id: 'anim-jog', catalogId: 'state-graph', name: 'Jog Forward',
  categoryPath: ['Animations', 'Locomotion'], tags: ['root-motion'], lifecycle: 'planned',
  data: {
    id: 'jog-fwd', name: 'Jog Forward',
    category: 'Locomotion',
    totalFrames: 30, fps: 30,
    memorySizeMB: 1.2, hasRootMotion: true, blendInTime: 0.15,
  },
};

describe('StateGraphDetailFacet', () => {
  afterEach(cleanup);

  it('renders category + frames + fps + memory', () => {
    render(<StateGraphDetailFacet entity={sample} />);
    expect(screen.getByText(/Locomotion/)).toBeTruthy();
    expect(screen.getByText(/30 frames/i)).toBeTruthy();
    expect(screen.getByText(/30 fps/i)).toBeTruthy();
    expect(screen.getByText(/1.2 MB/)).toBeTruthy();
  });

  it('flags root-motion when present', () => {
    render(<StateGraphDetailFacet entity={sample} />);
    expect(screen.getByText(/root motion/i)).toBeTruthy();
  });

  it('flags in-place when no root motion', () => {
    render(<StateGraphDetailFacet entity={{ ...sample, data: { ...sample.data as object, hasRootMotion: false } }} />);
    expect(screen.getByText(/in-place/i)).toBeTruthy();
  });

  it('LOUDLY notes the MANUAL AnimBP requirement', () => {
    render(<StateGraphDetailFacet entity={sample} />);
    expect(screen.getByText(/MANUAL/)).toBeTruthy();
    expect(screen.getByText(/AnimBP/)).toBeTruthy();
  });

  it('shows empty-data fallback', () => {
    render(<StateGraphDetailFacet entity={{ ...sample, data: undefined }} />);
    expect(screen.getByText(/no montage data/i)).toBeTruthy();
  });
});
