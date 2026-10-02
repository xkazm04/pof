import { buildProjectContextHeader, getEnginePath, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import type { TestScenario, TestSuite } from '@/types/ai-testing';
import { moduleKnowledge } from '@/lib/prompts/module-knowledge';
import { buildBatchAutomationArgs } from '@/lib/test-gate-runner/batchAutomationArgs';
import { AI_TEST_ROOT, aiScenarioTestPath, aiScenarioTestPrefix, aiTestSlug } from '@/lib/ai-testing/test-identity';

/**
 * Prompt to generate a full UE5 Automation Framework test spec
 * for an entire test suite (all scenarios).
 */
export function buildGenerateTestsPrompt(
  suite: TestSuite,
  ctx: ProjectContext
): string {
  const header = buildProjectContextHeader(ctx, {
    ...moduleKnowledge('ai-behavior'),
    includeBuildCommand: true,
    includeRules: true,
  });

  const scenarioBlock = suite.scenarios
    .map((s, i) => {
      const stimuliLines = s.stimuli
        .map((st) => `    - [${st.type}] ${st.label}: ${st.description}`)
        .join('\n');
      const expectedLines = s.expectedActions
        .map((ea) => `    - Action: "${ea.action}" (BT node: ${ea.btNode || 'any'}, timeout: ${ea.timeoutSeconds}s)`)
        .join('\n');
      return `  ${i + 1}. "${s.name}" — ${s.description}\n    Test path: \`${aiScenarioTestPath(suite, s)}\`\n    Stimuli:\n${stimuliLines}\n    Expected:\n${expectedLines}`;
    })
    .join('\n\n');

  return `${header}

## Task: Generate AI Behavior Unit Tests

Generate a complete C++ test file using UE5's Automation Framework that unit-tests the behavior tree / AI controller class **${suite.targetClass}**.

### Test Suite: "${suite.name}"
${suite.description}

### Scenarios:
${scenarioBlock}

### Requirements:
1. Use \`IMPLEMENT_SIMPLE_AUTOMATION_TEST_PRIVATE\` or \`DEFINE_LATENT_AUTOMATION_COMMAND\` for each scenario
2. Create mock stimuli that simulate perception/damage events WITHOUT a running game world:
   - For sight perception: create mock \`FAIStimulus\` with location, strength, age
   - For hearing: use \`UAISense_Hearing::ReportNoiseEvent\` with mock source
   - For damage: call \`UGameplayStatics::ApplyDamage\` on a spawned test pawn
   - For gameplay tags: add/remove tags from the AI controller's tag container
3. After applying stimuli, tick the behavior tree and assert the expected task/node is active
4. Use \`TestEqual\`, \`TestTrue\`, \`TestNotNull\` for assertions
5. Register each scenario's test under EXACTLY the "Test path" listed with it (the pretty name passed to the automation macro) — the app runs and grades each scenario by the \`S<id>_\` prefix of that path, so a renamed or regrouped test is reported as missing
6. Include setup/teardown that creates a minimal test world with AI controller + pawn

Output a single .cpp file ready to be placed in \`Source/<Module>/Tests/\`.
Do NOT use TodoWrite.`;
}

/**
 * Prompt to generate a test for a single scenario.
 */
export function buildSingleScenarioTestPrompt(
  scenario: TestScenario,
  suite: TestSuite,
  ctx: ProjectContext
): string {
  const header = buildProjectContextHeader(ctx, {
    ...moduleKnowledge('ai-behavior'),
    includeBuildCommand: true,
    includeRules: true,
  });

  const stimuliLines = scenario.stimuli
    .map((st) => `- [${st.type}] "${st.label}": ${st.description}${Object.keys(st.params).length > 0 ? ` (params: ${JSON.stringify(st.params)})` : ''}`)
    .join('\n');

  const expectedLines = scenario.expectedActions
    .map((ea) => `- "${ea.action}" — BT node: ${ea.btNode || 'any'}, must occur within ${ea.timeoutSeconds}s`)
    .join('\n');

  return `${header}

## Task: Generate Single AI Test — "${scenario.name}"

Target class: **${suite.targetClass}**
Suite: "${suite.name}"

### Scenario Description:
${scenario.description}

### Mock Stimuli (apply in order):
${stimuliLines}

### Expected Behavior:
${expectedLines}

### Requirements:
1. Use UE5 Automation Framework (\`IMPLEMENT_SIMPLE_AUTOMATION_TEST_PRIVATE\`)
2. Create mock stimuli without requiring a running game — spawn a test world with just AI controller + pawn
3. Tick the behavior tree after each stimulus and check which BT node/task becomes active
4. Use meaningful assertion messages that report stimulus → action mapping on failure
5. Register the test under EXACTLY \`"${aiScenarioTestPath(suite, scenario)}"\` (the pretty name passed to the automation macro) — the app runs and grades this scenario by that path's \`S${scenario.id}_\` prefix

Output the test function + necessary includes. Do NOT use TodoWrite.`;
}

/**
 * Prompt to generate mock stimuli code from a natural-language scenario description.
 */
export function buildMockStimuliPrompt(
  scenarioDescription: string,
  targetClass: string,
  ctx: ProjectContext
): string {
  const header = buildProjectContextHeader(ctx, {
    ...moduleKnowledge('ai-behavior'),
    includeBuildCommand: false,
    includeRules: true,
  });

  return `${header}

## Task: Generate Mock Stimuli from Scenario Description

Target AI class: **${targetClass}**

### Scenario (natural language):
${scenarioDescription}

### Instructions:
Parse the scenario and produce:
1. A list of \`MockStimulus\` objects (JSON) with the following structure:
   \`\`\`json
   {
     "id": "unique-id",
     "type": "perception_sight" | "perception_hearing" | "perception_damage" | "damage_event" | "gameplay_tag" | "custom",
     "label": "short human-readable label",
     "description": "what this stimulus does in the game world",
     "params": { "key": "value" }
   }
   \`\`\`
2. A list of \`ExpectedAction\` objects (JSON):
   \`\`\`json
   {
     "id": "unique-id",
     "action": "what the BT should do",
     "btNode": "specific BT node name if known, or empty string",
     "timeoutSeconds": 5
   }
   \`\`\`

Produce the two arrays as \`{ "stimuli": [...], "expectedActions": [...] }\` and submit them via the callback block below — that is how they reach the scenario editor.
Do NOT use TodoWrite.`;
}

/** The app-chosen identity of one Run Tests dispatch (`reportDir` = `aiTestReportDir(projectPath, runId)`). */
export interface AITestRunTarget {
  runId: string;
  reportDir: string;
}

/** Quote a command-line token for the prompt when it carries a space or `;`. */
function shellToken(arg: string): string {
  return /[\s;]/.test(arg) ? `"${arg}"` : arg;
}

/**
 * Prompt to build and run the suite's tests in ONE headless UE boot that writes
 * UE's automation report to the run's `reportDir`. The app — not the model —
 * grades every scenario from that report (`record-run-results`); the model's
 * per-scenario status travels only as a note.
 */
export function buildRunTestsPrompt(
  suite: TestSuite,
  ctx: ProjectContext,
  run: AITestRunTarget,
): string {
  const header = buildProjectContextHeader(ctx, {
    ...moduleKnowledge('ai-behavior'),
    includeBuildCommand: true,
    includeRules: true,
  });

  const scenarioList = suite.scenarios.length > 0
    ? `\n### Scenarios in this suite\n${suite.scenarios
        .map((s) => `- scenarioId ${s.id}: ${s.name} — test \`${aiScenarioTestPath(suite, s)}\``)
        .join('\n')}\n`
    : '';

  // One RunTests filter per scenario (its S<id>_ prefix); an empty suite runs the class root.
  const filters = suite.scenarios.length > 0
    ? suite.scenarios.map((s) => aiScenarioTestPrefix(suite, s))
    : [`${AI_TEST_ROOT}.${aiTestSlug(suite.targetClass, 'Target')}.`];
  const uproject = `${ctx.projectPath}\\${getModuleName(ctx.projectName)}.uproject`;
  const editor = `${getEnginePath(ctx.ueVersion)}\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe`;
  const args = buildBatchAutomationArgs(filters, uproject, `${run.reportDir}/run.log`, run.reportDir);
  const command = [editor, ...args].map(shellToken).join(' ');

  return `${header}

## Task: Run AI Behavior Tests

Run the automation tests for suite "${suite.name}" targeting class **${suite.targetClass}** (run \`${run.runId}\`).
${scenarioList}
### Steps:
1. Build the project with the build command above (fix and rebuild on a compile error)
2. Run ALL of this suite's tests in ONE headless boot with exactly this command:
   \`\`\`
   ${command}
   \`\`\`
3. UE writes its automation report to \`${run.reportDir}/index.json\`. The app reads that report and grades every scenario from it — do NOT create, edit, move or delete anything under \`${run.reportDir}\`.
4. Submit a note for EVERY scenarioId listed above via the callback block below — your read of the result ("passed" / "failed" / "error") and a short reason in "output". It is recorded as a note next to the report's verdict; it cannot change the verdict.

If the test file doesn't exist yet, say so and suggest generating tests first (the app will grade those scenarios as missing from the report).
Do NOT use TodoWrite.`;
}
