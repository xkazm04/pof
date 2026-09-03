/**
 * Defect: in `ai-behavior`, "Behavior Tree system" and "AI Perception setup"
 * were SIBLINGS — both depending only on "AI Controller base". A behaviour tree
 * could therefore be authored and marked complete with no perception wired, and
 * an agent that cannot sense cannot decide.
 *
 * The correct pattern already exists in the same file for `arpg-enemy-ai`:
 * `{ featureName: 'Behavior Tree', dependsOn: ['AARPGAIController', 'AI Perception'] }`.
 *
 * Standard: game-production ▸ systems-canon ▸ agent-behaviour-authoring ▸
 * perception-before-decision — "Perception is authored first because the
 * decision layer is a function of it."
 */
import { describe, it, expect } from 'vitest';
import {
  MODULE_FEATURE_DEFINITIONS,
  buildDependencyMap,
} from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

function featureOf(moduleId: SubModuleId, name: string) {
  return (MODULE_FEATURE_DEFINITIONS[moduleId] ?? []).find((f) => f.featureName === name);
}

describe('perception-before-decision — ai-behavior', () => {
  it('makes the Behavior Tree depend on AI Perception, not merely on the controller', () => {
    const bt = featureOf('ai-behavior', 'Behavior Tree system');
    expect(bt, 'Behavior Tree system is declared').toBeDefined();
    expect(bt!.dependsOn).toContain('AI Perception setup');
    expect(bt!.dependsOn).toContain('AI Controller base');
  });

  it('keeps perception itself rooted on the controller only', () => {
    const perc = featureOf('ai-behavior', 'AI Perception setup');
    expect(perc!.dependsOn).toEqual(['AI Controller base']);
  });

  it('matches the local precedent already set by arpg-enemy-ai', () => {
    const enemyBt = featureOf('arpg-enemy-ai', 'Behavior Tree');
    expect(enemyBt!.dependsOn).toContain('AI Perception');
  });
});

describe('dependency graph integrity', () => {
  it('has no cycles anywhere in the cross-module feature graph', () => {
    const map = buildDependencyMap();
    const WHITE = 0, GREY = 1, BLACK = 2;
    const color = new Map<string, number>();
    const cycles: string[] = [];

    const visit = (key: string, stack: string[]) => {
      const c = color.get(key) ?? WHITE;
      if (c === BLACK) return;
      if (c === GREY) {
        cycles.push([...stack.slice(stack.indexOf(key)), key].join(' → '));
        return;
      }
      color.set(key, GREY);
      for (const dep of map.get(key)?.deps ?? []) {
        // A dep pointing at a key with no row of its own is a dangling ref,
        // not a cycle — the wiring test owns that concern.
        if (map.has(dep.key)) visit(dep.key, [...stack, key]);
      }
      color.set(key, BLACK);
    };

    for (const key of map.keys()) visit(key, []);
    expect(cycles).toEqual([]);
  });

  it('resolves the ai-behavior perception edge to a real graph key', () => {
    const map = buildDependencyMap();
    const bt = map.get('ai-behavior::Behavior Tree system');
    expect(bt).toBeDefined();
    const keys = bt!.deps.map((d) => d.key);
    expect(keys).toContain('ai-behavior::AI Perception setup');
    // …and that key must itself exist in the graph (not a dangling name).
    expect(map.has('ai-behavior::AI Perception setup')).toBe(true);
  });
});
