import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const CTX: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj\\PoF',
  ueVersion: '5.7.2',
};
const ORIGIN = 'http://localhost:3000';

describe('prompt knowledge routing (Direction 2)', () => {
  it('a python task now gets the ue-python pitfalls (not ue-cpp)', () => {
    const task = TaskFactory.mixamoImport(
      'arpg-animation',
      { importDir: 'C:\\drops', targetSkeleton: '/Game/SK_Mannequin' },
      ORIGIN,
      'Mixamo',
    );
    const prompt = buildTaskPrompt(task, CTX);
    // python-only pitfalls present
    expect(prompt).toMatch(/Interchange FBX/);
    expect(prompt).toMatch(/introspect|dir\(unreal/i);
    // cpp-only gotcha absent (GAS RepNotify is appliesTo:['ue-cpp'])
    expect(prompt).not.toMatch(/GAMEPLAYATTRIBUTE_REPNOTIFY/);
  });

  it('the mixamo inline Interchange dupe is gone — the phrase appears once (from the injected gotcha)', () => {
    const task = TaskFactory.mixamoImport(
      'arpg-animation',
      { importDir: 'C:\\drops', targetSkeleton: '/Game/SK_Mannequin' },
      ORIGIN,
      'Mixamo',
    );
    const prompt = buildTaskPrompt(task, CTX);
    const occurrences = prompt.match(/The Interchange FBX path does not work in the pythonscript commandlet/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it('a materials checklist prompt shrank — no GAS / Niagara / Motion Matching', () => {
    const task = TaskFactory.checklist('materials', 'mat-master', 'Author the master material.', 'Materials', ORIGIN);
    const prompt = buildTaskPrompt(task, CTX);
    expect(prompt).not.toMatch(/GameplayEffect/);
    expect(prompt).not.toMatch(/Niagara/);
    expect(prompt).not.toMatch(/Motion Matching/);
  });

  it('a GAS checklist prompt retains the GAS pitfalls', () => {
    const task = TaskFactory.checklist('arpg-gas', 'gas-asc', 'Set up the ASC.', 'GAS', ORIGIN);
    const prompt = buildTaskPrompt(task, CTX);
    expect(prompt).toMatch(/PostGameplayEffectExecute|meta attribute/i);
    expect(prompt).toMatch(/REPNOTIFY/);
  });

  it('the binary tripwire is gated by task type — off for audio-import, on for wbp-starter', () => {
    const audio = buildTaskPrompt(
      TaskFactory.importAudioSet(
        { setName: 'footstep-stone', assets: [{ filename: 's.wav', srcAbsPath: 'C:\\s.wav' }] },
        ORIGIN,
      ),
      CTX,
    );
    expect(audio).not.toContain('Binary Content Wall');

    const wbp = buildTaskPrompt(TaskFactory.wbpStarter('arpg-ui', 'UARPGHUDWidget', ORIGIN, 'WBP'), CTX);
    expect(wbp).toContain('Binary Content Wall');
  });

  it('a checklist that can touch binary assets still carries the tripwire', () => {
    const task = TaskFactory.checklist('arpg-ui', 'hud-bars', 'Add health bars.', 'HUD', ORIGIN);
    expect(buildTaskPrompt(task, CTX)).toContain('Binary Content Wall');
  });

  it('an empty wiring block is skipped — module with assets keeps it, module without does not', () => {
    // arpg-gas declares no wiring assets → no wiring block.
    const gas = buildTaskPrompt(TaskFactory.checklist('arpg-gas', 'x', 'do', 'GAS', ORIGIN), CTX);
    expect(gas).not.toContain('## Wiring Requirements');
    // arpg-combat declares DT_DamageTypes + AM_MeleeCombo → wiring block present.
    const combat = buildTaskPrompt(TaskFactory.checklist('arpg-combat', 'x', 'do', 'Combat', ORIGIN), CTX);
    expect(combat).toContain('## Wiring Requirements');
  });
});
