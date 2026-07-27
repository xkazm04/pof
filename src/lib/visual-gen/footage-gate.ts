/**
 * Footage gate — Tier-0 quality gate on a VIDEO clip BEFORE it is used as markerless
 * mocap input (UE MetaHuman Animator) or motion reference. The mirror of input-gate:
 * that one judges a 2D concept before image→3D credits are spent; this one judges
 * footage before a solve is dispatched — the measured failure mode of AI-GENERATED
 * footage is extremity morphing (two feet fusing into one mass), which is
 * disqualifying for a body solve because foot contact drives root motion, while
 * blob hands are survivable (body trackers don't solve fingers).
 *
 * ffmpeg samples N frames evenly across the clip (injectable `sample` seam), the
 * frames go to the anim-critique vision seam in ONE call, and the reply parses
 * through the shared SCORE/DEFECTS/VERDICT protocol + pass/warn/fail scorecard.
 * A gate that cannot run reports why — never a silent pass.
 */
import type { VisionImage } from '@/lib/anim-critique/critique';
import { makeQwenVision } from '@/lib/anim-critique/qwen';
import { parseGateReply, scoreInputGate, type GateThresholds } from './input-gate';
import type { Scorecard } from './mesh-critique';

export type FootagePurpose = 'body' | 'body+face';

/** One-line SCORE/DEFECTS/VERDICT protocol shared with input-gate / pof_vlm_critique.py. */
export function buildFootageGatePrompt(purpose: FootagePurpose = 'body'): string {
  const faceCriteria =
    purpose === 'body+face'
      ? ' (6) the face is visible, well-lit and stable enough for facial landmark tracking across frames. '
      : ' ';
  return (
    'These images are frames sampled evenly, in order, from ONE video clip about to be used as ' +
    'markerless mocap (motion capture) footage for a BODY solve. Score how trackable the clip is: ' +
    '(1) EXTREMITY COHERENCE, especially the FEET — both feet must stay two distinct, separate shapes ' +
    'in every frame; feet that fuse or merge into one mass are DISQUALIFYING, because foot contact ' +
    'drives root motion. ' +
    '(2) limb/torso topology stays consistent frame to frame — no limbs appearing, vanishing, or morphing. ' +
    '(3) the full body stays in frame with a clean silhouette against the background. ' +
    '(4) the camera is static or near-static. ' +
    '(5) hands may degrade into blobs — note it as a defect but do NOT fail the clip for hands alone; ' +
    'body solvers do not solve fingers.' +
    faceCriteria +
    'Reply on ONE line EXACTLY as: ' +
    "SCORE=<0-10 integer>; DEFECTS=<comma-separated problems with frame numbers, or 'none'>; " +
    'VERDICT=<one short sentence on mocap suitability>.'
  );
}

/** Parse ffprobe's bare duration output (seconds). Pure; null on garbage/zero. */
export function parseFfprobeDuration(stdout: string): number | null {
  const n = Number.parseFloat(stdout.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** ffprobe args emitting the container duration as a bare number. Pure. */
export function buildFfprobeArgs(videoPath: string): string[] {
  return ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath];
}

/** ffmpeg args sampling `count` frames evenly across `durationSec` to a PNG pattern. Pure. */
export function buildFfmpegSampleArgs(
  videoPath: string,
  outPattern: string,
  count: number,
  durationSec: number,
): string[] {
  // fps = count/duration spreads the picks across the whole clip; -frames:v caps rounding drift.
  const fps = count / durationSec;
  return ['-i', videoPath, '-vf', `fps=${fps.toFixed(6)}`, '-frames:v', String(count), '-y', outPattern];
}

async function runCommand(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/** Default sampler: ffprobe the duration, ffmpeg-sample `count` PNGs to a temp dir, read them. */
export async function sampleFootageFrames(videoPath: string, count: number): Promise<VisionImage[]> {
  const [fs, os, path] = await Promise.all([
    import('node:fs/promises'),
    import('node:os'),
    import('node:path'),
  ]);
  const probe = await runCommand('ffprobe', buildFfprobeArgs(videoPath));
  const duration = probe.code === 0 ? parseFfprobeDuration(probe.stdout) : null;
  if (!duration) {
    throw new Error(`ffprobe could not read the clip duration: ${probe.stderr.trim() || probe.stdout.trim() || `exit ${probe.code}`}`);
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pof-footage-gate-'));
  try {
    const pattern = path.join(dir, 'frame_%02d.png');
    const run = await runCommand('ffmpeg', buildFfmpegSampleArgs(videoPath, pattern, count, duration));
    if (run.code !== 0) throw new Error(`ffmpeg frame sampling failed: ${run.stderr.trim().slice(-300)}`);
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.png')).sort();
    const frames: VisionImage[] = [];
    for (const f of files) {
      frames.push({ mime: 'image/png', base64: (await fs.readFile(path.join(dir, f))).toString('base64') });
    }
    return frames;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export type FootageGateCard = Scorecard & { ok: true; raw: string; frames: number };
export type FootageGateFailure = { ok: false; error: string; raw?: string; verdict?: undefined };

export interface FootageGateDeps {
  /** Vision seam (images, prompt) => reply text; defaults to DashScope Qwen-VL. */
  vision?: (images: VisionImage[], prompt: string) => Promise<string>;
  /** Frame sampler; defaults to the ffprobe+ffmpeg temp-dir sampler. */
  sample?: (videoPath: string, count: number) => Promise<VisionImage[]>;
  purpose?: FootagePurpose;
  /** Frames sent to the model. Default 8 — fast actions need denser sampling. */
  frameCount?: number;
  thresholds?: Partial<GateThresholds>;
}

/** Gate one clip. Any sampling/vision/parse failure is ok:false with the reason. */
export async function gateFootage(
  videoPath: string,
  deps: FootageGateDeps = {},
): Promise<FootageGateCard | FootageGateFailure> {
  const vision = deps.vision ?? makeQwenVision();
  const sample = deps.sample ?? sampleFootageFrames;
  let frames: VisionImage[];
  try {
    frames = await sample(videoPath, deps.frameCount ?? 8);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (frames.length === 0) return { ok: false, error: 'no frames could be sampled from the clip' };

  let raw: string;
  try {
    raw = await vision(frames, buildFootageGatePrompt(deps.purpose));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const reply = parseGateReply(raw);
  if (!reply.ok) return { ok: false, error: reply.error ?? 'unparseable vision reply', raw };
  return { ok: true, raw, frames: frames.length, ...scoreInputGate(reply, deps.thresholds) };
}
