import { buildProjectContextHeader, type ProjectContext } from '@/lib/prompt-context';
import type { TestScenario, TestSuite } from '@/types/ai-testing';

/**
 * Prompt to generate a full UE5 Automation Framework test spec
 * for an entire test suite (all scenarios).
 */
export function buildGenerateTestsPrompt(
  suite: TestSuite,
  ctx: ProjectContext
): string {
  const header = buildProjectContextHeader(ctx, {
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
      return `  ${i + 1}. "${s.name}" — ${s.description}\n    Stimuli:\n${stimuliLines}\n    Expected:\n${expectedLines}`;
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
5. Organize tests in the \`"AI.BehaviorTests.${suite.targetClass}"\` category
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
5. Place in test category \`"AI.BehaviorTests.${suite.targetClass}.${scenario.name.replace(/\s+/g, '_')}"\`

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

Return ONLY the two JSON arrays: \`{ "stimuli": [...], "expectedActions": [...] }\`
Do NOT use TodoWrite.`;
}

/**
 * Prompt to run the generated tests via UBT and report results.
 */
export function buildRunTestsPrompt(
  suite: TestSuite,
  ctx: ProjectContext
): string {
  const header = buildProjectContextHeader(ctx, {
    includeBuildCommand: true,
    includeRules: true,
  });

  return `${header}

## Task: Run AI Behavior Tests

Run the automation tests for suite "${suite.name}" targeting class **${suite.targetClass}**.

### Steps:
1. Build the project in Test configuration (or Editor if Test is not configured)
2. Run the automation tests with:
   \`\`\`
   UnrealEditor-Cmd.exe <ProjectPath> -ExecCmds="Automation RunTests AI.BehaviorTests.${suite.targetClass}" -Unattended -NoPause -NullRHI -Log
   \`\`\`
3. Parse the test output log for pass/fail results
4. Report which scenarios passed and which failed with the failure reason

If the test file doesn't exist yet, say so and suggest generating tests first.
Do NOT use TodoWrite.`;
}
