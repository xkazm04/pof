import { createRNG } from '@/lib/seeded-rng';
import { lintZone, type ZoneFinding, type ZoneLike } from './zone-analysis';

export type ZoneTopology = 'linear' | 'hub-and-spoke' | 'metroidvania';
export type DifficultyCurve = 'gentle' | 'linear' | 'steep';

export interface ZoneGraphParams {
  zoneCount: number;
  branchiness: number;
  topology: ZoneTopology;
  difficulty: DifficultyCurve;
  maxLevel: number;
  seed: number;
}

/** Minimal renderable + lintable zone (structurally a MapZone + level fields). */
export interface GeneratedZone {
  id: string;
  displayName: string;
  cx: number;
  cy: number;
  type: 'hub' | 'combat' | 'boss';
  status: 'active' | 'locked' | 'completed';
  connections: string[];
  levelMin: number;
  levelMax: number;
  levelRange: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function ease(t: number, curve: DifficultyCurve): number {
  if (curve === 'steep') return t * t;        // slow start, big late jumps
  if (curve === 'gentle') return Math.sqrt(t); // big early, flattens
  return t;                                     // linear
}

function role(i: number, n: number): GeneratedZone['type'] {
  if (i === 0) return 'hub';
  if (i === n - 1) return 'boss';
  return 'combat';
}

function layout(i: number, n: number, topology: ZoneTopology, rng: () => number): { cx: number; cy: number } {
  if (topology === 'hub-and-spoke') {
    if (i === 0) return { cx: 50, cy: 50 };
    const angle = (2 * Math.PI * (i - 1)) / (n - 1);
    return { cx: clamp(50 + 38 * Math.cos(angle), 6, 94), cy: clamp(50 + 38 * Math.sin(angle), 6, 94) };
  }
  if (topology === 'metroidvania') {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = ((col + 0.5) / cols) * 84 + 8 + (rng() - 0.5) * 8;
    const cy = ((row + 0.5) / rows) * 84 + 8 + (rng() - 0.5) * 8;
    return { cx: clamp(cx, 6, 94), cy: clamp(cy, 6, 94) };
  }
  // linear
  const cx = n > 1 ? 8 + (i * 84) / (n - 1) : 50;
  return { cx: clamp(cx, 6, 94), cy: clamp(50 + (rng() - 0.5) * 24, 6, 94) };
}

function connect(zones: GeneratedZone[], topology: ZoneTopology, branchiness: number, rng: () => number): void {
  const n = zones.length;
  if (topology === 'linear') {
    for (let i = 0; i < n - 1; i++) zones[i].connections = [zones[i + 1].id];
    return;
  }
  if (topology === 'hub-and-spoke') {
    zones[0].connections = zones.slice(1).map((z) => z.id);
    for (let i = 1; i < n; i++) if (zones[i].type !== 'boss') zones[i].connections = [zones[0].id];
    return;
  }
  // metroidvania: spanning chain + branchiness-scaled forward cross edges
  for (let i = 0; i < n - 1; i++) zones[i].connections = [zones[i + 1].id];
  const extra = Math.round(clamp(branchiness, 0, 1) * (n - 2));
  for (let k = 0; k < extra; k++) {
    const from = Math.floor(rng() * (n - 2));                 // 0..n-3
    const to = from + 2 + Math.floor(rng() * (n - from - 2)); // >= from+2
    if (to < n && !zones[from].connections.includes(zones[to].id)) {
      zones[from].connections.push(zones[to].id);
    }
  }
}

/** Deterministically generate a candidate zone graph. Pure (seeded RNG, no wall clock). */
export function generateZoneGraph(params: ZoneGraphParams): GeneratedZone[] {
  const n = clamp(Math.floor(params.zoneCount), 2, 14);
  const rng = createRNG(params.seed);
  const span = Math.max(1, params.maxLevel - 1);

  // Monotonic level bounds: bounds[i]..bounds[i+1] is zone i's window.
  const bounds: number[] = [];
  for (let i = 0; i <= n; i++) bounds.push(1 + Math.round(span * ease(Math.min(1, i / (n - 1)), params.difficulty)));

  const zones: GeneratedZone[] = [];
  for (let i = 0; i < n; i++) {
    const type = role(i, n);
    const { cx, cy } = layout(i, n, params.topology, rng);
    const levelMin = bounds[i];
    const levelMax = Math.max(bounds[i + 1], levelMin);
    zones.push({
      id: `g${i}`,
      displayName: type === 'hub' ? 'Hub' : type === 'boss' ? 'Boss Arena' : `Zone ${i}`,
      cx: Math.round(cx),
      cy: Math.round(cy),
      type,
      status: i === 0 ? 'active' : 'locked',
      connections: [],
      levelMin,
      levelMax,
      levelRange: levelMin === levelMax ? `${levelMin}` : `${levelMin}-${levelMax}`,
    });
  }
  connect(zones, params.topology, params.branchiness, rng);
  return zones;
}

export interface ZoneGraphValidation {
  perZone: { zoneId: string; findings: ZoneFinding[] }[];
  errors: number;
  warnings: number;
  ok: boolean;
}

/** Lint every generated zone through zone-analysis and aggregate. */
export function validateZoneGraph(zones: GeneratedZone[]): ZoneGraphValidation {
  const roster = zones as ZoneLike[];
  const perZone = zones.map((z) => ({ zoneId: z.id, findings: lintZone(z, roster) }));
  let errors = 0;
  let warnings = 0;
  for (const { findings } of perZone) {
    for (const f of findings) {
      if (f.severity === 'error') errors++;
      else if (f.severity === 'warn') warnings++;
    }
  }
  return { perZone, errors, warnings, ok: errors === 0 };
}
