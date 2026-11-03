/**
 * Where voice audio lives and how it is measured (server-only).
 * Files: `POF_VOICE_DIR`, else `voice/` beside the app database — so a test DB (`POF_DB_PATH`) keeps its
 * clips in its own temp folder and never writes `~/.pof`. Measurement uses ffprobe/ffmpeg; when they are
 * missing or fail the value is `null` (shown as "unmeasured"), never a fake number.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resolveDbPath } from '@/lib/db';
import { masterArgs, type VoiceMasterTarget } from '@/lib/voice/mastering';

type Env = Readonly<Record<string, string | undefined>>;

export function voiceDir(env: Env = process.env): string {
  return env.POF_VOICE_DIR || path.join(path.dirname(resolveDbPath(env)), 'voice');
}

/** Write bytes under the voice dir; returns the absolute path. */
export function writeVoiceFile(rel: string, bytes: Buffer, env: Env = process.env): string {
  const abs = path.join(voiceDir(env), rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, bytes);
  return abs;
}

/** True when `abs` sits inside the voice dir (the audio routes stream nothing else). */
export function isInVoiceDir(abs: string, env: Env = process.env): boolean {
  const rel = path.relative(voiceDir(env), path.resolve(abs));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function run(bin: string, args: string[]): Promise<{ stdout: string; stderr: string } | null> {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
      resolve(err ? null : { stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

export interface AudioMeasure { durationMs: number | null; loudnessLufs: number | null; maxSilenceMs: number | null }

export { SILENCE_FLAG_MS } from '@/lib/voice/types';

/**
 * The longest INTERNAL silence (ffmpeg `silencedetect`, -40 dB, >= 0.3 s) in ms, ignoring silence that
 * touches the start or the end of the clip. 0 when there is none. Exported for tests.
 */
export function maxInternalSilenceMs(stderr: string, durationSecs: number): number {
  let max = 0;
  let start: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const s = /silence_start: (-?[\d.]+)/.exec(line);
    if (s) { start = Number.parseFloat(s[1]); continue; }
    const e = /silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/.exec(line);
    if (e && start !== null) {
      const end = Number.parseFloat(e[1]);
      if (start > 0.05 && end < durationSecs - 0.05) max = Math.max(max, Math.round(Number.parseFloat(e[2]) * 1000));
      start = null;
    }
  }
  return max;
}

/** Duration (ffprobe), integrated loudness (ebur128) and longest internal silence, each null when unmeasurable. */
export async function measureAudio(abs: string): Promise<AudioMeasure> {
  const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', abs]);
  const secs = probe ? Number.parseFloat(probe.stdout.trim()) : Number.NaN;
  const loud = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', abs, '-af', 'ebur128', '-f', 'null', '-']);
  const m = loud ? /I:\s+(-?\d+(?:\.\d+)?) LUFS\s*\n\s*Threshold/.exec(loud.stderr) ?? /I:\s+(-?\d+(?:\.\d+)?) LUFS/.exec(loud.stderr) : null;
  const sil = Number.isFinite(secs) ? await run('ffmpeg', ['-hide_banner', '-nostats', '-i', abs, '-af', 'silencedetect=n=-40dB:d=0.3', '-f', 'null', '-']) : null;
  return {
    durationMs: Number.isFinite(secs) ? Math.round(secs * 1000) : null,
    loudnessLufs: m ? Number.parseFloat(m[1]) : null,
    maxSilenceMs: sil ? maxInternalSilenceMs(sil.stderr, secs) : null,
  };
}

/** mp3 → mastered mono Ogg Vorbis at the game's voice target (Godot plays Vorbis; ElevenLabs offers no
 *  ogg output). Resolves an error or null. */
export async function convertToOgg(src: string, dst: string, target: VoiceMasterTarget): Promise<string | null> {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const r = await run('ffmpeg', masterArgs(src, dst, target));
  return r ? null : `ffmpeg could not master ${path.basename(src)} to ogg`;
}
