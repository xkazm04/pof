import { describe, it, expect } from 'vitest';
import { attributeModule, analyzeAllCrashes } from '@/lib/crash-analyzer/analysis-engine';
import type { CallstackFrame, CrashReport } from '@/types/crash-analyzer';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function frame(
  index: number,
  functionName: string,
  sourceFile: string | null,
  isGameCode = true,
): CallstackFrame {
  return {
    index,
    address: `0x00007FF6A000${index}`,
    moduleName: isGameCode ? 'UnrealEditor-MyGame' : 'UnrealEditor-Engine',
    functionName,
    sourceFile,
    lineNumber: sourceFile ? 10 + index : null,
    isGameCode,
    isCrashOrigin: index === 0,
  };
}

function crash(callstack: CallstackFrame[]): CrashReport {
  return {
    id: 'crash-under-test',
    timestamp: '2026-02-14T00:00:00Z',
    crashType: 'ensure_failed',
    severity: 'low',
    errorMessage: 'Ensure condition failed',
    callstack,
    culpritFrame: null,
    machineState: {
      platform: 'Windows', cpuBrand: '-', gpuBrand: '-', ramMB: 0,
      osVersion: '-', engineVersion: '5.5', buildConfig: 'Development', isEditor: true,
    },
    crashDir: 'Imported',
    mappedModule: null,
    rawLog: '',
    analyzed: false,
  };
}

/* ------------------------------------------------------------------ */
/*  The class of bug: order-dependent, symbol-driven attribution       */
/* ------------------------------------------------------------------ */

describe('attributeModule — path evidence outranks a symbol-name substring', () => {
  // These two cases are MIRRORS of each other: in each one the directory says
  // subsystem A and the function name contains a token belonging to subsystem B.
  // Under the old first-match scan the answer was decided by which rule sat
  // earlier in the array, so exactly one of the two came out wrong. Scoring the
  // path above the symbol has to get BOTH right, whichever way round they are.
  it('files an AI-directory crash under AI even when the function name says "Attack"', () => {
    const result = attributeModule(crash([
      frame(0, 'FDebug::OptionallyLogFormattedEnsureMessage', null, false),
      frame(1, 'UBTTask_FooAttackTarget::ExecuteTask', 'Source/AI/BTTask_FooAttackTarget.cpp'),
    ]));

    expect(result.module).toBe('arpg-ai');
    expect(result.reason).toBe('attributed');
    // The winning evidence is the path, not the symbol.
    expect(result.evidence[0]).toContain('directory "Source/AI"');
  });

  it('files a SaveLoad-directory crash under save-load even when the function name says "Inventory"', () => {
    const result = attributeModule(crash([
      frame(0, 'UFooSaveGame::DeserializeInventory', 'Source/SaveLoad/FooSaveGame.cpp'),
    ]));

    expect(result.module).toBe('arpg-save-load');
    expect(result.reason).toBe('attributed');
  });

  it('does not let deeper caller frames outvote the frame the crash happened in', () => {
    // Culprit is loot code; it is CALLED from two AI frames. The caller chain
    // says who invoked the code, not who owns the defect.
    const result = attributeModule(crash([
      frame(0, 'UFooLootManager::RollLootTable', 'Source/Loot/FooLootManager.cpp'),
      frame(1, 'AFooEnemyCharacter::DropLoot', 'Source/AI/FooEnemyCharacter.cpp'),
      frame(2, 'AFooEnemyCharacter::OnDeath', 'Source/AI/FooEnemyCharacter.cpp'),
    ]));

    expect(result.module).toBe('arpg-loot');
    expect(result.runnerUp?.module).toBe('arpg-ai');
    expect(result.score).toBeGreaterThan(result.runnerUp!.score);
  });

  it('still consults frames below the culprit — a deeper frame can corroborate', () => {
    const shallow = attributeModule(crash([
      frame(0, 'UFooQuestManager::Evaluate', 'Source/Quests/FooQuestManager.cpp'),
    ]));
    const corroborated = attributeModule(crash([
      frame(0, 'UFooQuestManager::Evaluate', 'Source/Quests/FooQuestManager.cpp'),
      frame(1, 'UFooQuestLog::Refresh', 'Source/Quests/FooQuestLog.cpp'),
    ]));

    expect(shallow.module).toBe('arpg-dialogue-quests');
    expect(corroborated.module).toBe(shallow.module);
    expect(corroborated.score).toBeGreaterThan(shallow.score);
  });
});

/* ------------------------------------------------------------------ */
/*  Unknown rather than a confident guess                              */
/* ------------------------------------------------------------------ */

describe('attributeModule — reports unknown instead of defaulting', () => {
  it('returns null when the only signal is a token of a function name', () => {
    const result = attributeModule(crash([
      frame(0, 'UFooLootManager::RollLootTable', null),
    ]));

    expect(result.module).toBeNull();
    expect(result.reason).toBe('no-evidence');
  });

  it('returns null when two subsystems are within the confidence margin', () => {
    // Directory says AI (3), file + symbol say combat (2 + 1) — a genuine tie.
    const result = attributeModule(crash([
      frame(0, 'UFooTask::ApplyDamage', 'Source/AI/CombatDamage.cpp'),
    ]));

    expect(result.module).toBeNull();
    expect(result.reason).toBe('ambiguous');
    expect(result.runnerUp).not.toBeNull();
  });

  it('returns null with no game-code frames at all', () => {
    const result = attributeModule(crash([
      frame(0, 'FDebug::AssertFailed', null, false),
      frame(1, 'UEngine::Tick', null, false),
    ]));

    expect(result.module).toBeNull();
    expect(result.reason).toBe('no-evidence');
    expect(result.score).toBe(0);
  });

  it('is not decided by a substring that is not a word — "Chain" is not AI, "Build" is not UI', () => {
    const chain = attributeModule(crash([
      frame(0, 'UFooQuestManager::CheckDependencyChain', 'Source/Quests/FooQuestManager.cpp'),
    ]));
    expect(chain.module).toBe('arpg-dialogue-quests');
    expect(chain.evidence.some((e) => e.startsWith('arpg-ai'))).toBe(false);

    const build = attributeModule(crash([
      frame(0, 'UFooBuilder::BuildLevel', 'Source/Building/FooBuilder.cpp'),
    ]));
    expect(build.evidence.some((e) => e.startsWith('arpg-ui-hud'))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Blast radius over the shipped sample set                           */
/* ------------------------------------------------------------------ */

describe('sample-crash attribution — measured blast radius', () => {
  // Recorded from the engine BEFORE this change (first-match scan):
  //   crash-001 arpg-character        crash-005 arpg-inventory  ← wrong (SaveLoad crash)
  //   crash-002 arpg-abilities        crash-006 arpg-combat     ← wrong (AI crash)
  //   crash-003 arpg-loot             crash-007 arpg-dialogue-quests
  //   crash-004 arpg-inventory        crash-008 arpg-character
  const EXPECTED: Record<string, string> = {
    'crash-001': 'arpg-character',
    'crash-002': 'arpg-abilities',
    'crash-003': 'arpg-loot',
    'crash-004': 'arpg-inventory',
    'crash-005': 'arpg-save-load',
    'crash-006': 'arpg-ai',
    'crash-007': 'arpg-dialogue-quests',
    'crash-008': 'arpg-character',
  };

  it('attributes every shipped sample, and moves only the two misattributed ones', () => {
    const { reports } = analyzeAllCrashes();
    const actual = Object.fromEntries(reports.map((r) => [r.id, r.mappedModule]));
    expect(actual).toEqual(EXPECTED);
  });

  it('crash-006 — a Behavior Tree ensure in Source/AI — no longer files under combat', () => {
    const { reports } = analyzeAllCrashes();
    const crash006 = reports.find((r) => r.id === 'crash-006');

    expect(crash006?.culpritFrame?.sourceFile).toBe('Source/AI/BTTask_ARPGAttackTarget.cpp');
    expect(crash006?.mappedModule).toBe('arpg-ai');
    expect(crash006?.mappedModule).not.toBe('arpg-combat');
  });

  it('the crashesByModule stat no longer double-counts inventory', () => {
    const { stats } = analyzeAllCrashes();

    // Before: { character 2, abilities 1, loot 1, inventory 2, combat 1, quests 1 }
    expect(stats.crashesByModule).toEqual({
      'arpg-character': 2,
      'arpg-abilities': 1,
      'arpg-loot': 1,
      'arpg-inventory': 1,
      'arpg-save-load': 1,
      'arpg-ai': 1,
      'arpg-dialogue-quests': 1,
    });
    // The headline stat is unchanged in VALUE but no longer a coin-flip tie
    // between arpg-character and arpg-inventory.
    expect(stats.mostAffectedModule).toBe('arpg-character');
  });
});
