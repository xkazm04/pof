/**
 * The streaming plan is a pure named-op reducer in lib (`applyStreamingOp`).
 *
 * Before: the planner held its document in component-local useStates, encoded
 * one mode in three independent states (paintType / selectedZoneId /
 * linkingFrom) whose precedence was decided by if-order, implemented "change a
 * zone's type" twice with different name rules, and the prompt builder in lib
 * imported its input types from the component folder.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import {
  applyStreamingOp, initialStreamingPlan, toConfig,
  type StreamingOp, type StreamingPlanState,
} from '@/lib/level-design/streaming-plan';
import { buildStreamingZonePrompt } from '@/lib/prompts/level-design';

const ids = (id: string) => ({ newId: () => id });

function run(state: StreamingPlanState, ...ops: StreamingOp[]): StreamingPlanState {
  return ops.reduce((s, op) => applyStreamingOp(s, op, ids('tr-x')), state);
}

describe('applyStreamingOp — paint', () => {
  it('paints a new zone with defaults and selects it', () => {
    const s0 = initialStreamingPlan();
    const s = applyStreamingOp(s0, { type: 'paint', x: 0, y: 0, zoneType: 'forest' }, ids('z-a'));
    expect(s.zones).toContainEqual({
      id: 'z-a', gridX: 0, gridY: 0, type: 'forest', name: 'Forest',
      loadPriority: 'normal', alwaysLoaded: false, preloadRadius: 1,
    });
    expect(s.zones).toHaveLength(s0.zones.length + 1);
    expect(s.selectedZoneId).toBe('z-a');
  });

  it('one set-zone-type rule for palette and editor: a custom name is kept, a default-label name follows the type', () => {
    const s0 = initialStreamingPlan();
    // Palette path over z-forest ('Dark Forest' at (3,1)) keeps the designer's name.
    const kept = applyStreamingOp(s0, { type: 'paint', x: 3, y: 1, zoneType: 'ruins' }, ids('unused'));
    expect(kept.zones.find((z) => z.id === 'z-forest')).toMatchObject({ type: 'ruins', name: 'Dark Forest' });

    // A zone still named its type's default label is renamed to the new type's label.
    const painted = applyStreamingOp(s0, { type: 'paint', x: 0, y: 0, zoneType: 'forest' }, ids('z-a'));
    const renamed = applyStreamingOp(painted, { type: 'paint', x: 0, y: 0, zoneType: 'ruins' }, ids('unused'));
    expect(renamed.zones.find((z) => z.id === 'z-a')).toMatchObject({ type: 'ruins', name: 'Ruins' });

    // Editor path: the same rule, via setZoneType and via an updateZone patch carrying `type`.
    const viaSet = applyStreamingOp(painted, { type: 'setZoneType', zoneId: 'z-a', zoneType: 'ruins' }, ids('unused'));
    expect(viaSet.zones.find((z) => z.id === 'z-a')).toMatchObject({ type: 'ruins', name: 'Ruins' });
    const viaPatch = applyStreamingOp(s0, { type: 'updateZone', zoneId: 'z-forest', patch: { type: 'ruins' } }, ids('unused'));
    expect(viaPatch.zones.find((z) => z.id === 'z-forest')).toMatchObject({ type: 'ruins', name: 'Dark Forest' });
  });
});

describe('applyStreamingOp — erase', () => {
  it('erasing z-town removes it, its transitions tr-1/tr-3, and clears the selection', () => {
    const s0 = run(initialStreamingPlan(), { type: 'select', zoneId: 'z-town' });
    expect(s0.selectedZoneId).toBe('z-town');
    const s = applyStreamingOp(s0, { type: 'erase', x: 2, y: 2 }, ids('unused'));
    expect(s.zones.map((z) => z.id)).not.toContain('z-town');
    expect(s.transitions.map((t) => t.id)).toEqual(['tr-2', 'tr-4']);
    expect(s.selectedZoneId).toBeNull();
  });
});

describe('applyStreamingOp — one mode union', () => {
  it('startLink replaces paint; cellClick links, returns to select, and dedups either direction', () => {
    let s = run(initialStreamingPlan(), { type: 'setPaint', zoneType: 'forest' }, { type: 'startLink', from: 'z-town' });
    expect(s.mode).toEqual({ kind: 'link', from: 'z-town' });

    const before = s.transitions.length;
    s = run(s, { type: 'cellClick', x: 5, y: 2 });
    expect(s.transitions).toHaveLength(before + 1);
    expect(s.transitions[s.transitions.length - 1]).toMatchObject({
      fromId: 'z-town', toId: 'z-boss', style: 'seamless', triggerType: 'proximity',
    });
    expect(s.mode).toEqual({ kind: 'select' });

    const after = s.transitions.length;
    s = run(s, { type: 'startLink', from: 'z-boss' }, { type: 'cellClick', x: 2, y: 2 });
    expect(s.transitions).toHaveLength(after);
    expect(s.mode).toEqual({ kind: 'select' });
  });

  it('[guard] clicking the link source or an empty cell adds nothing and returns to select', () => {
    const s0 = initialStreamingPlan();
    const self = run(s0, { type: 'startLink', from: 'z-town' }, { type: 'cellClick', x: 2, y: 2 });
    expect(self.transitions).toEqual(s0.transitions);
    expect(self.mode).toEqual({ kind: 'select' });
    const empty = run(s0, { type: 'startLink', from: 'z-town' }, { type: 'cellClick', x: 0, y: 6 });
    expect(empty.transitions).toEqual(s0.transitions);
    expect(empty.mode).toEqual({ kind: 'select' });
  });
});

describe('buildStreamingZonePrompt reads the lib plan', () => {
  it('[guard] the default plan prompt is byte-identical to the pre-move output', () => {
    const prompt = buildStreamingZonePrompt(
      toConfig(initialStreamingPlan()),
      { projectName: 'Did', projectPath: 'C:/UE/Did', ueVersion: '5.5' },
    );
    expect(prompt).toHaveLength(15804);
    expect(createHash('sha256').update(prompt).digest('hex'))
      .toBe('7310cc59f0aa9c3f106d47a4690d448ea5077a056bdcf76a5d01d7752c31d372');
  });

  it('src/lib/prompts/level-design.ts takes its plan types from lib, never from components', () => {
    const src = readFileSync(path.resolve(process.cwd(), 'src/lib/prompts/level-design.ts'), 'utf8');
    expect(src).toMatch(/import type \{[^}]*StreamingZonePlannerConfig[^}]*\} from '@\/lib\/level-design\/streaming-plan'/);
    expect(src.match(/from '@\/components\//g) ?? []).toHaveLength(0);
  });
});
