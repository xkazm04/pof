/**
 * scan-sweep night 2026-11-08 (module-evaluator): MODULE_CONTEXTS is a plain object
 * indexed by module id, and the deep-eval route forwards any non-empty string as a
 * module id. `isEvalPass` already reads its table by OWN property; the context lookups
 * did not — `hasModuleContext('toString')` was true and `buildEvalPrompt` for
 * `constructor` read Function members as its checks, sending "undefined" as the
 * pass's checklist. Every lookup must read own properties only.
 */
import { describe, it, expect } from 'vitest';
import {
  buildEvalPrompt,
  getEvaluableModuleIds,
  getPassesForModule,
  hasModuleContext,
  EVAL_PASSES,
  EVAL_PASS_VOCABULARY,
} from '@/lib/evaluator/module-eval-prompts';
import type { SubModuleId } from '@/types/modules';

const INHERITED = ['toString', 'constructor', 'hasOwnProperty', '__proto__', 'valueOf'];

function prompt(moduleId: string, pass: (typeof EVAL_PASS_VOCABULARY)[number]): string {
  return buildEvalPrompt({ moduleId: moduleId as SubModuleId, pass, projectName: 'P', moduleName: 'P', sourcePath: 'Source/P/' });
}

describe('module eval context lookup reads own properties only', () => {
  it('an inherited Object member is not a module context', () => {
    for (const id of INHERITED) expect(hasModuleContext(id as SubModuleId)).toBe(false);
  });

  it('an inherited member falls back to the generic checks, never "undefined"', () => {
    for (const id of INHERITED) {
      for (const pass of EVAL_PASS_VOCABULARY) expect(prompt(id, pass)).not.toContain('undefined');
      expect(getPassesForModule(id)).toEqual(EVAL_PASSES);
    }
  });

  it('every evaluable module still has its context and a complete prompt for each of its passes', () => {
    const ids = getEvaluableModuleIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(hasModuleContext(id)).toBe(true);
      const passes = getPassesForModule(id);
      expect(new Set(passes).size).toBe(passes.length);
      for (const pass of passes) expect(prompt(id, pass)).not.toContain('undefined');
    }
  });
});

describe('buildEvalPrompt project line', () => {
  it('an empty projectName reads the module-name fallback, never an empty quoted name', () => {
    const prompt = buildEvalPrompt({ moduleId: 'audio' as SubModuleId, pass: 'structure', projectName: '', moduleName: 'MyProject', sourcePath: 'Source/MyProject/' });
    expect(prompt).toContain('UE5 project "MyProject"');
    expect(prompt).not.toContain('UE5 project ""');
  });

  it('a real projectName still wins', () => {
    const prompt = buildEvalPrompt({ moduleId: 'audio' as SubModuleId, pass: 'structure', projectName: 'PoF', moduleName: 'MyProject', sourcePath: 'Source/MyProject/' });
    expect(prompt).toContain('UE5 project "PoF"');
  });
});
