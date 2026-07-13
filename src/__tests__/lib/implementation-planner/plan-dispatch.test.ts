import { describe, it, expect } from 'vitest';
import { planItemToTask } from '@/lib/implementation-planner/plan-dispatch';
import type { PlanItem } from '@/lib/implementation-planner/plan-generator';
import { buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.7.2' };
const ORIGIN = 'http://localhost:3000';

function makeItem(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    key: 'arpg-combat::Hit detection',
    moduleId: 'arpg-combat',
    featureName: 'Hit detection',
    category: 'Combat',
    description: 'Detect melee overlaps and apply damage once per swing.',
    depth: 0,
    impact: { directUnblocks: 2, transitiveUnblocks: 3, score: 5, directDependents: [] },
    effort: { level: 'medium', minutes: 90, reason: 'new system' },
    dependsOn: ['arpg-character::Character foundation'],
    isReady: true,
    status: 'missing',
    ...overrides,
  };
}

describe('planItemToTask (Direction: planner-dispatch-bridge)', () => {
  it('maps a PlanItem onto a feature-fix CLITask carrying module + feature + task type', () => {
    const task = planItemToTask(makeItem(), ORIGIN);
    expect(task.type).toBe('feature-fix');
    expect(task.moduleId).toBe('arpg-combat');
    expect(task.featureName).toBe('Hit detection');
    expect(task.status).toBe('missing');
    expect(task.appOrigin).toBe(ORIGIN);
    expect(task.qualityScore).toBeNull();
  });

  it('carries the item description + dependency note into the task', () => {
    const task = planItemToTask(makeItem(), ORIGIN);
    expect(task.nextSteps).toContain('Detect melee overlaps');
    // dependency note lists the already-implemented dep.
    expect(task.nextSteps).toContain('arpg-character / Character foundation');
  });

  it('omits the dependency note when the item has no dependencies', () => {
    const task = planItemToTask(makeItem({ dependsOn: [] }), ORIGIN);
    expect(task.nextSteps).not.toContain('Dependencies (already implemented');
  });

  it('produces a dispatchable prompt through the standard buildTaskPrompt path', () => {
    const task = planItemToTask(makeItem(), ORIGIN);
    const prompt = buildTaskPrompt(task, CTX);
    // feature-fix handler renders the improve-task shell + the project context header.
    expect(prompt).toContain('Improve "Hit detection"');
    expect(prompt).toContain('## Project Context');
  });
});
