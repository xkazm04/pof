// @vitest-environment node
/**
 * The local image-to-mesh scripts, run with `python -I` over fake packages.
 * FAKES ONLY: no torch, no model, no GPU.
 */
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { pythonAvailable, runPy, scriptPath, tempTree } from '@/__tests__/scripts/visualGenPyHarness';

/** The fake generator dies the way a native CUDA fault does: at once, without flushing. */
const DIE = 'import os\ndef die(*a, **k):\n    os._exit(9)\n';
const OBJ = 'class _O:\n    def __call__(self, *a, **k):\n        return self\n    def __getattr__(self, n):\n        return self\n';
const IMG = 'class _I:\n    def convert(self, m):\n        return self\ndef open(p):\n    return _I()\n';
const TORCH = 'class cuda:\n    @staticmethod\n    def is_available():\n        return False\nfloat32 = None\n';

const FAKES: Record<string, string> = {
  'torch.py': TORCH,
  'numpy.py': '',
  'o_voxel.py': '',
  'rembg.py': '',
  'PIL/__init__.py': '',
  'PIL/Image.py': IMG,
  'trellis2/__init__.py': '',
  'trellis2/pipelines.py': `${DIE}${OBJ}class Trellis2ImageTo3DPipeline:\n    @staticmethod\n    def from_pretrained(m):\n        return Trellis2ImageTo3DPipeline()\n    def cuda(self):\n        pass\n    run = die\n`,
  'hy3dgen/__init__.py': '',
  'hy3dgen/shapegen.py': `${DIE}class Hunyuan3DDiTFlowMatchingPipeline:\n    @staticmethod\n    def from_pretrained(m):\n        return Hunyuan3DDiTFlowMatchingPipeline()\n    __call__ = die\n`,
  'hy3dgen/rembg.py': 'class BackgroundRemover:\n    def __call__(self, i):\n        return i\n',
  'tsr/__init__.py': '',
  'tsr/system.py': `${DIE}class TSR:\n    from_pretrained = staticmethod(die)\n`,
  'tsr/utils.py': 'remove_background = resize_foreground = None\n',
};

const CASES = [
  { script: 'pof_trellis.py', root: '--trellis-root', extra: [] as string[], progress: 'POF_T2_LOAD_S=', error: 'POF_T2_ERROR=' },
  { script: 'pof_hunyuan.py', root: '--hunyuan-root', extra: [] as string[], progress: 'POF_HY3D_LOAD_S=', error: 'POF_HY3D_ERROR=' },
  { script: 'pof_triposr.py', root: '--triposr-root', extra: ['--no-remove-bg'], progress: 'POF_TRIPOSR_DEVICE=', error: 'POF_TRIPOSR_ERROR=' },
];

describe.skipIf(!pythonAvailable).each(CASES)('$script', ({ script, root, extra, progress }) => {
  it('progress already printed survives a process that dies without flushing', () => {
    const dir = tempTree({ ...FAKES, 'in.png': 'x' });
    const r = runPy([scriptPath(script), '--image', join(dir, 'in.png'), '--output', join(dir, 'o.glb'), root, dir, ...extra]);
    expect(r.status).toBe(9);
    expect(r.stdout).toContain(progress);
  });
});
