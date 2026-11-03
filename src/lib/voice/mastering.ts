/**
 * The level an exported voice line must sit at in the game (lane pof-voice, server-only).
 * The game declares it in `<gameRoot>/project/data/tables/audio_mix.json` (`loudness.voice_lufs`,
 * `loudness.voice_true_peak_db`), and its own processor (`tools/audio/process.py`) renders every voice file
 * mono, 44.1 kHz, `loudnorm=I=<lufs>:TP=<tp>:LRA=11`, Vorbis q4. Export masters the same way, so a take the
 * owner approved plays at the level the game's mix (voice bus, duck) was tuned for, whatever level the
 * provider rendered it at. A game without the table gets the processor's defaults and the report says so.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface VoiceMasterTarget {
  lufs: number;
  truePeakDb: number;
  /** Where the numbers came from, shown in the export report. */
  source: string;
}

export const MIX_TABLE = 'project/data/tables/audio_mix.json';
export const DEFAULT_VOICE_TARGET: VoiceMasterTarget = { lufs: -18, truePeakDb: -2, source: 'default (-18 LUFS / -2 dBTP, the game processor\'s voice target): the game has no audio_mix.json' };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The game's declared voice target, else the default (a broken or partial table also falls back, named). */
export function voiceMasterTarget(gameRoot: string): VoiceMasterTarget {
  const file = path.join(gameRoot, ...MIX_TABLE.split('/'));
  if (!fs.existsSync(file)) return DEFAULT_VOICE_TARGET;
  try {
    const mix = JSON.parse(fs.readFileSync(file, 'utf8')) as { loudness?: Record<string, unknown> };
    const lufs = num(mix.loudness?.voice_lufs);
    const truePeakDb = num(mix.loudness?.voice_true_peak_db);
    if (lufs === null || truePeakDb === null || lufs > 0 || truePeakDb > 0) {
      return { ...DEFAULT_VOICE_TARGET, source: `default: ${MIX_TABLE} has no usable loudness.voice_lufs / voice_true_peak_db` };
    }
    return { lufs, truePeakDb, source: MIX_TABLE };
  } catch {
    return { ...DEFAULT_VOICE_TARGET, source: `default: ${MIX_TABLE} is not valid JSON` };
  }
}

/** ffmpeg arguments that render `src` the way the game's processor renders a voice file. */
export function masterArgs(src: string, dst: string, t: VoiceMasterTarget): string[] {
  return [
    '-hide_banner', '-y', '-i', src, '-ac', '1', '-ar', '44100',
    '-af', `loudnorm=I=${t.lufs}:TP=${t.truePeakDb}:LRA=11`, '-c:a', 'libvorbis', '-q:a', '4', dst,
  ];
}

/** Within this many LU of the target the written file counts as on level (single-pass loudnorm drifts a little). */
export const MASTER_TOLERANCE_LU = 1.5;
