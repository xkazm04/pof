import { describe, it, expect } from 'vitest';
import { importStageFor } from '@/lib/visual-gen/ue-import-job-store';

describe('importStageFor on the paths this app is actually handed', () => {
  it('reads a Windows path under mesh-finish as finished', () => {
    expect(importStageFor('C:\\Users\\kazda\\kiro\\pof\\generated\\mesh-finish\\crate.glb')).toBe('finished');
  });
  it('still reads a forward-slash path as finished and other paths as raw', () => {
    expect(importStageFor('generated/mesh-finish/crate.glb')).toBe('finished');
    expect(importStageFor('C:\\gen\\tripo\\crate.glb')).toBe('raw');
  });
});
