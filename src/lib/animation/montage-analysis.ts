/**
 * Montage analysis (ECW Phase 10-F — state-graph deepening). Pure metrics + a
 * designer-facing lint over an animation montage (the state-graph catalog
 * entity's `data` is a MontageEntry). Turns frames/fps/memory into duration and
 * same-category memory outlier + root-motion + blend-in findings. Pure.
 */

export interface MontageLike {
  id: string;
  name: string;
  category: string;
  totalFrames: number;
  fps: number;
  memorySizeMB: number;
  hasRootMotion: boolean;
  blendInTime: number;
}

export interface MontageMetrics {
  durationSec: number;
  totalFrames: number;
  fps: number;
  memorySizeMB: number;
}

export interface MontageFinding {
  severity: 'ok' | 'warn' | 'error';
  rule: string;
  message: string;
}

const MIN_PEERS = 2;
const HIGH_MEM_FACTOR = 1.8;
const LONG_BLEND_SEC = 0.5;
/** Categories whose montages are expected to drive movement and so need root motion. */
const ROOT_MOTION_CATEGORIES = ['attack', 'locomotion', 'movement', 'traversal', 'dodge'];

export function montageMetrics(m: MontageLike): MontageMetrics {
  return {
    durationSec: m.fps > 0 ? m.totalFrames / m.fps : 0,
    totalFrames: m.totalFrames,
    fps: m.fps,
    memorySizeMB: m.memorySizeMB,
  };
}

/** Narrow arbitrary catalog entity `data` to a montage, or null. */
export function asMontage(data: unknown): MontageLike | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.totalFrames !== 'number' || typeof d.fps !== 'number' || typeof d.memorySizeMB !== 'number') return null;
  return {
    id: typeof d.id === 'string' ? d.id : '',
    name: typeof d.name === 'string' ? d.name : '',
    category: typeof d.category === 'string' ? d.category : '',
    totalFrames: d.totalFrames,
    fps: d.fps,
    memorySizeMB: d.memorySizeMB,
    hasRootMotion: d.hasRootMotion === true,
    blendInTime: typeof d.blendInTime === 'number' ? d.blendInTime : 0,
  };
}

export function lintMontage(montage: MontageLike, peers: MontageLike[]): MontageFinding[] {
  const findings: MontageFinding[] = [];

  const sameCategory = peers.filter((p) => p.id !== montage.id && p.category === montage.category);
  if (sameCategory.length >= MIN_PEERS) {
    const mem = sameCategory.map((p) => p.memorySizeMB).sort((a, b) => a - b);
    const median = mem[Math.floor(mem.length / 2)];
    if (median > 0 && montage.memorySizeMB > median * HIGH_MEM_FACTOR) {
      findings.push({
        severity: 'warn',
        rule: 'memory-outlier',
        message: `Memory (${montage.memorySizeMB} MB) is ${(montage.memorySizeMB / median).toFixed(1)}× the ${montage.category} median (${median} MB) — check compression/keyframe reduction.`,
      });
    }
  }

  if (!montage.hasRootMotion && ROOT_MOTION_CATEGORIES.includes(montage.category.toLowerCase())) {
    findings.push({
      severity: 'warn',
      rule: 'no-root-motion',
      message: `No root motion on a ${montage.category} montage — movement may rely on code, causing desync.`,
    });
  }

  if (montage.blendInTime > LONG_BLEND_SEC) {
    findings.push({
      severity: 'warn',
      rule: 'long-blend',
      message: `Blend-in is ${montage.blendInTime}s — long enough to feel unresponsive for action montages.`,
    });
  }

  if (findings.length === 0) {
    findings.push({ severity: 'ok', rule: 'montage', message: 'Montage budget and setup look sound for its category.' });
  }
  return findings;
}
