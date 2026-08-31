/**
 * LIVE smoke for the render gate — the whole chain through its real seams.
 *
 * `mesh-views.ts` → `view-critique.ts` → `kit-coherence.ts` all shipped green and
 * UNREACHABLE: no production file imported any of them, so no test could have told a
 * working gate from a gate nothing calls. That is exactly the failure this file exists to
 * make impossible to repeat — it drives `startViewGateJob` through the DEFAULT deps
 * (headless Blender, then one real Qwen-VL call per view) and asserts a verdict came back.
 *
 * Skipped unless BOTH `POF_BLENDER` and a vision key are set, so `npm run validate` is
 * unaffected; the 18 unit tests beside it cover every decision with injected seams.
 *
 *   POF_BLENDER="C:/Program Files/Blender Foundation/Blender 4.2/blender.exe" \
 *     npx vitest run src/__tests__/lib/visual-gen/view-gate-job-store.live.test.ts
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { startViewGateJob, getViewGateJob } from '@/lib/visual-gen/view-gate-job-store';

const MESH = join(process.cwd(), 'generated', 'triposr', 'chair.glb').replace(/\\/g, '/');
const ready =
  Boolean(process.env.POF_BLENDER) &&
  Boolean(process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY) &&
  existsSync(MESH);
const live = ready ? describe : describe.skip;

live('view-gate live smoke (POF_BLENDER + vision key set)', () => {
  it('renders a real mesh, judges every view, and reaches a verdict', async () => {
    const id = startViewGateJob({
      members: [{ meshPath: MESH, name: 'chair', subject: 'a wooden chair' }],
      views: 3,
      resolution: 384,
    });

    const deadline = Date.now() + 480_000;
    let job = getViewGateJob(id)!;
    while (job.status === 'running' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2_000));
      job = getViewGateJob(id)!;
    }

    // Name what went wrong in the assertion itself — a bare `false` sends the reader
    // back to the shell to find out whether it was Blender, the key or the parse.
    expect(job.status, job.error ?? job.members[0]?.error ?? 'still running').toBe('done');
    expect(job.members[0].render?.views ?? []).toHaveLength(3);
    for (const v of job.members[0].render?.views ?? []) {
      expect(existsSync(v.imagePath), `view ${v.index} PNG missing at ${v.imagePath}`).toBe(true);
    }
    // The verdict itself is not asserted — chair.glb is a known-bad mesh whose severity
    // depends on the model of the day. What is asserted is that the gate LOOKED: it
    // produced a judged verdict rather than the `unmeasured` it returns when it could not.
    expect(['pass', 'warn', 'fail']).toContain(job.verdict);
  }, 600_000);
});
