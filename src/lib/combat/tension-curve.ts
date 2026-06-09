import { safeDivide } from '@/lib/math-utils';

/**
 * Dramatic tension model for combat encounters.
 *
 * Extends the choreography sim's 2s damage-bucket analysis into a continuous
 * emotional-pacing curve: intensity (combat flux) blended with threat (player
 * jeopardy) into a single 0–1 arc, then mined for narrative "beats" — climax,
 * near-death spikes, comebacks, breathers — plus pacing defects (dead zones,
 * anticlimactic finishes, flat pacing) so a fight can be sculpted like a story.
 *
 * Pure + deterministic (no wall-clock / RNG): same input → same curve.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface TensionDamageEvent {
  timeSec: number;
  /** 'Player' = dealt by the player, anything else = an enemy */
  source: string;
  /** 'Player' = landed on the player */
  target: string;
  damage: number;
  isCrit: boolean;
}

export interface ComputeTensionInput {
  damageEvents: TensionDamageEvent[];
  totalDurationSec: number;
  /** Effective player max HP (after health multiplier) */
  playerMaxHp: number;
  playerDied: boolean;
  /** Curve sample resolution, default 0.5s */
  sampleStepSec?: number;
  /** Sliding window for the intensity flux, default 2s (matches alert buckets) */
  windowSec?: number;
}

export interface TensionSample {
  timeSec: number;
  /** 0–1 smoothed dramatic tension */
  tension: number;
  /** 0–1 combat activity (normalized damage flux) */
  intensity: number;
  /** 0–1 player jeopardy (1 − hp/maxHp) */
  threat: number;
  /** reconstructed player HP fraction, 0–1 */
  hpFrac: number;
}

export type DramaticBeatType =
  | 'climax'
  | 'near-death'
  | 'comeback'
  | 'breather'
  | 'dead-zone'
  | 'anticlimax'
  | 'flat-pacing';

/** Whether a beat is a high point, a release, or a pacing problem */
export type BeatTone = 'peak' | 'valley' | 'issue';

export interface DramaticBeat {
  type: DramaticBeatType;
  timeSec: number;
  /** For ranged beats (dead-zone / flat-pacing) */
  endTimeSec?: number;
  label: string;
  /** Designer-facing read of the moment */
  detail: string;
  tone: BeatTone;
}

export interface TensionCurve {
  samples: TensionSample[];
  beats: DramaticBeat[];
  peakTension: number;
  climaxTimeSec: number;
  /** Spread of tension across the fight (low = flat) */
  dynamicRange: number;
  /** One-line read of the dramatic arc */
  summary: string;
}

const BEAT_LABELS: Record<DramaticBeatType, string> = {
  climax: 'Climax',
  'near-death': 'Near-death',
  comeback: 'Comeback',
  breather: 'Breather',
  'dead-zone': 'Dead zone',
  anticlimax: 'Anticlimax',
  'flat-pacing': 'Flat pacing',
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

// ── Model ────────────────────────────────────────────────────────────────────

export function computeTensionCurve(input: ComputeTensionInput): TensionCurve {
  const step = input.sampleStepSec ?? 0.5;
  const half = (input.windowSec ?? 2) / 2;
  const duration = Math.max(input.totalDurationSec, step);
  const maxHp = input.playerMaxHp > 0 ? input.playerMaxHp : 1;
  const events = input.damageEvents;
  const enemyHits = events.filter((e) => e.target === 'Player').sort((a, b) => a.timeSec - b.timeSec);

  const count = Math.max(1, Math.floor(duration / step) + 1);
  const raw: { timeSec: number; flux: number; hpFrac: number; threat: number }[] = [];
  let maxFlux = 0;
  for (let i = 0; i < count; i++) {
    const t = i * step;
    let flux = 0;
    for (const e of events) {
      if (Math.abs(e.timeSec - t) <= half) flux += e.damage * (e.isCrit ? 1.35 : 1);
    }
    let taken = 0;
    for (const e of enemyHits) { if (e.timeSec <= t) taken += e.damage; else break; }
    const hpFrac = clamp01(safeDivide(maxHp - taken, maxHp, 1));
    raw.push({ timeSec: r3(t), flux, hpFrac, threat: 1 - hpFrac });
    if (flux > maxFlux) maxFlux = flux;
  }

  const blended = raw.map((r) => {
    const intensity = clamp01(safeDivide(r.flux, maxFlux, 0));
    let tension = clamp01(0.45 * intensity + 0.55 * r.threat);
    if (r.hpFrac < 0.25) tension = clamp01(tension + 0.18); // near-death emphasis
    return { ...r, intensity, tension };
  });

  // Smooth tension with a radius-1 moving average for a continuous arc.
  const samples: TensionSample[] = blended.map((b, i) => {
    const a = blended[i - 1]?.tension ?? b.tension;
    const c = blended[i + 1]?.tension ?? b.tension;
    return {
      timeSec: b.timeSec,
      tension: r3((a + b.tension + c) / 3),
      intensity: r3(b.intensity),
      threat: r3(b.threat),
      hpFrac: r3(b.hpFrac),
    };
  });

  const hasActivity = maxFlux > 0;
  let peakTension = 0;
  let climaxIdx = 0;
  samples.forEach((s, i) => { if (s.tension > peakTension) { peakTension = s.tension; climaxIdx = i; } });

  // Dynamic range over the interior (drop edge windows that catch fewer events).
  const interior = samples.length > 2 ? samples.slice(1, -1) : samples;
  const lo = interior.reduce((m, s) => Math.min(m, s.tension), 1);
  const hi = interior.reduce((m, s) => Math.max(m, s.tension), 0);
  const dynamicRange = r3(Math.max(0, hi - lo));

  const beats = hasActivity
    ? detectBeats(samples, blended, events, { duration, peakTension, climaxIdx, dynamicRange, playerDied: input.playerDied })
    : [];

  return { samples, beats, peakTension: r3(peakTension), climaxTimeSec: samples[climaxIdx]?.timeSec ?? 0, dynamicRange, summary: buildSummary(hasActivity, beats, peakTension, samples[climaxIdx]?.timeSec ?? 0) };
}

// ── Beat detection ─────────────────────────────────────────────────────────

function detectBeats(
  samples: TensionSample[],
  blended: { flux: number; hpFrac: number }[],
  events: TensionDamageEvent[],
  ctx: { duration: number; peakTension: number; climaxIdx: number; dynamicRange: number; playerDied: boolean },
): DramaticBeat[] {
  const beats: DramaticBeat[] = [];
  const beat = (type: DramaticBeatType, timeSec: number, detail: string, tone: BeatTone, endTimeSec?: number): DramaticBeat =>
    ({ type, timeSec, endTimeSec, label: BEAT_LABELS[type], detail, tone });

  if (ctx.peakTension >= 0.2) {
    beats.push(beat('climax', samples[ctx.climaxIdx].timeSec, `Peak tension ${Math.round(ctx.peakTension * 100)}%`, 'peak'));
  }

  // Near-death regions (hp < 25%) → one beat at each region's lowest point.
  forEachRegion(samples, (s) => s.hpFrac < 0.25, (start, end) => {
    let lowIdx = start;
    for (let i = start; i <= end; i++) if (samples[i].hpFrac < samples[lowIdx].hpFrac) lowIdx = i;
    beats.push(beat('near-death', samples[lowIdx].timeSec, `Player dropped to ${Math.round(samples[lowIdx].hpFrac * 100)}% HP`, 'peak'));
    // Comeback: survived the brush with death well before the end and kept fighting.
    if (!ctx.playerDied && samples[end].timeSec < ctx.duration * 0.8) {
      const recoverAt = samples[end].timeSec;
      if (events.some((e) => e.source === 'Player' && e.timeSec > recoverAt)) {
        beats.push(beat('comeback', recoverAt, 'Pulled through a near-death moment and fought on', 'peak'));
      }
    }
  });

  // Breathers: deep local-min valleys flanked by higher tension on both sides.
  const prefixMax: number[] = [];
  const suffixMax: number[] = [];
  samples.forEach((s, i) => { prefixMax[i] = Math.max(s.tension, prefixMax[i - 1] ?? 0); });
  for (let i = samples.length - 1; i >= 0; i--) suffixMax[i] = Math.max(samples[i].tension, suffixMax[i + 1] ?? 0);
  let lastBreather = -Infinity;
  for (let i = 2; i < samples.length - 2; i++) {
    const t = samples[i].tension;
    const isMin = t <= samples[i - 1].tension && t <= samples[i + 1].tension && t < samples[i - 2].tension && t < samples[i + 2].tension;
    if (!isMin) continue;
    if (prefixMax[i - 1] - t > 0.2 && suffixMax[i + 1] - t > 0.2 && samples[i].timeSec - lastBreather >= 3) {
      lastBreather = samples[i].timeSec;
      beats.push(beat('breather', samples[i].timeSec, 'A lull between intense moments', 'valley'));
    }
  }

  // Dead zones: interior gaps of ≥ window with zero combat flux.
  forEachRegion(samples, (_s, i) => blended[i].flux === 0, (start, end) => {
    const t0 = samples[start].timeSec;
    const t1 = samples[end].timeSec;
    if (t1 - t0 < 2) return;
    if (events.some((e) => e.timeSec < t0) && events.some((e) => e.timeSec > t1)) {
      beats.push(beat('dead-zone', t0, `No combat for ${(t1 - t0).toFixed(1)}s — pacing stalls`, 'issue', t1));
    }
  });

  // Anticlimax: real peak early, then the finish fades out.
  if (ctx.duration > 6 && ctx.peakTension >= 0.3 && ctx.climaxIdx < samples.length * 0.6) {
    const tailStart = Math.floor(samples.length * 0.85);
    const tail = samples.slice(tailStart);
    const tailAvg = tail.reduce((s, x) => s + x.tension, 0) / Math.max(1, tail.length);
    if (tailAvg < ctx.peakTension * 0.5) {
      beats.push(beat('anticlimax', samples[samples.length - 1].timeSec, 'Tension peaks early then fizzles before the end', 'issue'));
    }
  }

  // Flat pacing: tension never moves across the whole fight.
  if (ctx.duration > 5 && ctx.dynamicRange < 0.18) {
    beats.push(beat('flat-pacing', samples[0].timeSec, 'Tension never builds or releases — monotonous pacing', 'issue', samples[samples.length - 1].timeSec));
  }

  return beats.sort((a, b) => a.timeSec - b.timeSec || a.type.localeCompare(b.type));
}

/** Invoke `cb(startIdx, endIdx)` for each maximal contiguous run matching `pred`. */
function forEachRegion(
  samples: TensionSample[],
  pred: (s: TensionSample, i: number) => boolean,
  cb: (start: number, end: number) => void,
): void {
  let start = -1;
  for (let i = 0; i < samples.length; i++) {
    if (pred(samples[i], i)) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      cb(start, i - 1);
      start = -1;
    }
  }
  if (start !== -1) cb(start, samples.length - 1);
}

function buildSummary(hasActivity: boolean, beats: DramaticBeat[], peakTension: number, climaxTimeSec: number): string {
  if (!hasActivity) return 'No combat activity to pace.';
  const has = (t: DramaticBeatType) => beats.some((b) => b.type === t);
  if (has('flat-pacing')) return 'Flat pacing — the fight never builds or releases.';
  const parts = [`Builds to a ${Math.round(peakTension * 100)}% climax at ${climaxTimeSec}s`];
  if (has('near-death')) parts.push('with a near-death spike');
  if (has('comeback')) parts.push('and a comeback');
  if (has('breather')) parts.push('punctuated by a breather');
  if (has('dead-zone')) parts.push('— mind the dead zone');
  if (has('anticlimax')) parts.push('but the finish fizzles');
  return parts.join(' ') + '.';
}
