/**
 * Harness — autonomous game development loop.
 *
 * Usage:
 *   import { createHarnessOrchestrator, createDefaultConfig } from '@/lib/harness';
 *
 *   const config = createDefaultConfig({
 *     projectPath: '/path/to/ue5/project',
 *     projectName: 'MyARPG',
 *     ueVersion: '5.5',
 *   });
 *
 *   const harness = createHarnessOrchestrator(config);
 *
 *   harness.on(event => console.log(event));
 *
 *   const guide = await harness.start();
 */

export { createHarnessOrchestrator, createDefaultConfig } from './orchestrator';
export type { HarnessOrchestrator, HarnessEventListener } from './orchestrator';
export { buildGamePlan, pickNextArea, updatePlanStats } from './plan-builder';
export { executeArea, parseAreaResult, readAgentsMd, appendAgentsMd } from './executor';
export type { ParsedAreaResult } from './executor';
export { verify, formatVerificationSummary, DEFAULT_GATES } from './verifier';
export {
  createEmptyGuide,
  appendGuideStep,
  loadGuide,
  saveGuide,
  renderGuideMarkdown,
} from './guide-generator';
export type {
  GamePlan,
  ModuleArea,
  PlannedFeature,
  ProgressEntry,
  VerificationGate,
  VerificationResult,
  VerificationReport,
  ExecutorConfig,
  ExecutorResult,
  GuideStep,
  GameBuildGuide,
  HarnessConfig,
  HarnessEvent,
  FeatureStatus,
  AreaStatus,
} from './types';
