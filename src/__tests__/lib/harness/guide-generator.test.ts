/**
 * The guide is the run's durable deliverable, so its verification line must use
 * the SAME three-way vocabulary the progress log uses (`formatVerificationSummary`
 * in verifier.ts): PASS / FAIL / UNVERIFIABLE. It used to collapse a gate that
 * could not be evaluated into "FAIL", so an advisory ue-visual / ue-tests gate
 * with no UE env was recorded as a failure of the area in the playbook.
 */
import { describe, it, expect } from 'vitest';
import { appendGuideStep, createEmptyGuide, renderGuideMarkdown } from '@/lib/harness/guide-generator';
import { formatVerificationSummary } from '@/lib/harness/verifier';
import type { GamePlan, ModuleArea, ProgressEntry, VerificationReport } from '@/lib/harness/types';
import type { ParsedAreaResult } from '@/lib/harness/executor';

function area(): ModuleArea {
  return {
    id: 'combat-melee', moduleId: 'arpg-combat' as never, label: 'Combat — Melee', description: 'd',
    checklistItemIds: ['acb-1'], featureNames: ['attack'], dependsOn: [], status: 'completed', features: [],
  };
}

function plan(): GamePlan {
  return {
    game: 'PoF', projectPath: 'C:/p', ueVersion: '5.8', areas: [area()], iteration: 1,
    totalFeatures: 1, passingFeatures: 1, createdAt: '', updatedAt: '',
  };
}

const result: ParsedAreaResult = {
  areaId: 'combat-melee', completed: true,
  features: [{ name: 'attack', status: 'pass', quality: 4, notes: '' }],
  filesCreated: [], filesModified: [], learnings: [], summary: 's',
};

const progress: ProgressEntry = {
  iteration: 1, timestamp: '', areaId: 'combat-melee', moduleId: 'arpg-combat' as never,
  action: 'execute', outcome: 'success', summary: '', durationMs: 1000, featuresChanged: [],
};

const report: VerificationReport = {
  iteration: 1, areaId: 'combat-melee', timestamp: '', allPassed: false, requiredFailures: 0,
  gates: [
    { gate: 'ue-compile', passed: true, output: '', durationMs: 1 },
    { gate: 'lint', passed: false, output: '', durationMs: 1 },
    { gate: 'ue-visual', passed: false, unverifiable: true, output: 'no env', durationMs: 0 },
  ],
};

describe('appendGuideStep — verification vocabulary', () => {
  it('records UNVERIFIABLE for a gate that could not run, never FAIL', () => {
    const guide = createEmptyGuide(plan());
    const step = appendGuideStep(guide, area(), result, report, progress);
    expect(step.verification).toBe('PASS ue-compile, FAIL lint, UNVERIFIABLE ue-visual');
    expect(renderGuideMarkdown(guide)).toContain('**Verification:** PASS ue-compile, FAIL lint, UNVERIFIABLE ue-visual');
  });

  it('uses exactly the verdict words the progress-log summary uses (one vocabulary, two renderers)', () => {
    const guide = createEmptyGuide(plan());
    const step = appendGuideStep(guide, area(), result, report, progress);
    const summaryWords = formatVerificationSummary(report)
      .split('\n').slice(1)
      .map((line) => line.trim().split(' ')[0]);
    const guideWords = step.verification.split(', ').map((s) => s.split(' ')[0]);
    expect(guideWords).toEqual(summaryWords);
  });
});
