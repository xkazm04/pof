/**
 * Zone analysis (ECW Phase 10-F — zone-map deepening). Pure connectivity +
 * level-progression lint over a world zone (the zone-map catalog entity's `data`
 * is a ZoneRecord). Catches inverted level ranges, dangling/dead-end connections,
 * difficulty spikes between connected zones, and unreachable zones. Pure.
 */

export interface ZoneLike {
  id: string;
  displayName: string;
  type: string; // 'hub' | 'combat' | 'boss'
  status: string;
  levelMin: number;
  levelMax: number;
  connections: string[];
}

export interface ZoneFinding {
  severity: 'ok' | 'warn' | 'error';
  rule: string;
  message: string;
}

/** A connected zone more than this many levels above ours reads as a spike. */
const LEVEL_JUMP_THRESHOLD = 3;

/** Narrow arbitrary catalog entity `data` to a zone, or null. */
export function asZone(data: unknown): ZoneLike | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.levelMin !== 'number' || typeof d.levelMax !== 'number' || !Array.isArray(d.connections)) return null;
  return {
    id: typeof d.id === 'string' ? d.id : '',
    displayName: typeof d.displayName === 'string' ? d.displayName : (typeof d.name === 'string' ? d.name : ''),
    type: typeof d.type === 'string' ? d.type : 'combat',
    status: typeof d.status === 'string' ? d.status : 'active',
    levelMin: d.levelMin,
    levelMax: d.levelMax,
    // Validate elements, don't just cast: `data` is arbitrary persisted/AI-authored JSON.
    // A non-string entry (number/null/object) would never match a zone id and would be
    // mis-reported as a dangling connection — or poison the reverse-reachability check.
    connections: d.connections.filter((c): c is string => typeof c === 'string'),
  };
}

export function lintZone(zone: ZoneLike, roster: ZoneLike[]): ZoneFinding[] {
  const findings: ZoneFinding[] = [];
  const byId = new Map(roster.map((z) => [z.id, z]));

  if (zone.levelMin > zone.levelMax) {
    findings.push({
      severity: 'error',
      rule: 'level-range',
      message: `Level range is inverted (min ${zone.levelMin} > max ${zone.levelMax}).`,
    });
  }

  for (const targetId of zone.connections) {
    const target = byId.get(targetId);
    if (!target) {
      findings.push({ severity: 'error', rule: 'dangling-connection', message: `Connects to unknown zone '${targetId}'.` });
      continue;
    }
    const gap = target.levelMin - zone.levelMax;
    if (gap > LEVEL_JUMP_THRESHOLD) {
      findings.push({
        severity: 'warn',
        rule: 'level-spike',
        message: `Connects to ${target.displayName} which is ${gap} levels higher — difficulty spike.`,
      });
    }
  }

  if (zone.connections.length === 0 && zone.type !== 'boss') {
    findings.push({
      severity: 'warn',
      rule: 'dead-end',
      message: 'Dead-end zone (no outgoing connections) and not a boss arena.',
    });
  }

  if (roster.length >= 2 && zone.type !== 'hub') {
    const reachable = roster.some((z) => z.id !== zone.id && z.connections.includes(zone.id));
    if (!reachable) {
      findings.push({
        severity: 'warn',
        rule: 'unreachable',
        message: 'No zone leads here — unreachable except by fast-travel.',
      });
    }
  }

  if (findings.length === 0) {
    findings.push({ severity: 'ok', rule: 'zone', message: 'Zone connectivity and level flow look sound.' });
  }
  return findings;
}
