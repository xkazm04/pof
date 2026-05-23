import { describe, it, expect } from 'vitest';
import { worldAlignedUvScript } from '@/lib/blender-mcp/scripts/uv-projection';

describe('worldAlignedUvScript', () => {
  it('embeds the tile size as the UV divisor', () => {
    const s = worldAlignedUvScript({ tileMeters: 4 });
    expect(s).toContain('TILE = 4');
    expect(s).toContain('/ TILE');
  });

  it('emits the three world-axis projection branches', () => {
    const s = worldAlignedUvScript({ tileMeters: 4 });
    // floor/ceiling -> XY, N/S walls -> XZ, E/W walls -> YZ
    expect(s).toContain('co.x, co.y');
    expect(s).toContain('co.x, co.z');
    expect(s).toContain('co.y, co.z');
  });

  it('classifies faces by the dominant world-space normal axis', () => {
    const s = worldAlignedUvScript({ tileMeters: 4 });
    expect(s).toContain('matrix_world');
    expect(s).toContain('poly.normal');
  });

  it('targets all mesh objects when no names are given', () => {
    const s = worldAlignedUvScript({ tileMeters: 4 });
    expect(s).toContain("obj.type == 'MESH'");
    expect(s).toContain('TARGETS = []');
  });

  it('restricts to named objects and escapes them when provided', () => {
    const s = worldAlignedUvScript({ tileMeters: 2, objectNames: ['Wall "A"'] });
    expect(s).toContain('TILE = 2');
    expect(s).toContain('Wall \\"A\\"');
    expect(s).toContain('obj.name in TARGETS');
  });
});
