#!/usr/bin/env node
/**
 * PoF Tripo3D generator — the CLOUD 3D-gen operator CLI (counterpart to the local
 * pof_triposr.py / pof_hunyuan.py). A thin door over the app's ONE Tripo client:
 * src/lib/visual-gen/tripo-runner.ts (upload → create → poll → download, task recovery),
 * tripo-models.ts (the audited model pin + the smart_low_poly verdict) and tripo-cli.ts
 * (plan + execute). Node strips the types on import, so nothing here is a copy.
 * Emits POF_TRIPO_* markers (declared in src/lib/visual-gen/script-markers.ts).
 * Needs TRIPO_API_KEY in env for a paid run; --dry needs none.
 *
 *   node pof_tripo.mjs --image ref.png --output out.glb          # pinned v3.1 + detailed
 *   node pof_tripo.mjs --prompt "a stylized fantasy warrior, full body" --output out.glb
 *   node pof_tripo.mjs --image ref.png --output out.glb --dry    # print the exact paid body, spend nothing
 *   node pof_tripo.mjs --resume <taskId> --output out.glb        # collect a paid task, never re-buy it
 *   # optional: --pbr --quad --face-limit 40000 --texture-quality standard|detailed
 *   #           --render preview.webp --max-ms 600000
 *   #           --model <id>   (overrides the audited pin; warned as unaudited)
 *   #           --smart-low-poly is REFUSED (benchmarked + rejected 2026-08-18) unless
 *   #           --force-smart-low-poly is passed too
 * A recoverable failure (poll window spent, unreadable polls, failed download) prints
 * POF_TRIPO_RESUME=<the exact flags to collect it>; a terminal Tripo verdict does not.
 */
import { mkdirSync, statSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import {
  awaitTripoTask, buildCreateTaskBody, isRecoverableTripoFailure, isTripoTaskId, runTripo,
} from '../../src/lib/visual-gen/tripo-runner.ts';
import { SMART_LOW_POLY_VERDICT, tripoModelFor } from '../../src/lib/visual-gen/tripo-models.ts';
import { executeTripoCli, parseTripoCliArgs, planTripoCli } from '../../src/lib/visual-gen/tripo-cli.ts';

async function downloadFile(url, path) {
  const res = await fetch(url);
  if (!res.ok) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function main() {
  const args = { ...parseTripoCliArgs(process.argv.slice(2)) };
  // Absolute paths, as the script always printed, so a POF_TRIPO_RESUME line is runnable from anywhere.
  for (const k of ['output', 'render']) if (typeof args[k] === 'string') args[k] = resolve(args[k]);
  const plan = planTripoCli(args, tripoModelFor(), { smartLowPoly: SMART_LOW_POLY_VERDICT, isTripoTaskId });
  const { exitCode } = await executeTripoCli(plan, {
    runTripo, awaitTripoTask, buildCreateTaskBody, isRecoverableTripoFailure,
    fileSize: (p) => { try { return statSync(p).size; } catch { return undefined; } },
    downloadFile,
    ensureParentDir: (p) => mkdirSync(dirname(p), { recursive: true }),
    print: (line) => process.stdout.write(`${line}\n`),
  });
  process.exitCode = exitCode;
}
main();
