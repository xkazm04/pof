/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Live smoke test for the TRELLIS.2 wire — drives the REAL PoF runner
 * (src/lib/visual-gen/trellis-runner.ts) through the WSL seam, so a pass proves the
 * whole path: spec -> args -> wsl.exe -> pof_trellis.py -> markers -> path mapped back.
 *
 * A/B control: `jinx_hd_concept.png` is the same hero concept PoF fed Tripo for
 * generated/tripo3d/jinx.glb, so the two meshes are comparable on identical input.
 *
 *   npx tsx <this file>
 */
import { runTrellis } from '@/lib/visual-gen/trellis-runner';
import { critiqueMesh } from '@/lib/visual-gen/mesh-critique';
import { localCritiqueDeps } from '@/lib/visual-gen/polycount-presets';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const OUT_DIR = join(CWD, 'generated', 'trellis2');
mkdirSync(OUT_DIR, { recursive: true });

const image = join(CWD, 'generated', 'jinx-leo', 'jinx_hd_concept.png');
const output = join(OUT_DIR, 'jinx_t2.glb');

async function main() {
  console.log('[t2] image :', image);
  console.log('[t2] output:', output);
  const t0 = Date.now();

  const res = await runTrellis({
    imagePath: image,
    outputPath: output,
    // 40k = the character class budget from polycount-presets, sent NATIVELY.
    decimationTarget: 40_000,
    // 24GB card with the desktop already holding ~1.3GB: drop the bake from 4096.
    textureSize: Number(process.env.T2_TEX ?? 2048),
    timeoutMs: 3_600_000,
  });

  console.log('\n=== RUNNER RESULT ===');
  console.log(JSON.stringify({ ...res, }, null, 2));

  if (!res.ok) {
    console.log('\n[t2] FAILED —', res.error);
    process.exit(1);
  }

  console.log('[t2] file size:', (statSync(res.meshPath!).size / 1e6).toFixed(1), 'MB');
  console.log('[t2] wall:', ((Date.now() - t0) / 1000).toFixed(1), 's');

  // Grade it with PoF's own Tier-1 gate, against the character class.
  const gate = localCritiqueDeps('character');
  const critique = await critiqueMesh(res.meshPath!, gate.deps);
  console.log('\n=== TIER-1 GATE (graded as:', gate.gradedAs, ') ===');
  console.log(JSON.stringify(critique, null, 2));
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
