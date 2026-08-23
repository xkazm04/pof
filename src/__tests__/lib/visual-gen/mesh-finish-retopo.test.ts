import { describe, it, expect } from 'vitest';
import {
  buildMeshFinishArgs,
  parseMeshFinishOutput,
  quadDeliveryNote,
  type MeshFinishSpec,
} from '@/lib/visual-gen/mesh-finish';

const SPEC: MeshFinishSpec = {
  highPolyPath: 'C:/in/hero.glb',
  outputPath: 'C:/out/hero_low.glb',
  targetFaces: 40000,
};

describe('buildMeshFinishArgs — retopo mode', () => {
  // Byte-identical default: every existing caller keeps the collapse-decimate path and
  // the exact argv it had before, so this is additive and cannot regress a live run.
  it('emits no --retopo flag by default', () => {
    expect(buildMeshFinishArgs('s.py', SPEC)).not.toContain('--retopo');
    expect(buildMeshFinishArgs('s.py', { ...SPEC, retopo: 'collapse' })).not.toContain('--retopo');
  });

  it('emits --retopo quadriflow when asked for regular topology', () => {
    const args = buildMeshFinishArgs('s.py', { ...SPEC, retopo: 'quadriflow' });
    expect(args[args.indexOf('--retopo') + 1]).toBe('quadriflow');
  });

  // QuadriFlow is a remesher targeting a face count; without a budget there is nothing
  // to target, and the existing unwrap plan already treats "no targetFaces" as "no
  // retopo stage at all".
  it('does not request quadriflow when there is no face budget to target', () => {
    const args = buildMeshFinishArgs('s.py', { ...SPEC, targetFaces: undefined, retopo: 'quadriflow' });
    expect(args).not.toContain('--retopo');
  });
});

describe('parseMeshFinishOutput — retopo honesty', () => {
  it('reports the retopo mode the script actually applied', () => {
    const out = parseMeshFinishOutput(
      'POF_MESHFINISH_RETOPO=quadriflow\nPOF_MESHFINISH_QUADS_AUTHORED=18342\nPOF_MESHFINISH_DONE=C:/out/hero_low.glb',
    );
    expect(out.retopo).toBe('quadriflow');
    expect(out.quadsAuthored).toBe(18342);
  });

  // The whole reason this can be shipped honestly. QuadriFlow authors quads, but glTF 2.0
  // has no quad primitive and Blender triangulates on GLB export — so the delivered .glb
  // is triangles no matter what. A run that said "quadriflow" and nothing else would let
  // a reader believe the artifact contains quads.
  it('always states that authored quads are delivered triangulated', () => {
    const out = parseMeshFinishOutput(
      'POF_MESHFINISH_RETOPO=quadriflow\nPOF_MESHFINISH_QUADS_AUTHORED=18342\nPOF_MESHFINISH_DONE=C:/out/x.glb',
    );
    expect(out.quadDeliveryNote).toBeTruthy();
    expect(out.quadDeliveryNote).toContain('triangulated');
  });

  it('adds no delivery note for a collapse run, which never authored quads', () => {
    const out = parseMeshFinishOutput('POF_MESHFINISH_RETOPO=collapse\nPOF_MESHFINISH_DONE=C:/out/x.glb');
    expect(out.retopo).toBe('collapse');
    expect(out.quadDeliveryNote).toBeUndefined();
    expect(out.quadsAuthored).toBeUndefined();
  });

  // A silent downgrade to collapse would be the same lie class `shadingSkippedReason`
  // and `uvModeFallbackReason` already exist to prevent.
  it('surfaces why quadriflow was refused instead of silently collapsing', () => {
    const out = parseMeshFinishOutput(
      'POF_MESHFINISH_RETOPO=collapse\nPOF_MESHFINISH_RETOPO_FALLBACK=quadriflow failed on a non-manifold input; fell back to collapse\nPOF_MESHFINISH_DONE=C:/out/x.glb',
    );
    expect(out.retopo).toBe('collapse');
    expect(out.retopoFallbackReason).toContain('quadriflow failed');
  });

  it('leaves retopo undefined for legacy output that predates the marker', () => {
    const out = parseMeshFinishOutput('POF_MESHFINISH_FACES_OUT=40000\nPOF_MESHFINISH_DONE=C:/out/x.glb');
    expect(out.retopo).toBeUndefined();
    expect(out.retopoFallbackReason).toBeUndefined();
  });
});

describe('quadDeliveryNote', () => {
  it('is stated only when quads were actually authored', () => {
    expect(quadDeliveryNote('quadriflow')).toContain('triangulated');
    expect(quadDeliveryNote('collapse')).toBeUndefined();
    expect(quadDeliveryNote(undefined)).toBeUndefined();
  });

  it('names glTF as the reason, so the limit is not read as a PoF bug', () => {
    expect(quadDeliveryNote('quadriflow')!.toLowerCase()).toContain('gltf');
  });
});
