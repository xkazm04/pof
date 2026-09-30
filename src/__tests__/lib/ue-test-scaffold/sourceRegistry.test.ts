/**
 * Which waiting UE tests the project's C++ Source actually registers (ue5-build-bridge/B,
 * acceptance cases 1-2).
 *
 *   1. registeredTestNames reads IMPLEMENT_SIMPLE/COMPLEX_AUTOMATION_TEST + BEGIN_DEFINE_SPEC
 *      registrations and ignores commented-out ones;
 *   2. testPresence decides with the RunTests substring rule and names ambiguity through the
 *      shared attributeUniquely rule. [guard] A generated scaffold round-trips to 'in-source'.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  registeredTestNames, testPresence, scanRegisteredTests,
} from '@/lib/ue-test-scaffold/sourceRegistry';
import { generateScaffold } from '@/lib/ue-test-scaffold/generate';

const CPP = `#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FVSCodexUnlockTest, "Project.Functional Tests.PoF.Codex.VSCodexUnlockTest", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

IMPLEMENT_COMPLEX_AUTOMATION_TEST(FX, "PoF.Items.Complex", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

BEGIN_DEFINE_SPEC(FY, "PoF.Dialog.Spec", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
END_DEFINE_SPEC(FY)

// IMPLEMENT_SIMPLE_AUTOMATION_TEST(FOld, "PoF.Old.LineCommented", EAutomationTestFlags::EditorContext)
/*
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FGone, "PoF.Gone.BlockCommented", EAutomationTestFlags::EditorContext)
*/
static const TCHAR* Url = TEXT("http://example.invalid/not-a-comment");
`;

describe('registeredTestNames (case 1)', () => {
  it('extracts exactly the three live registrations, not the commented-out ones', () => {
    expect(registeredTestNames(CPP)).toEqual([
      'Project.Functional Tests.PoF.Codex.VSCodexUnlockTest',
      'PoF.Items.Complex',
      'PoF.Dialog.Spec',
    ]);
  });
});

describe('testPresence (case 2)', () => {
  const names = registeredTestNames(CPP);

  it('a leaf contained in one registered name is in-source', () => {
    expect(testPresence('VSCodexUnlockTest', names)).toBe('in-source');
  });

  it('a name no registration contains is not-in-source', () => {
    expect(testPresence('Quest.Diablo.Q_DIABLO.EndToEnd', names)).toBe('not-in-source');
  });

  it('a leaf contained in two different registered names is ambiguous (never guessed)', () => {
    const two = [
      'Project.Functional Tests.PoF.Dialog.VSDialogBranchTest',
      'Project.Maps.Slice.VSDialogBranchTest_Actor',
    ];
    expect(testPresence('VSDialogBranchTest', two)).toBe('ambiguous');
    // The same registered name spelled twice is one identity, not a collision.
    expect(testPresence('VSDialogBranchTest', [two[0], two[0]])).toBe('in-source');
  });

  it('[guard] a generated scaffold of either name shape round-trips to in-source', () => {
    const live = [
      'VSCodexUnlockTest',
      'VSDialogBranchTest',
      'ARPG.DialogTrees.D1.GillianConversation.TestGate',
      'Quest.Diablo.Q_DIABLO.EndToEnd',
      'AnvilOfFury_QuestLifecycle_SinglePlayer',
    ];
    for (const n of live) {
      const registered = registeredTestNames(generateScaffold(n).code);
      expect(registered, n).toHaveLength(1);
      expect(testPresence(n, registered), n).toBe('in-source');
    }
  });
});

describe('scanRegisteredTests — bounded walk of <project>/Source', () => {
  it('collects registrations from .cpp files under Source and reports a missing Source dir', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pof-src-registry-'));
    try {
      const proj = join(root, 'Proj');
      mkdirSync(join(proj, 'Source', 'PoF', 'Test'), { recursive: true });
      writeFileSync(join(proj, 'Source', 'PoF', 'Test', 'A.cpp'), CPP);
      writeFileSync(join(proj, 'Source', 'PoF', 'Test', 'notes.txt'), 'IMPLEMENT_SIMPLE_AUTOMATION_TEST(FZ, "PoF.NotSource", 0)');
      const r = await scanRegisteredTests(proj);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data.names.sort()).toEqual(registeredTestNames(CPP).sort());

      const missing = await scanRegisteredTests(join(root, 'NoSuchProject'));
      expect(missing.ok).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
