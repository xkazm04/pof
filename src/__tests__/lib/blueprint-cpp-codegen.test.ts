import { describe, it, expect } from 'vitest';
import {
  deriveFunctionSignature,
  generateCppFromBlueprint,
  generateNodeLogic,
} from '@/lib/blueprint-cpp-codegen';
import type {
  BlueprintAsset,
  BlueprintGraph,
  BlueprintNode,
  BlueprintPin,
  BlueprintVariable,
  TranspileWarning,
} from '@/types/blueprint';

// ─── Factories ───────────────────────────────────────────────────────────────

function pin(partial: Partial<BlueprintPin> & { name: string; direction: 'input' | 'output' }): BlueprintPin {
  return { type: 'exec', ...partial };
}

function node(partial: Partial<BlueprintNode> & { id: string; type: string }): BlueprintNode {
  return { name: partial.id, pins: [], posX: 0, posY: 0, ...partial };
}

function variable(partial: Partial<BlueprintVariable> & { name: string }): BlueprintVariable {
  return {
    type: 'float',
    isExposedToEditor: false,
    isReplicated: false,
    isRepNotify: false,
    ...partial,
  };
}

function graph(partial: Partial<BlueprintGraph> & { name: string }): BlueprintGraph {
  return { graphType: 'function', nodes: [], ...partial };
}

function asset(partial: Partial<BlueprintAsset> = {}): BlueprintAsset {
  return {
    className: 'BP_Test',
    parentClass: 'AActor',
    variables: [],
    functions: [],
    eventGraph: { name: 'EventGraph', graphType: 'event', nodes: [] },
    ...partial,
  };
}

// ─── deriveFunctionSignature ──────────────────────────────────────────────────

describe('deriveFunctionSignature', () => {
  it('returns void / no params for a function with no entry or result nodes', () => {
    const sig = deriveFunctionSignature(graph({ name: 'Empty' }));
    expect(sig.params).toEqual([]);
    expect(sig.returnType).toBe('void');
    expect(sig.entryNode).toBeUndefined();
  });

  it('derives params from FunctionEntry output pins and return type from FunctionResult', () => {
    const fn = graph({
      name: 'AddDamage',
      nodes: [
        node({
          id: 'entry',
          type: 'K2Node_FunctionEntry',
          pins: [
            pin({ name: 'then', type: 'exec', direction: 'output' }),
            pin({ name: 'Amount', type: 'float', direction: 'output' }),
            pin({ name: 'Target', type: 'actor', direction: 'output' }),
          ],
        }),
        node({
          id: 'result',
          type: 'K2Node_FunctionResult',
          pins: [pin({ name: 'ReturnValue', type: 'bool', direction: 'input' })],
        }),
      ],
    });
    const sig = deriveFunctionSignature(fn);
    expect(sig.params).toEqual(['float Amount', 'AActor* Target']);
    expect(sig.returnType).toBe('bool');
    expect(sig.entryNode?.id).toBe('entry');
  });
});

// ─── generateCppFromBlueprint ─────────────────────────────────────────────────

describe('generateCppFromBlueprint', () => {
  it('strips the BP_ prefix and prepends A for the C++ class name', () => {
    const result = generateCppFromBlueprint(asset({ className: 'BP_Hero' }), 'MyProject');
    expect(result.className).toBe('AHero');
    expect(result.headerCode).toContain('class MYPROJECT_API AHero : public AActor');
  });

  it('uses moduleName for the API macro when provided', () => {
    const result = generateCppFromBlueprint(asset({ className: 'BP_Hero' }), 'MyProject', 'CombatRuntime');
    expect(result.headerCode).toContain('class COMBATRUNTIME_API AHero');
  });

  it('keeps an existing A/U class name unchanged', () => {
    expect(generateCppFromBlueprint(asset({ className: 'AMyActor' }), 'P').className).toBe('AMyActor');
    expect(generateCppFromBlueprint(asset({ className: 'UMyComp' }), 'P').className).toBe('UMyComp');
  });

  it('selects the parent include from the parent class', () => {
    expect(generateCppFromBlueprint(asset({ parentClass: 'ACharacter' }), 'P').includes).toContain(
      'GameFramework/Character.h',
    );
    expect(generateCppFromBlueprint(asset({ parentClass: 'UActorComponent' }), 'P').includes).toContain(
      'Components/ActorComponent.h',
    );
  });

  it('emits UPROPERTY blocks with specifiers derived from the variable flags', () => {
    const result = generateCppFromBlueprint(
      asset({
        variables: [
          variable({
            name: 'Health',
            type: 'float',
            isExposedToEditor: true,
            category: 'Stats',
            defaultValue: '100.f',
            tooltip: 'Current HP',
          }),
        ],
      }),
      'P',
    );
    expect(result.headerCode).toContain('/** Current HP */');
    expect(result.headerCode).toContain('UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stats")');
    expect(result.headerCode).toContain('float Health = 100.f;');
  });

  it('emits a Replicated specifier, networking scaffolding, and the UnrealNetwork include for replicated vars', () => {
    const result = generateCppFromBlueprint(
      asset({ variables: [variable({ name: 'Ammo', type: 'int', isReplicated: true })] }),
      'P',
    );
    expect(result.replication.hasReplication).toBe(true);
    expect(result.headerCode).toContain('UPROPERTY(Replicated, BlueprintReadWrite)');
    expect(result.headerCode).toContain('GetLifetimeReplicatedProps');
    expect(result.sourceCode).toContain('#include "Net/UnrealNetwork.h"');
    expect(result.sourceCode).toContain('DOREPLIFETIME(ATest, Ammo);');
  });

  it('declares and defines a function from its entry/result nodes', () => {
    const result = generateCppFromBlueprint(
      asset({
        functions: [
          graph({
            name: 'Get Score',
            nodes: [
              node({
                id: 'result',
                type: 'K2Node_FunctionResult',
                pins: [pin({ name: 'Out', type: 'int', direction: 'input' })],
              }),
            ],
          }),
        ],
      }),
      'P',
    );
    // whitespace stripped from the function name
    expect(result.headerCode).toContain('int32 GetScore();');
    expect(result.sourceCode).toContain('int32 ATest::GetScore()');
    expect(result.sourceCode).toContain('return int32();');
    expect(result.functionCount).toBe(1);
  });

  it('overrides BeginPlay and turns on tick only when a Tick event is present', () => {
    const withTick = generateCppFromBlueprint(
      asset({
        eventGraph: {
          name: 'EventGraph',
          graphType: 'event',
          nodes: [
            node({ id: 'e1', type: 'K2Node_Event', name: 'BeginPlay', memberName: 'BeginPlay' }),
            node({ id: 'e2', type: 'K2Node_Event', name: 'Tick', memberName: 'Tick' }),
          ],
        },
      }),
      'P',
    );
    expect(withTick.headerCode).toContain('virtual void BeginPlay() override;');
    expect(withTick.headerCode).toContain('virtual void Tick(float DeltaTime) override;');
    expect(withTick.sourceCode).toContain('PrimaryActorTick.bCanEverTick = true;');

    const noTick = generateCppFromBlueprint(asset(), 'P');
    expect(noTick.sourceCode).toContain('PrimaryActorTick.bCanEverTick = false;');
  });

  it('warns on an unknown event override', () => {
    const result = generateCppFromBlueprint(
      asset({
        eventGraph: {
          name: 'EventGraph',
          graphType: 'event',
          nodes: [node({ id: 'e1', type: 'K2Node_Event', name: 'Mystery', memberName: 'Mystery' })],
        },
      }),
      'P',
    );
    expect(result.warnings.some((w) => w.message.includes('Unknown event: Mystery'))).toBe(true);
  });

  it('counts nodes across the event graph and function graphs', () => {
    const result = generateCppFromBlueprint(
      asset({
        eventGraph: {
          name: 'EventGraph',
          graphType: 'event',
          nodes: [node({ id: 'e1', type: 'K2Node_Event', name: 'BeginPlay', memberName: 'BeginPlay' })],
        },
        functions: [graph({ name: 'F', nodes: [node({ id: 'n1', type: 'K2Node_CallFunction' })] })],
      }),
      'P',
    );
    expect(result.nodeCount).toBe(2);
  });
});

// ─── generateNodeLogic ────────────────────────────────────────────────────────

describe('generateNodeLogic', () => {
  it('emits a qualified function call following the exec chain from an event', () => {
    const start = node({
      id: 'evt',
      type: 'K2Node_Event',
      pins: [pin({ name: 'then', type: 'exec', direction: 'output', linkedTo: ['call'] })],
    });
    const call = node({
      id: 'call',
      type: 'K2Node_CallFunction',
      memberName: 'ApplyDamage',
      memberParent: 'UGameplayStatics',
      pins: [pin({ name: 'Amount', type: 'float', direction: 'input', defaultValue: '5' })],
    });
    const warnings: TranspileWarning[] = [];
    const code = generateNodeLogic({ nodes: [start, call] }, start, 'AFoo', warnings);
    expect(code).toContain('UGameplayStatics::ApplyDamage(5);');
    expect(warnings).toHaveLength(0);
  });

  it('generates an if/else block for a branch node', () => {
    const branch = node({
      id: 'br',
      type: 'K2Node_IfThenElse',
      pins: [
        pin({ name: 'Condition', type: 'bool', direction: 'input', defaultValue: 'bIsAlive' }),
        pin({ name: 'Then', type: 'exec', direction: 'output', linkedTo: ['t'] }),
        pin({ name: 'Else', type: 'exec', direction: 'output', linkedTo: ['e'] }),
      ],
    });
    // Branch targets are located via `n.pins.some(p => ... || n.id === id)`, so a
    // pinless node is never matched — real exec targets always carry an exec pin.
    const thenNode = node({
      id: 't',
      type: 'K2Node_CallFunction',
      memberName: 'Win',
      pins: [pin({ name: 'exec', type: 'exec', direction: 'input' })],
    });
    const elseNode = node({
      id: 'e',
      type: 'K2Node_CallFunction',
      memberName: 'Lose',
      pins: [pin({ name: 'exec', type: 'exec', direction: 'input' })],
    });
    const code = generateNodeLogic({ nodes: [branch, thenNode, elseNode] }, branch, 'AFoo', []);
    expect(code).toContain('if (bIsAlive)');
    expect(code).toContain('Win();');
    expect(code).toContain('else');
    expect(code).toContain('Lose();');
  });

  it('emits an assignment for a VariableSet node', () => {
    const set = node({
      id: 's',
      type: 'K2Node_VariableSet',
      memberName: 'Score',
      pins: [pin({ name: 'NewValue', type: 'int', direction: 'input', defaultValue: '42' })],
    });
    expect(generateNodeLogic({ nodes: [set] }, set, 'AFoo', [])).toContain('Score = 42;');
  });

  it('warns and stubs a SpawnActor node', () => {
    const spawn = node({ id: 'sp', type: 'K2Node_SpawnActorFromClass', pins: [] });
    const warnings: TranspileWarning[] = [];
    const code = generateNodeLogic({ nodes: [spawn] }, spawn, 'AFoo', warnings);
    expect(code).toContain('// TODO: SpawnActor');
    expect(warnings[0].message).toContain('SpawnActor requires manual completion');
  });

  it('emits a UE_LOG for a PrintString node', () => {
    // A real PrintString is a CallFunction caught by the first branch; the UE_LOG
    // path fires only for a node whose type itself contains "PrintString".
    const print = node({
      id: 'p',
      type: 'K2Node_PrintString',
      pins: [pin({ name: 'InString', type: 'string', direction: 'input', defaultValue: 'Hello' })],
    });
    expect(generateNodeLogic({ nodes: [print] }, print, 'AFoo', [])).toContain(
      'UE_LOG(LogTemp, Log, TEXT("Hello"));',
    );
  });

  it('leaves a TODO + info warning for an unrecognised node type', () => {
    const unknown = node({ id: 'u', type: 'K2Node_Timeline', name: 'MyTimeline', pins: [] });
    const warnings: TranspileWarning[] = [];
    const code = generateNodeLogic({ nodes: [unknown] }, unknown, 'AFoo', warnings);
    expect(code).toContain('// TODO: [K2Node_Timeline] MyTimeline');
    expect(warnings[0].severity).toBe('info');
  });

  it('returns a placeholder body when nothing is emitted', () => {
    const evt = node({ id: 'evt', type: 'K2Node_Event', pins: [] });
    expect(generateNodeLogic({ nodes: [evt] }, evt, 'AFoo', [])).toBe('\t// TODO: Implement logic');
  });
});
