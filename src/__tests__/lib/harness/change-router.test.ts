/**
 * Change-class router - which configured gates can return a verdict for a change.
 *
 * The router is advisory and pure. Its claims split three ways: `can` (no known
 * obstacle), `cannot` (a stated, repo-derived cause) and `unknown` (an input nobody
 * supplied). The tests pin each class to the repo fact it comes from, pin the
 * "never claim `cannot` without a cause" floor, and pin that it adds to - never
 * restates - `checkSuccessReachable`.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  classifyPath,
  classifyPaths,
  extractPathTokens,
  plannedChangeClasses,
  routeChange,
  visualSpecDiscoverable,
  formatChangeRoutingLines,
  VISUAL_SPEC_FILE,
  type RouterEnv,
} from '@/lib/harness/change-router';
import { checkSuccessReachable, WEBAPP_GATES } from '@/lib/harness/verifier';
import type { VerificationGate } from '@/lib/harness/types';

const UE_GATES: VerificationGate[] = [
  { name: 'ue-compile', type: 'ue-compile', required: true, command: '"Build.bat" PoFEditor Development Win64' },
  { name: 'ue-tests', type: 'ue-test', required: false, filter: 'Project' },
  { name: 'ue-visual', type: 'ue-visual', required: false },
];
const UE_ENV: RouterEnv = { hasUeEnv: true };
const NO_UE_ENV: RouterEnv = { hasUeEnv: false };

const answers = (r: ReturnType<typeof routeChange>) => Object.fromEntries(r.gates.map((g) => [g.gate, g.answer]));

describe('classifyPath - the path classes the repo already distinguishes', () => {
  it.each([
    ['Source/PoF/Combat/Damage.cpp', 'ue-source'],
    ['Source/PoF/Test/Combat/VSCombatDamageFormulaTest.cpp', 'ue-source'],
    ['PoF.uproject', 'ue-source'],
    ['Source/PoF/PoF.Build.cs', 'ue-source'],
    ['Content/Python/observation/launch.py', 'ue-content'],
    ['Content/Maps/VerticalSlice.umap', 'ue-content'],
    ['src/components/modules/core-engine/dzin-panels/EnemyBestiaryPanel.tsx', 'web-source'],
    ['src/lib/dzin/panel-definitions.ts', 'web-source'],
    ['src\\lib\\harness\\verifier.ts', 'web-source'],
    ['src/components/shared/ScalableSelector/', 'web-source'],
    ['src/__tests__/dzin/batch5-enemy-world-panels.test.tsx', 'web-test'],
    ['e2e/dzin-panels.spec.ts', 'web-test'],
    ['docs/catalog/L3-L4-RUNNER.md', 'docs'],
    ['.ai/applied.jsonl', 'docs'],
    ['.claude/fleet-memory.md', 'docs'],
    ['package.json', 'unknown'],
    ['public/logo.png', 'unknown'],
    ['', 'unknown'],
  ] as const)('%s -> %s', (p, cls) => {
    expect(classifyPath(p)).toBe(cls);
  });

  it('keeps UE directory names case-sensitive: src/ is the webapp, Source/ is C++', () => {
    expect(classifyPath('src/lib/x.ts')).toBe('web-source');
    expect(classifyPath('Source/lib/x.ts')).toBe('ue-source');
  });

  it('merges a change into its distinct classes and lets known classes outrank unknown', () => {
    expect(classifyPaths(['src/a.tsx', 'src/b.tsx', 'src/__tests__/a.test.tsx']).sort()).toEqual(['web-source', 'web-test']);
    expect(classifyPaths(['src/a.tsx', 'package.json'])).toEqual(['web-source']);
    expect(classifyPaths(['package.json', 'public/x.png'])).toEqual(['unknown']);
    expect(classifyPaths([])).toEqual([]);
  });
});

describe('routeChange - per gate', () => {
  it('a UE C++ change: compile, test and frame gates can judge it when the engine is configured', () => {
    const r = routeChange(['ue-source'], UE_GATES, UE_ENV);
    expect(answers(r)).toEqual({ 'ue-compile': 'can', 'ue-tests': 'can', 'ue-visual': 'can' });
    expect(r.anyGate).toBe('can');
  });

  it('UE content: UBT does not read assets, the test and frame gates do', () => {
    const r = routeChange(['ue-content'], UE_GATES, UE_ENV);
    expect(answers(r)).toEqual({ 'ue-compile': 'cannot', 'ue-tests': 'can', 'ue-visual': 'can' });
    expect(r.gates[0].reason).toContain('UE C++ through UnrealBuildTool');
    expect(r.anyGate).toBe('can');
  });

  it('with no UE env every UE gate cannot, naming the env, whatever the class', () => {
    const noCommand: VerificationGate[] = UE_GATES.map((g) => (g.type === 'ue-compile' ? { ...g, command: undefined } : g));
    const r = routeChange(['ue-source'], noCommand, NO_UE_ENV);
    expect(answers(r)).toEqual({ 'ue-compile': 'cannot', 'ue-tests': 'cannot', 'ue-visual': 'cannot' });
    expect(r.gates.every((g) => g.reason.includes('no UE environment'))).toBe(true);
    expect(r.anyGate).toBe('cannot');
    expect(r.reason).toContain('ue-compile:');
  });

  it('a webapp change: no UE gate reads it, even with the engine configured', () => {
    const r = routeChange(['web-source'], UE_GATES, UE_ENV);
    expect(answers(r)).toEqual({ 'ue-compile': 'cannot', 'ue-tests': 'cannot', 'ue-visual': 'cannot' });
    expect(r.anyGate).toBe('cannot');
    expect(r.uncovered).toEqual(['web-source']);
  });

  it('a UE change: no webapp command gate reads it', () => {
    const r = routeChange(['ue-source'], WEBAPP_GATES, { hasUeEnv: false, devServer: true, visualSpecDiscoverable: true });
    expect(answers(r)).toEqual({ build: 'cannot', lint: 'cannot', test: 'cannot', 'visual-check': 'cannot' });
  });

  it('webapp source: command gates can; the page-capture gate follows the environment', () => {
    const base = { hasUeEnv: false };
    expect(answers(routeChange(['web-source'], WEBAPP_GATES, { ...base, devServer: true, visualSpecDiscoverable: true })))
      .toEqual({ build: 'can', lint: 'can', test: 'can', 'visual-check': 'can' });
    expect(answers(routeChange(['web-source'], WEBAPP_GATES, base))['visual-check']).toBe('unknown');
    const down = routeChange(['web-source'], WEBAPP_GATES, { ...base, devServer: false, visualSpecDiscoverable: true });
    expect(down.gates.find((g) => g.gate === 'visual-check')).toMatchObject({ answer: 'cannot', reason: 'no dev server answers on :3000' });
    expect(down.anyGate).toBe('can'); // the command gates still judge it
  });

  it('a test-only change alters no rendered page: the page-capture gate cannot, the commands can', () => {
    const r = routeChange(['web-test'], WEBAPP_GATES, { hasUeEnv: false, devServer: true, visualSpecDiscoverable: true });
    expect(answers(r)).toEqual({ build: 'can', lint: 'can', test: 'can', 'visual-check': 'cannot' });
  });

  it('a docs-only change: judge-able by no gate type with a derivable scope', () => {
    const r = routeChange(['docs'], WEBAPP_GATES, { hasUeEnv: false, devServer: true, visualSpecDiscoverable: true });
    expect(r.anyGate).toBe('cannot');
    expect(r.uncovered).toEqual(['docs']);
    expect(r.gates.every((g) => g.answer === 'cannot')).toBe(true);
  });

  it('an opaque command gate stays unknown for any class: its scope is not derivable', () => {
    const custom: VerificationGate = { name: 'smoke', type: 'custom', required: false, command: 'node smoke.js' };
    expect(routeChange(['docs'], [custom], NO_UE_ENV).gates[0].answer).toBe('unknown');
    expect(routeChange(['ue-source'], [custom], NO_UE_ENV).anyGate).toBe('unknown');
  });

  it('a commandless gate cannot return a verdict, whatever the class (same fact as gateCannotVerify)', () => {
    const noCmd: VerificationGate = { name: 'tc', type: 'typecheck', required: true };
    const r = routeChange(['web-source'], [noCmd], NO_UE_ENV);
    expect(r.gates[0]).toMatchObject({ answer: 'cannot', reason: 'no command configured, so nothing would run' });
  });

  it('no path evidence: no claim from the change class, only from preconditions', () => {
    const r = routeChange([], WEBAPP_GATES, { hasUeEnv: false, devServer: true, visualSpecDiscoverable: false });
    expect(answers(r)).toEqual({ build: 'unknown', lint: 'unknown', test: 'unknown', 'visual-check': 'cannot' });
    expect(r.anyGate).toBe('unknown');
    expect(r.classes).toEqual(['unknown']);
  });

  it('a mixed change is judged by the best answer per gate, and names the class nothing reads', () => {
    const r = routeChange(['web-source', 'docs'], WEBAPP_GATES, { hasUeEnv: false, devServer: true, visualSpecDiscoverable: true });
    expect(r.anyGate).toBe('can');
    expect(r.uncovered).toEqual(['docs']);
    expect(r.gates.find((g) => g.gate === 'build')?.judges).toEqual(['web-source']);
  });

  it('an empty gate set judges nothing', () => {
    expect(routeChange(['web-source'], [], UE_ENV)).toMatchObject({ anyGate: 'cannot', reason: 'no gate is configured' });
  });

  it('every gate answer carries a reason', () => {
    for (const cls of ['ue-source', 'ue-content', 'web-source', 'web-test', 'docs', 'unknown'] as const) {
      for (const env of [UE_ENV, NO_UE_ENV, { hasUeEnv: false, devServer: false }]) {
        for (const g of routeChange([cls], [...UE_GATES, ...WEBAPP_GATES], env).gates) expect(g.reason.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('visualSpecDiscoverable - the Playwright testDir fact', () => {
  const cfg = "export default defineConfig({\n  testDir: './e2e',\n  workers: 1,\n});";

  it('a spec under the harness statePath is outside ./e2e, so Playwright reports "No tests found"', () => {
    expect(visualSpecDiscoverable(cfg, 'C:/Users/dev/pof', 'C:\\Users\\dev\\pof\\.harness-content')).toBe(false);
    expect(visualSpecDiscoverable(cfg, '/repo/pof', '.harness')).toBe(false);
  });

  it('a statePath inside testDir is discoverable', () => {
    expect(visualSpecDiscoverable(cfg, '/repo/pof', '/repo/pof/e2e/.harness')).toBe(true);
    expect(visualSpecDiscoverable(cfg, '/repo/pof', 'e2e')).toBe(true);
  });

  it('makes no claim when the config is absent or testDir is not a string literal', () => {
    expect(visualSpecDiscoverable(null, '/repo/pof', '.harness')).toBeUndefined();
    expect(visualSpecDiscoverable('export default { testDir: path.join(__dirname, "e2e") }', '/repo/pof', '.harness')).toBeUndefined();
    expect(visualSpecDiscoverable('export default {}', '/repo/pof', '.harness')).toBeUndefined();
  });

  it('names the same file the visual gate writes', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/harness/visual-gate.ts'), 'utf-8');
    expect(src).toContain(`'${VISUAL_SPEC_FILE}'`);
  });
});

describe('plan text -> planned change classes', () => {
  it('reads path tokens from an area description', () => {
    const tokens = extractPathTokens(
      'Create src/components/shared/ScalableSelector.tsx and register in src/lib/dzin/panel-definitions.ts. Use Next.js. See README.md.',
    );
    expect(tokens).toEqual(expect.arrayContaining(['src/components/shared/ScalableSelector.tsx', 'src/lib/dzin/panel-definitions.ts']));
    expect(tokens.join(' ')).not.toContain('Next.js');
    expect(tokens.join(' ')).not.toContain('README.md');
  });

  it('classifies an area from its text, never a docs class (a doc is as often read as changed)', () => {
    expect(plannedChangeClasses({ description: 'Add Source/PoF/Combat/Damage.cpp and Damage.h' })).toEqual(['ue-source']);
    expect(plannedChangeClasses({ description: 'Follow the pattern in docs/features/spec.md. Edit src/lib/x.ts' })).toEqual(['web-source']);
    expect(plannedChangeClasses({ description: 'Restructure the tabs for logical flow' })).toEqual([]);
  });
});

describe('formatChangeRoutingLines - the advisory preflight', () => {
  const webArea = { id: 'ui-a', description: 'Edit src/components/modules/x/View.tsx', status: 'pending' };
  const ueArea = { id: 'ue-a', description: 'Edit Source/PoF/Combat/Damage.cpp', status: 'pending' };
  const vagueArea = { id: 'vague', description: 'Polish the flow', status: 'pending' };
  const DEV_DOWN: RouterEnv = { hasUeEnv: false, devServer: false, visualSpecDiscoverable: true };

  it('names the page-capture gate when no dev server answers - a gate checkSuccessReachable skips by design', () => {
    expect(checkSuccessReachable(WEBAPP_GATES, 'verified', { hasUeEnv: false }).reachable).toBe(true);
    const lines = formatChangeRoutingLines([webArea], WEBAPP_GATES, DEV_DOWN);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Change routing (advisory): visual-check (advisory) cannot return a verdict');
    expect(lines[0]).toContain('no dev server answers on :3000');
  });

  it('names the generated-spec-outside-testDir cause', () => {
    const lines = formatChangeRoutingLines([webArea], WEBAPP_GATES, { hasUeEnv: false, devServer: true, visualSpecDiscoverable: false });
    expect(lines.join('\n')).toContain('"No tests found"');
  });

  it('says "may return no verdict" for an unprobed input rather than claiming cannot', () => {
    const lines = formatChangeRoutingLines([webArea], WEBAPP_GATES, { hasUeEnv: false });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('visual-check (advisory) may return no verdict: dev server not probed');
    expect(lines[0]).not.toContain('cannot');
  });

  it('is silent when every gate can judge what the plan names', () => {
    expect(formatChangeRoutingLines([webArea], WEBAPP_GATES, { hasUeEnv: false, devServer: true, visualSpecDiscoverable: true })).toEqual([]);
  });

  it('does not restate a gate checkSuccessReachable already named', () => {
    const noEnvGates: VerificationGate[] = [{ name: 'ue-compile', type: 'ue-compile', required: true }];
    const reach = checkSuccessReachable(noEnvGates, 'verified', { hasUeEnv: false });
    expect(reach.blockingGates).toEqual(['ue-compile']);
    const lines = formatChangeRoutingLines([ueArea], noEnvGates, NO_UE_ENV, { exclude: reach.blockingGates });
    expect(lines.some((l) => l.includes('ue-compile (required) cannot'))).toBe(false);
    // ...but the area-level consequence is new information: no gate can judge this area.
    expect(lines.join('\n')).toContain('no configured gate can judge 1 planned area(s): ue-a (ue-source)');
  });

  it('names a required gate that is configured and reachable but reads nothing the plan changes', () => {
    // checkSuccessReachable: reachable (the compile gate has a command). Router: it cannot judge a webapp plan.
    expect(checkSuccessReachable(UE_GATES, 'verified', { hasUeEnv: true }).reachable).toBe(true);
    const lines = formatChangeRoutingLines([webArea], UE_GATES, UE_ENV);
    expect(lines.join('\n')).toContain('ue-compile (required) cannot return a verdict for any planned change (web-source)');
    expect(lines.join('\n')).toContain('no configured gate can judge 1 planned area(s): ui-a (web-source)');
  });

  it('lists uncovered areas, caps the list, and counts the areas that name no path', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `w${i}`, description: `Edit src/a/b${i}.tsx`, status: 'pending' }));
    const lines = formatChangeRoutingLines([...many, vagueArea], UE_GATES, UE_ENV);
    const areaLine = lines.find((l) => l.includes('planned area(s)')) ?? '';
    expect(areaLine).toContain('no configured gate can judge 7 planned area(s)');
    expect(areaLine).toContain('; +2 more');
    expect(lines[lines.length - 1]).toContain('1 of 8 open area(s) name no changed path');
  });

  it('ignores completed areas and an empty gate set', () => {
    expect(formatChangeRoutingLines([{ ...webArea, status: 'completed' }], UE_GATES, UE_ENV)).toEqual([]);
    expect(formatChangeRoutingLines([webArea], [], UE_ENV)).toEqual([]);
  });

  it('makes no area-level claim for an area whose text names no path', () => {
    const lines = formatChangeRoutingLines([vagueArea], WEBAPP_GATES, DEV_DOWN);
    expect(lines.join('\n')).not.toContain('planned area(s)');
    // the class-independent precondition (no dev server) still holds for the gate as a whole
    expect(lines.join('\n')).toContain('visual-check (advisory) cannot return a verdict for any change');
  });
});
