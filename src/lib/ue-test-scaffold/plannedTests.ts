/**
 * Planned-test listing + authoring-dispatch for the VS-test scaffolder.
 *
 * SOURCE OF TRUTH: the `pipeline_artifacts` rows still `status='deferred'` with a runtime-deferred
 * reason. `parseTestName` recovers the UE automation test name each row embedded
 * (`runtimeDeferred(testName,…)` → `live-UE runner not yet run: <testName>`). A deferred row is by
 * definition NOT proven registered in UE (if it had run it would have flipped pass/fail), so every
 * such row is a "planned — unmatched" test — exactly the set the drain matched 0 of.
 *
 * This is the app-side half of closing that gap: list the planned tests, generate a faithful C++
 * scaffold for one/all (pure `generate.ts`), and DISPATCH the authoring work through the existing
 * CLI task system (`TaskFactory.askClaude` → `buildTaskPrompt`) — the app never writes UE files
 * directly; the agent writes the scaffold into the UE tree and compiles.
 */
import { listDeferredArtifacts } from '@/lib/pipeline-artifacts-db';
import { parseTestName } from '@/lib/test-gate-runner/parse';
import type { DrainFilter } from '@/lib/test-gate-runner/drain';
import { TaskFactory, type CLITask } from '@/lib/cli-task';
import type { SubModuleId } from '@/types/modules';
import { generateScaffold, isScaffoldable, type ScaffoldResult } from './generate';

/** One planned-but-unmatched UE test recovered from a deferred pipeline artifact. */
export interface PlannedTest {
  catalogId: string;
  entityId: string;
  step: string;
  tier: string;
  /** The UE automation test name the drain will request. */
  testName: string;
  /** The full deferred reason (for context). */
  reason?: string;
  /** True when the generator can produce a faithful scaffold for this name. */
  scaffoldAvailable: boolean;
}

/**
 * List the planned-but-unmatched UE tests: deferred L3 artifacts carrying a recovered test name.
 * Optionally narrowed by the same {@link DrainFilter} the drain uses. Pure over the DB read.
 */
export function listPlannedTests(filter?: DrainFilter): PlannedTest[] {
  const rows = listDeferredArtifacts(filter);
  const out: PlannedTest[] = [];
  for (const a of rows) {
    const testName = parseTestName(a.reason);
    if (!testName) continue; // no recovered test name → not a runtime-deferred VS-test gate
    out.push({
      catalogId: a.catalogId,
      entityId: a.entityId,
      step: a.step,
      tier: a.tier ?? 'L3',
      testName,
      ...(a.reason ? { reason: a.reason } : {}),
      scaffoldAvailable: isScaffoldable(testName),
    });
  }
  return out;
}

/** A generated scaffold plus the planned-test rows that requested this name. */
export interface ScaffoldForName {
  testName: string;
  scaffold: ScaffoldResult;
  /** Every deferred artifact whose gate requests this test name. */
  requestedBy: Array<{ catalogId: string; entityId: string; step: string }>;
}

/** De-duplicate the planned tests by name and generate a scaffold for each. */
export function scaffoldAllPlanned(filter?: DrainFilter): ScaffoldForName[] {
  const byName = new Map<string, ScaffoldForName['requestedBy']>();
  for (const p of listPlannedTests(filter)) {
    if (!p.scaffoldAvailable) continue;
    const list = byName.get(p.testName) ?? [];
    list.push({ catalogId: p.catalogId, entityId: p.entityId, step: p.step });
    byName.set(p.testName, list);
  }
  return [...byName.entries()].map(([testName, requestedBy]) => ({
    testName,
    scaffold: generateScaffold(testName, claimFromRequesters(testName, requestedBy)),
    requestedBy,
  }));
}

/** A single scaffold for an explicit test name (+ optional claim override). */
export function scaffoldForTest(testName: string, claim?: string): ScaffoldResult {
  return generateScaffold(testName, claim);
}

function claimFromRequesters(
  testName: string,
  requestedBy: Array<{ catalogId: string; entityId: string; step: string }>,
): string {
  const first = requestedBy[0];
  return first
    ? `${testName} — planned L3 gate for ${first.catalogId}/${first.step}`
    : `${testName} — planned L3 gate`;
}

// ── Authoring dispatch (existing CLI task system) ───────────────────────────────────────────────

/**
 * Default module for the authoring task. There is no dedicated "test authoring" sub-module; a new
 * CLITaskType is unnecessary — `ask-claude` is the generic task path (its `buildTaskPrompt` handler
 * injects the project context header with UE paths + build commands, exactly what a write-and-
 * compile task needs, and adds no wiring/callback plumbing). `packaging` is the closest existing
 * module (UE build/packaging). See the direction note in the commit / L3-L4-RUNNER.md.
 */
export const SCAFFOLD_TASK_MODULE: SubModuleId = 'packaging';

/**
 * Build a CLI task instructing the agent to write the generated scaffold into the UE tree and
 * compile it. Uses `TaskFactory.askClaude` — the app never writes UE files; the task carries the
 * scaffold text + target path + acceptance so the agent authors it in the real tree. Pure.
 */
export function buildScaffoldTask(sf: ScaffoldForName): CLITask {
  const { scaffold, testName, requestedBy } = sf;
  const requesters = requestedBy.map((r) => `- ${r.catalogId}/${r.entityId}/${r.step}`).join('\n');
  const prompt = `Author the planned UE automation test \`${testName}\` so the L3 drain can run it.

A faithful C++ scaffold has been generated. Write it into the UE project, then complete the body so
it genuinely verifies the pipeline claim, then build the PoF module.

## Steps
1. Create \`${scaffold.suggestedPath}\` (add a matching \`.h\` only if you split the class out).
2. Paste the scaffold below and REPLACE the \`AddError\` guard with real assertions that prove the
   claim. Keep the registered name string EXACTLY as generated — \`Automation RunTests ${testName}\`
   must match it (the drain requests that name).
3. Keep the file ≤ 200 LOC. Map-free simple-automation runs headless (\`-nullrhi\`); only convert to
   an \`AARPGFunctionalTestBase\` map-placed test if the claim truly needs a live PIE map.
4. Build the PoF editor module and confirm the test enumerates:
   \`UnrealEditor-Cmd PoF.uproject -ExecCmds="Automation List;Quit" -unattended -nullrhi -log\`
   then run it: \`Automation RunTests ${testName};Quit\` and confirm \`Result={Success}\`.

## Requested by (deferred L3 gates that will flip once this test runs)
${requesters}

## Generated scaffold (${scaffold.suggestedPath})
\`\`\`cpp
${scaffold.code}\`\`\`
`;
  return TaskFactory.askClaude(SCAFFOLD_TASK_MODULE, prompt, `Scaffold ${testName}`);
}
