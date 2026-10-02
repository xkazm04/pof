import { describe, it, expect } from 'vitest';
import { parseBlueprintJson } from '@/lib/blueprint-parser';
import { generateCppFromBlueprint } from '@/lib/blueprint-cpp-codegen';
import { computeSemanticDiff } from '@/lib/blueprint-semantic-diff';
import { deriveCppSurface } from '@/lib/blueprint-cpp-surface';
import { parseHeader } from '@/lib/cpp-semantic-parser';
import { SAMPLE_BLUEPRINT } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/constants';

// ── One C++ member model for codegen and diff ───────────────────────────────
//
// Standard: ai-registry game-production/visual-script-to-code-transpilation,
// techniques "declaration-definition parity" (one member record, both
// renderers are projections of it) and "structural round-trip diff" (the
// transpiler's own output must diff clean). Parity is asserted by RE-PARSING
// the emitted header text, never by comparing the model against itself.

/** A door with a plain-replicated flag, a RepNotify variable and a custom event. */
const DOOR_BLUEPRINT = {
  ClassName: 'BP_Door',
  ParentClass: 'AActor',
  Variables: [
    { VarName: 'bOpen', VarType: 'bool', PropertyFlags: ['CPF_Net'] },
    { VarName: 'Hp', VarType: 'float', PropertyFlags: ['CPF_RepNotify'] },
  ],
  Graphs: [{
    GraphName: 'EventGraph',
    GraphType: 'event',
    Nodes: [
      { NodeGuid: 'e1', NodeClass: 'K2Node_Event', MemberName: 'ReceiveBeginPlay', Pins: [{ PinName: 'then', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['b1'] }] },
      { NodeGuid: 'm1', NodeClass: 'K2Node_CommutativeAssociativeBinaryOperator', Pins: [{ PinName: 'ReturnValue', PinType: { PinCategory: 'bool' }, Direction: 'EGPD_Output', LinkedTo: ['b1'] }] },
      {
        NodeGuid: 'b1',
        NodeClass: 'K2Node_IfThenElse',
        Pins: [
          { PinName: 'execute', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Input' },
          { PinName: 'Condition', PinType: { PinCategory: 'bool' }, Direction: 'EGPD_Input', LinkedTo: ['m1'] },
          { PinName: 'Then', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['s1'] },
          { PinName: 'Else', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['s2'] },
        ],
      },
      { NodeGuid: 's1', NodeClass: 'K2Node_VariableSet', MemberName: 'bOpen', Pins: [{ PinName: 'execute', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Input' }, { PinName: 'bOpen', PinType: { PinCategory: 'bool' }, Direction: 'EGPD_Input', DefaultValue: 'true' }] },
      { NodeGuid: 's2', NodeClass: 'K2Node_VariableSet', MemberName: 'bOpen', Pins: [{ PinName: 'execute', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Input' }, { PinName: 'bOpen', PinType: { PinCategory: 'bool' }, Direction: 'EGPD_Input', DefaultValue: 'false' }] },
      { NodeGuid: 'x1', NodeClass: 'K2Node_Event', MemberName: 'ReceiveActorBeginOverlap', Pins: [{ PinName: 'then', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['t1'] }] },
      { NodeGuid: 't1', NodeClass: 'K2Node_Timeline', Pins: [] },
      { NodeGuid: 'c1', NodeClass: 'K2Node_CustomEvent', Name: 'OpenDoor', MemberName: 'OpenDoor', Pins: [] },
      { NodeGuid: 'o1', NodeClass: 'K2Node_CallFunction', MemberName: 'Orphan', Pins: [] },
    ],
  }],
};

const FIXTURES = [
  { label: 'sample', json: SAMPLE_BLUEPRINT as string | object },
  { label: 'door', json: DOOR_BLUEPRINT as string | object },
];

function transpile(json: string | object) {
  const asset = parseBlueprintJson(json);
  return { asset, result: generateCppFromBlueprint(asset, 'PoF') };
}

describe('deriveCppSurface — codegen and diff are projections of one member model', () => {
  it('the shipped sample, diffed against its own generated header, has no changes', () => {
    const { asset, result } = transpile(SAMPLE_BLUEPRINT);
    const diff = computeSemanticDiff(asset, result.headerCode, 'PoF', 0);
    expect(diff.changes.map((c) => `${c.type}/${c.scope}/${c.name}: ${c.description}`)).toEqual([]);
    expect(diff.overallConflict).toBe('none');
  });

  it('a replicated door with a RepNotify variable and a custom event round-trips clean', () => {
    const { asset, result } = transpile(DOOR_BLUEPRINT);
    const diff = computeSemanticDiff(asset, result.headerCode, 'PoF', 0);
    expect(diff.changes.map((c) => `${c.type}/${c.scope}/${c.name}: ${c.description}`)).toEqual([]);
    expect(diff.overallConflict).toBe('none');
  });

  it('the UFUNCTIONs re-parsed from the emitted header are exactly the surface function set', () => {
    for (const { label, json } of FIXTURES) {
      const { asset, result } = transpile(json);
      const reparsed = parseHeader(result.headerCode).classes
        .flatMap((c) => c.functionSignatures.map((f) => f.name))
        .sort();
      const surface = deriveCppSurface(asset).functions.map((f) => f.name).sort();
      expect({ label, names: reparsed }).toEqual({ label, names: surface });
      expect(surface.length).toBeGreaterThan(0);
    }
  });

  // [guard] The refactor must not change a byte of emitted C++. Captured from
  // generateCppFromBlueprint at 9b2ddb0c, BEFORE codegen consumed the surface.
  // NOTE: blueprint-tools/B (same run, wave 2) deliberately changes the
  // node-walker TODO stub text (adds the node id); it updates the two
  // `// TODO: [K2Node_...]` lines below as part of its own change — this guard
  // is about the member model, not the stub wording.
  it('[guard] header and source are byte-identical to the pre-refactor output', () => {
    const sample = transpile(SAMPLE_BLUEPRINT).result;
    const door = transpile(DOOR_BLUEPRINT).result;
    expect(sample.headerCode).toBe(HEAD_SAMPLE_HEADER);
    expect(sample.sourceCode).toBe(HEAD_SAMPLE_SOURCE);
    expect(door.headerCode).toBe(HEAD_DOOR_HEADER);
    expect(door.sourceCode).toBe(HEAD_DOOR_SOURCE);
    // Warning order and the function count ride on the same walk.
    expect(sample.warnings.map((w) => w.nodeId ?? null)).toEqual(['f2']);
    expect(door.warnings.map((w) => w.nodeId ?? null)).toEqual(['x1', 'b1']);
    expect([sample.functionCount, door.functionCount]).toEqual([1, 1]);
  });
});

// ── Pre-refactor output (generateCppFromBlueprint(asset, 'PoF') at 9b2ddb0c) ─

const HEAD_SAMPLE_HEADER = [
  '#pragma once',
  '',
  '#include "CoreMinimal.h"',
  '#include "GameFramework/Character.h"',
  '#include "APlayerCharacter.generated.h"',
  '',
  'UCLASS()',
  'class POF_API APlayerCharacter : public ACharacter',
  '{',
  '\tGENERATED_BODY()',
  '',
  'public:',
  '\tAPlayerCharacter();',
  '',
  '\t// ── Properties ──',
  '',
  '\t/** Current health points */',
  '\tUPROPERTY(EditAnywhere, BlueprintReadWrite)',
  '\tfloat Health = 100.0;',
  '',
  '\tUPROPERTY(EditAnywhere, BlueprintReadWrite)',
  '\tfloat MaxHealth = 100.0;',
  '',
  '\tUPROPERTY(EditAnywhere, BlueprintReadWrite)',
  '\tfloat MoveSpeed = 600.0;',
  '',
  '\tUPROPERTY(BlueprintReadWrite)',
  '\tbool bIsDead = false;',
  '',
  '\tUFUNCTION(BlueprintCallable, Category = "BP_PlayerCharacter")',
  '\tvoid TakeDamage(float DamageAmount);',
  '',
  'protected:',
  '\t// ── Event Overrides ──',
  '',
  '\tvirtual void BeginPlay() override;',
  '\tvirtual void Tick(float DeltaTime) override;',
  '',
  '};',
].join('\n');

const HEAD_SAMPLE_SOURCE = [
  '#include "APlayerCharacter.h"',
  '',
  'APlayerCharacter::APlayerCharacter()',
  '{',
  '\tPrimaryActorTick.bCanEverTick = true;',
  '}',
  '',
  'void APlayerCharacter::BeginPlay()',
  '{',
  '\tSuper::BeginPlay();',
  '',
  '\tUE_LOG(LogTemp, Log, TEXT("Player Spawned!"));',
  '}',
  '',
  'void APlayerCharacter::Tick(float DeltaTime)',
  '{',
  '\tSuper::Tick(DeltaTime);',
  '',
  '\t// TODO: Implement logic',
  '}',
  '',
  'void APlayerCharacter::TakeDamage(float DamageAmount)',
  '{',
  '\t// TODO: [K2Node_VariableSet] Set Health — Health (node f2) — assignment not emitted — pin "Health" default "Health - DamageAmount" is not a numeric literal',
  '}',
  '',
].join('\n');

const HEAD_DOOR_HEADER = [
  '#pragma once',
  '',
  '#include "CoreMinimal.h"',
  '#include "GameFramework/Actor.h"',
  '#include "ADoor.generated.h"',
  '',
  'UCLASS()',
  'class POF_API ADoor : public AActor',
  '{',
  '\tGENERATED_BODY()',
  '',
  'public:',
  '\tADoor();',
  '',
  '\t// ── Properties ──',
  '',
  '\tUPROPERTY(Replicated, BlueprintReadWrite)',
  '\tbool bOpen;',
  '',
  '\tUPROPERTY(ReplicatedUsing = OnRep_Hp, BlueprintReadWrite)',
  '\tfloat Hp;',
  '',
  'protected:',
  '\t// ── Event Overrides ──',
  '',
  '\tvirtual void BeginPlay() override;',
  '\t// TODO: Override for ReceiveActorBeginOverlap',
  '',
  'public:',
  '\t// ── Custom Events ──',
  '',
  '\tUFUNCTION(BlueprintCallable, Category = "Events")',
  '\tvoid OpenDoor();',
  '',
  'public:',
  '\t// ── Networking ──',
  '\tvirtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;',
  '',
  'protected:',
  '\t// ── RepNotify Handlers ──',
  '\tUFUNCTION()',
  '\tvoid OnRep_Hp();',
  '',
  '};',
].join('\n');

const HEAD_DOOR_SOURCE = [
  '#include "ADoor.h"',
  '#include "Net/UnrealNetwork.h"',
  '',
  'ADoor::ADoor()',
  '{',
  '\tPrimaryActorTick.bCanEverTick = false;',
  '}',
  '',
  'void ADoor::BeginPlay()',
  '{',
  '\tSuper::BeginPlay();',
  '',
  '\t// TODO: [K2Node_IfThenElse] Branch (node b1) — branch not emitted — pin "Condition" is driven by [K2Node_CommutativeAssociativeBinaryOperator] Math Op — the expression is not derivable; both exec paths need manual translation',
  '}',
  '',
  'void ADoor::OpenDoor()',
  '{',
  '\t// TODO: Implement logic',
  '}',
  '',
  'void ADoor::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const',
  '{',
  '\tSuper::GetLifetimeReplicatedProps(OutLifetimeProps);',
  '',
  '\tDOREPLIFETIME(ADoor, bOpen);',
  '\tDOREPLIFETIME(ADoor, Hp);',
  '}',
  '',
  'void ADoor::OnRep_Hp()',
  '{',
  '\t// TODO: React to replicated Hp change on clients (update UI, play FX, etc.)',
  '}',
  '',
].join('\n');
