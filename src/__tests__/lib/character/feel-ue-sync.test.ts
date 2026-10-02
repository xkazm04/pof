import { describe, it, expect } from 'vitest';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import { resolveStack } from '@/lib/feel-adjustment-layers';
import {
  FEEL_UE_BINDINGS,
  parseFeelDefaults,
  diffAgainstUE,
  buildDriftApplyPrompt,
  buildAdoptLayer,
  type UESourceFile,
} from '@/lib/character/feel-ue-sync';

const darkSouls = FEEL_PRESETS.find((p) => p.id === 'dark-souls')!;

const CASE_1: UESourceFile[] = [
  {
    path: 'Character/ARPGCharacterBase.cpp',
    text: 'MoveComp->MaxWalkSpeed = 600.f;\nMoveComp->RotationRate = FRotator(0.f, 540.f, 0.f);',
  },
  {
    path: 'Character/ARPGPlayerCharacter.h',
    text: 'float SprintSpeed = 900.f;\nfloat StaminaDrainRate = 20.f;',
  },
];

describe('feel-ue-sync — parseFeelDefaults', () => {
  it('case 1: reads literal defaults, the FRotator yaw and aliased names', () => {
    const parsed = parseFeelDefaults(CASE_1);
    expect(parsed['movement.maxWalkSpeed']).toMatchObject({
      status: 'found', value: 600, name: 'MaxWalkSpeed', path: 'Character/ARPGCharacterBase.cpp', line: 1,
    });
    expect(parsed['movement.turnRate']).toMatchObject({ status: 'found', value: 540, name: 'RotationRate', line: 2 });
    expect(parsed['movement.maxSprintSpeed']).toMatchObject({
      status: 'found', value: 900, name: 'SprintSpeed', path: 'Character/ARPGPlayerCharacter.h', line: 1,
    });
    expect(parsed['staminaDrainPerSec']).toMatchObject({ status: 'found', value: 20, name: 'StaminaDrainRate', line: 2 });
  });

  it('case 2: a non-literal assignment only is unparsed with its file:line, never absent, never a value', () => {
    const parsed = parseFeelDefaults([
      { path: 'Character/ARPGPlayerCharacter.cpp', text: '\n  MoveComp->MaxWalkSpeed = FMath::FInterpTo(a, b, c, d);' },
    ]);
    const walk = parsed['movement.maxWalkSpeed'];
    expect(walk.status).toBe('unparsed');
    expect(walk.value).toBeNull();
    expect(walk).toMatchObject({ path: 'Character/ARPGPlayerCharacter.cpp', line: 2 });
    expect(walk.runtimeWriters).toEqual([
      expect.objectContaining({ name: 'MaxWalkSpeed', path: 'Character/ARPGPlayerCharacter.cpp', line: 2 }),
    ]);
  });

  it('case 3: disagreeing literal hits are ambiguous with both locations; agreeing hits give one value', () => {
    const disagree = parseFeelDefaults([
      { path: 'Character/ARPGPlayerCharacter.h', text: 'float WalkSpeed = 600.f;' },
      { path: 'Character/ARPGCharacterBase.cpp', text: 'MoveComp->MaxWalkSpeed = 450.f;' },
    ])['movement.maxWalkSpeed'];
    expect(disagree.status).toBe('ambiguous');
    expect(disagree.value).toBeNull();
    expect(disagree.sites.map((s) => `${s.name}@${s.path}:${s.line}=${s.value}`)).toEqual([
      'WalkSpeed@Character/ARPGPlayerCharacter.h:1=600',
      'MaxWalkSpeed@Character/ARPGCharacterBase.cpp:1=450',
    ]);

    const agree = parseFeelDefaults([
      { path: 'Character/ARPGPlayerCharacter.h', text: 'float WalkSpeed = 600.f;' },
      { path: 'Character/ARPGCharacterBase.cpp', text: 'MoveComp->MaxWalkSpeed = 600.f;' },
    ])['movement.maxWalkSpeed'];
    expect(agree.status).toBe('found');
    expect(agree.value).toBe(600);
    expect(agree.sites).toHaveLength(2);
  });

  it('revision: a literal plus runtime writers takes the literal and lists the writers', () => {
    const walk = parseFeelDefaults([
      { path: 'Character/ARPGCharacterBase.cpp', text: 'MoveComp->MaxWalkSpeed = 600.f;' },
      {
        path: 'Character/ARPGPlayerCharacter.cpp',
        text: 'void Tick()\n{\n  MoveComp->MaxWalkSpeed = FMath::FInterpTo(MoveComp->MaxWalkSpeed, T, DeltaTime, R);\n  MoveComp->MaxWalkSpeed = WalkSpeed;\n}',
      },
    ])['movement.maxWalkSpeed'];
    expect(walk.status).toBe('found');
    expect(walk.value).toBe(600);
    expect(walk).toMatchObject({ name: 'MaxWalkSpeed', path: 'Character/ARPGCharacterBase.cpp', line: 1 });
    expect(walk.runtimeWriters.map((w) => `${w.path}:${w.line}`)).toEqual([
      'Character/ARPGPlayerCharacter.cpp:3',
      'Character/ARPGPlayerCharacter.cpp:4',
    ]);
    // …and it reaches the diff as a real value with its writers attached.
    const row = diffAgainstUE(darkSouls.profile, { 'movement.maxWalkSpeed': walk }).rows
      .find((r) => r.field === 'movement.maxWalkSpeed')!;
    expect(row.status).toBe('drift');
    expect(row.ueValue).toBe(600);
    expect(row.runtimeWriters).toHaveLength(2);
  });
});

describe('feel-ue-sync — diff, prompt, adopt', () => {
  it('case 4: dark-souls vs case 1 drifts on walk/turn/sprint; unbound hits are absent; counts sum to bound fields', () => {
    const { rows, summary } = diffAgainstUE(resolveStack(darkSouls.profile, []), parseFeelDefaults(CASE_1));
    const by = (f: string) => rows.find((r) => r.field === f)!;
    expect(by('movement.maxWalkSpeed')).toMatchObject({ status: 'drift', stackValue: 320, ueValue: 600 });
    expect(by('movement.turnRate')).toMatchObject({ status: 'drift', stackValue: 360, ueValue: 540 });
    expect(by('movement.maxSprintSpeed')).toMatchObject({ status: 'drift', stackValue: 580, ueValue: 900 });
    expect(by('movement.acceleration').status).toBe('absent');
    expect(by('camera.fovBase').status).toBe('absent');
    expect(rows).toHaveLength(FEEL_UE_BINDINGS.length);
    const total = summary.inSync + summary.drift + summary.absent + summary.unparsed + summary.ambiguous;
    expect(total).toBe(FEEL_UE_BINDINGS.length);
    expect(summary.drift).toBe(4);
    expect(summary.absent).toBe(FEEL_UE_BINDINGS.length - 4);
  });

  it('case 5: numeric tolerance — 0.2f vs 0.2 and 2048.f vs 2048 are in sync', () => {
    const parsed = parseFeelDefaults([
      { path: 'Character/ARPGCharacterBase.cpp', text: 'MoveComp->AirControl = 0.2f;\nMoveComp->MaxAcceleration = 2048.f;' },
    ]);
    const profile = structuredClone(darkSouls.profile);
    profile.movement.airControl = 0.2;
    profile.movement.acceleration = 2048;
    const { rows } = diffAgainstUE(profile, parsed);
    expect(rows.find((r) => r.field === 'movement.airControl')!.status).toBe('in-sync');
    expect(rows.find((r) => r.field === 'movement.acceleration')!.status).toBe('in-sync');
  });

  it('case 6: the apply prompt lists only drift/absent rows at their located identifier; null when nothing to do', () => {
    const profile = structuredClone(darkSouls.profile);
    profile.staminaDrainPerSec = 20; // in sync with StaminaDrainRate
    const { rows } = diffAgainstUE(profile, parseFeelDefaults(CASE_1));
    const prompt = buildDriftApplyPrompt(rows)!;
    expect(prompt).not.toBeNull();
    expect(prompt).toContain('SprintSpeed (Character/ARPGPlayerCharacter.h:1): 900 -> 580');
    expect(prompt).toContain('MaxWalkSpeed (Character/ARPGCharacterBase.cpp:1): 600 -> 320');
    expect(prompt).toContain('RotationRate (Character/ARPGCharacterBase.cpp:2): 540 -> 360');
    expect(prompt).not.toContain('StaminaDrainRate');
    expect(prompt).not.toContain('MaxSprintSpeed');
    // Absent properties are reported, never created.
    expect(prompt).toMatch(/MaxAcceleration/);
    expect(prompt).not.toMatch(/find or create/i);
    expect(prompt).toMatch(/do not create/i);

    const quiet = rows.filter((r) => r.status === 'in-sync' || r.status === 'unparsed' || r.status === 'ambiguous');
    expect(buildDriftApplyPrompt(quiet)).toBeNull();
  });

  it('case 7: buildAdoptLayer builds the reserved ue-adopted set layer that resolves to the UE value', () => {
    const { rows } = diffAgainstUE(resolveStack(darkSouls.profile, []), parseFeelDefaults(CASE_1));
    const layer = buildAdoptLayer(rows, ['movement.maxWalkSpeed']);
    expect(layer).toEqual({
      id: 'ue-adopted', name: 'Adopted from UE', enabled: true,
      modifiers: [{ field: 'movement.maxWalkSpeed', op: 'set', value: 600 }],
    });
    expect(resolveStack(darkSouls.profile, [layer!]).movement.maxWalkSpeed).toBe(600);
  });
});
