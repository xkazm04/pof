/**
 * Streaming preflight: what will not compile, what will hitch, one-click fixes.
 *
 * Before: the planner's Generate button checked only `zones.length > 0`.
 * Painting a second Town (the palette names every new zone after its type)
 * sent `EWorldZone { Town, ..., Town }` to the CLI - a duplicate enumerator
 * that only surfaced minutes later in UBT - and a seamless link into a zone
 * with preload radius 0 was a guaranteed streaming hitch nobody named.
 */
import { describe, it, expect } from 'vitest';
import {
  applyStreamingOp, initialStreamingPlan, toConfig,
  type StreamingOp, type StreamingPlanState, type StreamingZonePlannerConfig,
} from '@/lib/level-design/streaming-plan';
import {
  preflightStreamingPlan, residency, zoneEnumIdentifier, fixToOp,
} from '@/lib/level-design/streaming-preflight';
import { buildStreamingZonePrompt } from '@/lib/prompts/level-design';

const ids = (id: string) => ({ newId: () => id });
const base = (): StreamingPlanState => initialStreamingPlan();
const cfg = (s: StreamingPlanState): StreamingZonePlannerConfig => toConfig(s);
const op = (s: StreamingPlanState, o: StreamingOp, id = 'z-new') => applyStreamingOp(s, o, ids(id));
const rename = (s: StreamingPlanState, zoneId: string, name: string) => op(s, { type: 'updateZone', zoneId, patch: { name } });
const byRule = (c: StreamingZonePlannerConfig, rule: string) =>
  preflightStreamingPlan(c).findings.filter((f) => f.rule === rule);

describe('preflightStreamingPlan', () => {
  it('[guard] the default plan has no error findings and does not block Generate', () => {
    const pf = preflightStreamingPlan(cfg(base()));
    expect(pf.findings.filter((f) => f.severity === 'error')).toEqual([]);
    expect(pf.blocksGenerate).toBe(false);
  });

  it('a second painted Town is a duplicate EWorldZone enumerator and blocks Generate', () => {
    const s = op(base(), { type: 'paint', x: 0, y: 0, zoneType: 'town' }, 'z-t2');
    expect(s.zones.find((z) => z.id === 'z-t2')?.name).toBe('Town');
    const pf = preflightStreamingPlan(cfg(s));
    const dup = pf.findings.filter((f) => f.rule === 'duplicate-identifier');
    expect(dup).toHaveLength(1);
    expect(dup[0]).toMatchObject({ severity: 'error', status: 'fail', zoneIds: ['z-town', 'z-t2'], identifier: 'Town' });
    expect(pf.blocksGenerate).toBe(true);
    // Its fix renames the later zone to a unique identifier, and the block lifts.
    const fixed = applyStreamingOp(s, fixToOp(dup[0].fix!));
    expect(preflightStreamingPlan(cfg(fixed)).blocksGenerate).toBe(false);
  });

  it('a leading digit or an empty identifier is an invalid-identifier error', () => {
    const digit = byRule(cfg(rename(base(), 'z-cata', '1st Floor')), 'invalid-identifier');
    expect(digit).toHaveLength(1);
    expect(digit[0]).toMatchObject({ severity: 'error', zoneIds: ['z-cata'], identifier: '1stFloor' });
    const empty = byRule(cfg(rename(base(), 'z-cata', '!!!')), 'invalid-identifier');
    expect(empty).toHaveLength(1);
    expect(empty[0]).toMatchObject({ severity: 'error', zoneIds: ['z-cata'], identifier: '' });
    expect(preflightStreamingPlan(cfg(rename(base(), 'z-cata', '!!!'))).blocksGenerate).toBe(true);
  });

  it('an isolated zone is unreachable from the persistent zone; with no persistent zone reachability is not-evaluated, never a pass', () => {
    const s = op(base(), { type: 'paint', x: 0, y: 6, zoneType: 'dungeon' }, 'z-iso');
    const unreachable = byRule(cfg(s), 'unreachable');
    expect(unreachable).toHaveLength(1);
    expect(unreachable[0]).toMatchObject({ severity: 'error', status: 'fail', zoneIds: ['z-iso'] });

    const noPersistent = op(s, { type: 'updateZone', zoneId: 'z-town', patch: { alwaysLoaded: false } });
    const reach = byRule(cfg(noPersistent), 'unreachable');
    expect(reach).toHaveLength(1);
    expect(reach[0]).toMatchObject({ rule: 'unreachable', status: 'not-evaluated' });
    expect(reach[0].severity).not.toBe('error');
  });

  it('a seamless crossing into a zone not preloaded from its source is a hitch; the one-click fix removes it', () => {
    const s = op(base(), { type: 'updateZone', zoneId: 'z-forest', patch: { preloadRadius: 0 } });
    const hitch = byRule(cfg(s), 'seamless-hitch');
    const tr1 = hitch.filter((f) => f.transitionId === 'tr-1');
    expect(tr1).toHaveLength(1);
    expect(tr1[0]).toMatchObject({ severity: 'warning', zoneIds: ['z-town', 'z-forest'] });
    expect(tr1[0].fix).toEqual({ kind: 'updateZone', zoneId: 'z-forest', patch: { preloadRadius: 1 } });
    // A seamless boundary is crossed both ways: Old Ruins -> Dark Forest (tr-2 walked back) hitches too, same remedy.
    expect(hitch.filter((f) => f.transitionId === 'tr-2').map((f) => f.zoneIds)).toEqual([['z-ruins', 'z-forest']]);
    expect(preflightStreamingPlan(cfg(s)).blocksGenerate).toBe(false);

    const fixed = applyStreamingOp(s, fixToOp(tr1[0].fix!));
    expect(byRule(cfg(fixed), 'seamless-hitch')).toEqual([]);
  });

  it('a seamless link between non-adjacent zones is a non-adjacent warning; portal and loading-screen are not', () => {
    const withLink = (style: 'seamless' | 'portal' | 'loading-screen'): StreamingZonePlannerConfig => {
      const c = cfg(base());
      return { ...c, transitions: [...c.transitions, {
        id: 'tr-far', fromId: 'z-town', toId: 'z-boss', style, triggerType: 'proximity', condition: '',
      }] };
    };
    const far = preflightStreamingPlan(withLink('seamless')).findings.filter((f) => f.transitionId === 'tr-far');
    expect(far).toHaveLength(1);
    expect(far[0]).toMatchObject({ rule: 'non-adjacent', severity: 'warning', distance: 3 });
    expect(preflightStreamingPlan(withLink('portal')).findings.filter((f) => f.transitionId === 'tr-far')).toEqual([]);
    expect(preflightStreamingPlan(withLink('loading-screen')).findings.filter((f) => f.transitionId === 'tr-far')).toEqual([]);
  });
});

describe('residency', () => {
  it('the default plan: Town keeps 3 zones resident; Old Ruins keeps all 5 (streaming saves nothing there)', () => {
    const r = residency(cfg(base()));
    expect(r.byZone['z-town']).toEqual(['z-town', 'z-forest', 'z-cata']);
    expect(r.peak).toEqual({ zoneId: 'z-ruins', count: 5, of: 5 });
  });
});

describe('the prompt and the preflight share one identifier rule', () => {
  it('[guard] the default EWorldZone line reads Town, DarkForest, OldRuins, Catacombs, BossArena', () => {
    const c = cfg(base());
    expect(c.zones.map((z) => zoneEnumIdentifier(z.name)).join(', ')).toBe('Town, DarkForest, OldRuins, Catacombs, BossArena');
    const prompt = buildStreamingZonePrompt(c, { projectName: 'Did', projectPath: 'C:/UE/Did', ueVersion: '5.5' });
    expect(prompt).toContain('   - Values: Town, DarkForest, OldRuins, Catacombs, BossArena\n');
  });
});
