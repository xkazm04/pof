import { describe, it, expect } from 'vitest';
import { computeTensionCurve, type TensionDamageEvent } from '@/lib/combat/tension-curve';

const ev = (timeSec: number, source: string, target: string, damage: number, isCrit = false): TensionDamageEvent =>
  ({ timeSec, source, target, damage, isCrit });

describe('computeTensionCurve', () => {
  it('returns a flat zero curve and no beats for an empty fight', () => {
    const c = computeTensionCurve({ damageEvents: [], totalDurationSec: 10, playerMaxHp: 1000, playerDied: false });
    expect(c.samples.length).toBeGreaterThan(0);
    expect(c.samples.every((s) => s.tension === 0)).toBe(true);
    expect(c.beats).toEqual([]);
    expect(c.peakTension).toBe(0);
    expect(c.summary).toMatch(/no combat/i);
  });

  it('keeps every tension/intensity/threat sample within 0–1', () => {
    const events = [
      ev(2, 'Brute', 'Player', 300), ev(4, 'Brute', 'Player', 300, true),
      ev(1, 'Player', 'Brute', 500), ev(3, 'Player', 'Brute', 500, true),
    ];
    const c = computeTensionCurve({ damageEvents: events, totalDurationSec: 8, playerMaxHp: 1000, playerDied: false });
    for (const s of c.samples) {
      for (const v of [s.tension, s.intensity, s.threat, s.hpFrac]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic — identical input yields an identical curve', () => {
    const events = [ev(2, 'Brute', 'Player', 200), ev(5, 'Player', 'Brute', 400, true)];
    const args = { damageEvents: events, totalDurationSec: 10, playerMaxHp: 1000, playerDied: false };
    expect(computeTensionCurve(args)).toEqual(computeTensionCurve(args));
  });

  it('detects a climax and a near-death spike when the player is nearly killed', () => {
    const events = [
      ev(2, 'Brute', 'Player', 100), ev(4, 'Brute', 'Player', 150),
      ev(6, 'Brute', 'Player', 200), ev(8, 'Brute', 'Player', 250),
      ev(10, 'Brute', 'Player', 250),
    ];
    const c = computeTensionCurve({ damageEvents: events, totalDurationSec: 11, playerMaxHp: 1000, playerDied: false });
    expect(c.beats.some((b) => b.type === 'climax')).toBe(true);
    expect(c.beats.some((b) => b.type === 'near-death')).toBe(true);
    expect(c.peakTension).toBeGreaterThan(0.5);
  });

  it('flags an interior dead zone with no combat activity', () => {
    const events = [
      ev(0, 'Player', 'Grunt', 100), ev(0.5, 'Player', 'Grunt', 100), ev(1, 'Grunt', 'Player', 40),
      ev(9, 'Player', 'Grunt', 100), ev(9.5, 'Player', 'Grunt', 100), ev(10, 'Grunt', 'Player', 40),
    ];
    const c = computeTensionCurve({ damageEvents: events, totalDurationSec: 10, playerMaxHp: 1000, playerDied: false });
    const dead = c.beats.find((b) => b.type === 'dead-zone');
    expect(dead).toBeDefined();
    expect(dead?.endTimeSec).toBeDefined();
    expect((dead!.endTimeSec! - dead!.timeSec)).toBeGreaterThanOrEqual(2);
  });

  it('flags flat pacing when tension never moves', () => {
    const events: TensionDamageEvent[] = [];
    for (let t = 0; t <= 20; t += 0.5) {
      events.push(ev(t, 'Player', 'Grunt', 50));
      events.push(ev(t, 'Grunt', 'Player', 2)); // trivial chip — threat stays ~0
    }
    const c = computeTensionCurve({ damageEvents: events, totalDurationSec: 20, playerMaxHp: 100000, playerDied: false });
    expect(c.beats.some((b) => b.type === 'flat-pacing')).toBe(true);
    expect(c.dynamicRange).toBeLessThan(0.18);
    expect(c.summary).toMatch(/flat pacing/i);
  });

  it('flags an anticlimactic finish when the peak lands early and the end fades', () => {
    const events: TensionDamageEvent[] = [];
    // Loud early exchange (high intensity, low threat)…
    for (const t of [1, 1.5, 2, 2.5, 3]) {
      events.push(ev(t, 'Player', 'Brute', 200, true));
      events.push(ev(t, 'Brute', 'Player', 5));
    }
    // …then a long sparse tail.
    for (let t = 6; t <= 20; t += 2) events.push(ev(t, 'Player', 'Grunt', 5));
    const c = computeTensionCurve({ damageEvents: events, totalDurationSec: 20, playerMaxHp: 1000, playerDied: false });
    expect(c.beats.some((b) => b.type === 'anticlimax')).toBe(true);
  });
});
