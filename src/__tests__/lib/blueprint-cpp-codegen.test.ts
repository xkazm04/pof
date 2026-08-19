import { describe, it, expect } from 'vitest';
import {
  deriveFunctionSignature,
  describeTranspileFidelity,
  generateCppFromBlueprint,
  generateNodeLogic,
  renderPinLiteral,
} from '@/lib/blueprint-cpp-codegen';
import { parseBlueprintJson } from '@/lib/blueprint-parser';
import { SAMPLE_BLUEPRINT } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/constants';
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

// ─── UHT validity of the emitted header (bp-header-uht-valid) ─────────────────
//
// Everything below is a property the Unreal Header Tool enforces *before* a
// single line of the user's logic is compiled. A header that violates one of
// them breaks the build the moment Write to Project lands it on disk, so each
// case asserts the emitted text directly rather than a summary field.

/** Every `#include "..."` line of a header, in emission order. */
function includeLines(header: string): string[] {
  return header
    .split('\n')
    .filter((l) => l.startsWith('#include '))
    .map((l) => l.replace(/^#include\s+"(.*)"$/, '$1'));
}

/** Every `virtual <ret> <Name>(<params>) override;` declared in a header. */
function declaredOverrides(header: string): { name: string; params: string }[] {
  const out: { name: string; params: string }[] = [];
  for (const m of header.matchAll(/virtual\s+[\w:<>*&\s]+?\s(\w+)\(([^)]*)\)\s*(?:const\s*)?override\s*;/g)) {
    out.push({ name: m[1], params: m[2] });
  }
  return out;
}

describe('generateCppFromBlueprint — UHT header validity', () => {
  it('emits the .generated.h include LAST (UHT rejects any include after it)', () => {
    const result = generateCppFromBlueprint(
      asset({ className: 'BP_PlayerCharacter', parentClass: 'ACharacter' }),
      'MyProject',
    );
    const lines = includeLines(result.headerCode);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[lines.length - 1]).toBe('APlayerCharacter.generated.h');
    // The reported include list mirrors the emitted order, so a consumer that
    // rebuilds the header from `includes` cannot reintroduce the defect.
    expect(result.includes[result.includes.length - 1]).toBe('APlayerCharacter.generated.h');
  });

  it('derives a legal API macro from a project name that is not a C++ identifier', () => {
    const result = generateCppFromBlueprint(asset({ className: 'BP_Hero' }), 'My Game');
    const macro = result.headerCode.match(/class\s+(\S+)\s+AHero/)?.[1];
    expect(macro).toBe('MYGAME_API');
    expect(macro).toMatch(/^[A-Z_][A-Z0-9_]*_API$/);
    // …and says so, because MYGAME_API only exists if the module is named MyGame.
    expect(result.warnings.some((w) => w.message.includes('My Game'))).toBe(true);
  });

  it('prefixes a component Blueprint with U, not A', () => {
    const result = generateCppFromBlueprint(
      asset({ className: 'BP_Health', parentClass: 'UActorComponent' }),
      'P',
    );
    expect(result.className).toBe('UHealth');
    expect(result.headerCode).toContain('class P_API UHealth : public UActorComponent');
    expect(result.headerCode).not.toContain('AHealth');
  });

  it('flags an explicit class prefix that disagrees with the parent kind', () => {
    const result = generateCppFromBlueprint(
      asset({ className: 'AHealthComponent', parentClass: 'UActorComponent' }),
      'P',
    );
    expect(result.warnings.some((w) => w.severity === 'error' && w.message.includes('AHealthComponent'))).toBe(true);
  });

  it('defines EVERY override it declares (an undefined override is an unresolved external)', () => {
    const result = generateCppFromBlueprint(
      asset({
        className: 'BP_Hero',
        parentClass: 'ACharacter',
        eventGraph: {
          name: 'EventGraph',
          graphType: 'event',
          nodes: [
            node({ id: 'e1', type: 'K2Node_Event', name: 'BeginPlay', memberName: 'BeginPlay' }),
            node({ id: 'e2', type: 'K2Node_Event', name: 'Tick', memberName: 'Tick' }),
            node({ id: 'e3', type: 'K2Node_Event', name: 'EndPlay', memberName: 'EndPlay' }),
          ],
        },
      }),
      'P',
    );
    const overrides = declaredOverrides(result.headerCode);
    expect(overrides.map((o) => o.name).sort()).toEqual(['BeginPlay', 'EndPlay', 'Tick']);
    for (const o of overrides) {
      expect(result.sourceCode).toContain(`void AHero::${o.name}(${o.params})`);
    }
    expect(result.sourceCode).toContain('Super::EndPlay(EndPlayReason);');
  });

  it('uses the component tick override + tick struct for a UActorComponent', () => {
    const result = generateCppFromBlueprint(
      asset({
        className: 'BP_Health',
        parentClass: 'UActorComponent',
        eventGraph: {
          name: 'EventGraph',
          graphType: 'event',
          nodes: [node({ id: 'e1', type: 'K2Node_Event', name: 'Tick', memberName: 'Tick' })],
        },
      }),
      'P',
    );
    expect(result.headerCode).toContain(
      'virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;',
    );
    expect(result.sourceCode).toContain('PrimaryComponentTick.bCanEverTick = true;');
    expect(result.sourceCode).not.toContain('PrimaryActorTick');
    for (const o of declaredOverrides(result.headerCode)) {
      expect(result.sourceCode).toContain(`void UHealth::${o.name}(${o.params})`);
    }
  });

  it('declares a repeated event override only once', () => {
    const result = generateCppFromBlueprint(
      asset({
        eventGraph: {
          name: 'EventGraph',
          graphType: 'event',
          nodes: [
            node({ id: 'e1', type: 'K2Node_Event', name: 'BeginPlay', memberName: 'BeginPlay' }),
            node({ id: 'e2', type: 'K2Node_Event', name: 'ReceiveBeginPlay', memberName: 'ReceiveBeginPlay' }),
          ],
        },
      }),
      'P',
    );
    const decls = result.headerCode.split('\n').filter((l) => l.includes('virtual void BeginPlay()'));
    expect(decls).toHaveLength(1);
    const defs = result.sourceCode.split('\n').filter((l) => l.startsWith('void ATest::BeginPlay('));
    expect(defs).toHaveLength(1);
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

  // RE-BASELINED (bp-body-fabrication): the fixture used to hand the Condition
  // pin `defaultValue: 'bIsAlive'` — an identifier posing as a bool literal,
  // which a real export never produces (a bool pin's default is "true"/"false";
  // anything else arrives over a link). The condition is now read from a real
  // connected VariableGet, which is where `bIsAlive` genuinely comes from, so
  // the assertions below are unchanged and are now backed by real graph data.
  it('generates an if/else block for a branch node', () => {
    const branch = node({
      id: 'br',
      type: 'K2Node_IfThenElse',
      pins: [
        pin({ name: 'Condition', type: 'bool', direction: 'input', linkedTo: ['cond'] }),
        pin({ name: 'Then', type: 'exec', direction: 'output', linkedTo: ['t'] }),
        pin({ name: 'Else', type: 'exec', direction: 'output', linkedTo: ['e'] }),
      ],
    });
    const cond = node({ id: 'cond', type: 'K2Node_VariableGet', name: 'Get bIsAlive', memberName: 'bIsAlive' });
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
    const code = generateNodeLogic({ nodes: [branch, cond, thenNode, elseNode] }, branch, 'AFoo', []);
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
    // RE-BASELINED COMMENT (bp-body-fabrication): this used to read "a real
    // PrintString is a CallFunction caught by the first branch; the UE_LOG path
    // fires only for a node whose type itself contains PrintString" — i.e. the
    // branch was green only because the fixture was shaped to reach it. The
    // PrintString translation now runs BEFORE the generic CallFunction branch,
    // so the real export shape reaches it too (asserted in "refuses to
    // fabricate" below). This case is kept as a preserved-behaviour pin for the
    // K2Node_PrintString spelling.
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

  // ── Multi-node exec chains (regression for the pin-id-vs-node-id traversal bug) ──
  // Previously the walker matched `linkedTo` entries with
  // `graph.nodes.find(n => n.id === id || n.pins.some(p => p.name === id))`, which
  // only resolved node-id links by accident and dropped every statement past the
  // first node on a true pin-id-linked graph. Resolution now goes through the
  // parser's endpoint index, so both link conventions emit the WHOLE chain.

  it('emits statements from EVERY node in a 3-node chain linked by node ids', () => {
    const start = node({
      id: 'evt',
      type: 'K2Node_Event',
      pins: [pin({ name: 'then', type: 'exec', direction: 'output', linkedTo: ['a'] })],
    });
    const a = node({
      id: 'a',
      type: 'K2Node_CallFunction',
      memberName: 'StepOne',
      pins: [
        pin({ name: 'exec', type: 'exec', direction: 'input' }),
        pin({ name: 'then', type: 'exec', direction: 'output', linkedTo: ['b'] }),
      ],
    });
    const b = node({
      id: 'b',
      type: 'K2Node_CallFunction',
      memberName: 'StepTwo',
      pins: [
        pin({ name: 'exec', type: 'exec', direction: 'input' }),
        pin({ name: 'then', type: 'exec', direction: 'output', linkedTo: ['c'] }),
      ],
    });
    const c = node({
      id: 'c',
      type: 'K2Node_VariableSet',
      memberName: 'Done',
      pins: [
        pin({ name: 'exec', type: 'exec', direction: 'input' }),
        pin({ name: 'NewValue', type: 'bool', direction: 'input', defaultValue: 'true' }),
      ],
    });
    const code = generateNodeLogic({ nodes: [start, a, b, c] }, start, 'AFoo', []);
    expect(code).toContain('StepOne();');
    expect(code).toContain('StepTwo();');
    expect(code).toContain('Done = true;');
  });

  it('emits the whole chain when linkedTo holds PIN ids (real UE5 export shape — previously broken)', () => {
    // Each exec edge references the *input pin id* of the next node, exactly as a
    // UE5 commandlet export does. The owning node is found via the endpoint index.
    const start = node({
      id: 'evt',
      type: 'K2Node_Event',
      pins: [pin({ id: 'p-evt-out', name: 'then', type: 'exec', direction: 'output', linkedTo: ['p-a-in'] })],
    });
    const a = node({
      id: 'a',
      type: 'K2Node_CallFunction',
      memberName: 'StepOne',
      pins: [
        pin({ id: 'p-a-in', name: 'exec', type: 'exec', direction: 'input' }),
        pin({ id: 'p-a-out', name: 'then', type: 'exec', direction: 'output', linkedTo: ['p-b-in'] }),
      ],
    });
    const b = node({
      id: 'b',
      type: 'K2Node_CallFunction',
      memberName: 'StepTwo',
      pins: [pin({ id: 'p-b-in', name: 'exec', type: 'exec', direction: 'input' })],
    });
    const warnings: TranspileWarning[] = [];
    const code = generateNodeLogic({ nodes: [start, a, b] }, start, 'AFoo', warnings);
    expect(code).toContain('StepOne();');
    expect(code).toContain('StepTwo();'); // would be silently dropped before the fix
    expect(warnings).toHaveLength(0);
  });
});

// ─── Refusing to fabricate (bp-body-fabrication) ──────────────────────────────
//
// The walker used to build argument lists out of PIN NAMES, emit string
// defaults unquoted, and print `MemberParent` (a UE object path) verbatim as a
// C++ scope — none of it warned, so a fully invented body rendered as a clean
// transpile. Each case below asserts the walker now falls into the honest
// `// TODO` + warning path instead of guessing.

describe('generateNodeLogic — refuses to fabricate', () => {
  it('does not emit a connected input pin as an argument identifier', () => {
    const call = node({
      id: 'call',
      type: 'K2Node_CallFunction',
      name: 'Add',
      memberName: 'Add',
      pins: [
        pin({ id: 'p-in', name: 'exec', type: 'exec', direction: 'input' }),
        // Connected to a math node: the value is computed elsewhere, and the
        // pin's own name is not an expression.
        pin({ name: 'A', type: 'float', direction: 'input', linkedTo: ['math'] }),
      ],
    });
    const math = node({ id: 'math', type: 'K2Node_CommutativeAssociativeBinaryOperator', name: 'Multiply' });
    const warnings: TranspileWarning[] = [];
    const code = generateNodeLogic({ nodes: [call, math] }, call, 'AFoo', warnings);

    expect(code).not.toContain('Add(A);');
    expect(code).toContain('// TODO');
    expect(warnings.some((w) => w.nodeId === 'call')).toBe(true);
  });

  it('resolves a connected pin to the VARIABLE it reads, which is real graph data', () => {
    const call = node({
      id: 'call',
      type: 'K2Node_CallFunction',
      name: 'SetHealth',
      memberName: 'SetHealth',
      pins: [
        pin({ name: 'exec', type: 'exec', direction: 'input' }),
        pin({ name: 'NewValue', type: 'float', direction: 'input', linkedTo: ['get'] }),
      ],
    });
    const get = node({ id: 'get', type: 'K2Node_VariableGet', name: 'Get MaxHealth', memberName: 'MaxHealth' });
    const warnings: TranspileWarning[] = [];
    const code = generateNodeLogic({ nodes: [call, get] }, call, 'AFoo', warnings);
    expect(code).toContain('SetHealth(MaxHealth);');
    expect(warnings).toHaveLength(0);
  });

  it('never emits a Blueprint object path as a C++ scope', () => {
    const call = node({
      id: 'call',
      type: 'K2Node_CallFunction',
      name: 'PrintText',
      memberName: 'PrintText',
      memberParent: '/Script/Engine.KismetSystemLibrary',
      pins: [pin({ name: 'exec', type: 'exec', direction: 'input' })],
    });
    const warnings: TranspileWarning[] = [];
    const code = generateNodeLogic({ nodes: [call] }, call, 'AFoo', warnings);
    expect(code).not.toContain('/Script/Engine.KismetSystemLibrary::');
    expect(code).toContain('// TODO');
    expect(warnings[0].message).toContain('/Script/Engine.KismetSystemLibrary');
  });

  it('quotes a string default instead of emitting it as bare tokens', () => {
    const call = node({
      id: 'call',
      type: 'K2Node_CallFunction',
      name: 'SetLabel',
      memberName: 'SetLabel',
      pins: [
        pin({ name: 'exec', type: 'exec', direction: 'input' }),
        pin({ name: 'Label', type: 'string', direction: 'input', defaultValue: 'Player Spawned!' }),
      ],
    });
    const code = generateNodeLogic({ nodes: [call] }, call, 'AFoo', []);
    expect(code).toContain('SetLabel(TEXT("Player Spawned!"));');
  });

  it('refuses a VariableSet whose value is not a literal of the pin type', () => {
    const set = node({
      id: 's',
      type: 'K2Node_VariableSet',
      name: 'Set Health',
      memberName: 'Health',
      pins: [
        pin({ name: 'exec', type: 'exec', direction: 'input' }),
        pin({ name: 'Health', type: 'float', direction: 'input', defaultValue: 'Health - DamageAmount' }),
      ],
    });
    const warnings: TranspileWarning[] = [];
    const code = generateNodeLogic({ nodes: [set] }, set, 'AFoo', warnings);
    expect(code).not.toContain('Health = Health - DamageAmount;');
    expect(code).toContain('// TODO');
    expect(warnings).toHaveLength(1);
  });

  it('refuses a branch whose condition is not derivable, rather than inventing bCondition', () => {
    const branch = node({
      id: 'br',
      type: 'K2Node_IfThenElse',
      name: 'Branch',
      pins: [
        pin({ name: 'Condition', type: 'bool', direction: 'input', linkedTo: ['cmp'] }),
        pin({ name: 'Then', type: 'exec', direction: 'output', linkedTo: ['t'] }),
      ],
    });
    const cmp = node({ id: 'cmp', type: 'K2Node_CallFunction', name: 'Less', memberName: 'Less' });
    const thenNode = node({
      id: 't',
      type: 'K2Node_CallFunction',
      memberName: 'Win',
      pins: [pin({ name: 'exec', type: 'exec', direction: 'input' })],
    });
    const warnings: TranspileWarning[] = [];
    const code = generateNodeLogic({ nodes: [branch, cmp, thenNode] }, branch, 'AFoo', warnings);
    expect(code).not.toContain('bCondition');
    expect(code).not.toContain('if (');
    // Nothing gated behind an unresolved condition is emitted — running it
    // unconditionally would be a wrong answer dressed as a translation.
    expect(code).not.toContain('Win();');
    expect(warnings.some((w) => w.nodeId === 'br')).toBe(true);
  });

  it('translates a real UE-export PrintString (a CallFunction, not a K2Node_PrintString)', () => {
    const print = node({
      id: 'p',
      type: 'K2Node_CallFunction',
      name: 'PrintString',
      memberName: 'PrintString',
      pins: [
        pin({ name: 'exec', type: 'exec', direction: 'input' }),
        pin({ name: 'InString', type: 'string', direction: 'input', defaultValue: 'Player Spawned!' }),
      ],
    });
    const code = generateNodeLogic({ nodes: [print] }, print, 'AFoo', []);
    expect(code).toContain('UE_LOG(LogTemp, Log, TEXT("Player Spawned!"));');
    expect(code).not.toContain('PrintString(');
  });

  it('refuses a PrintString whose text is connected instead of printing a bare %s', () => {
    const print = node({
      id: 'p',
      type: 'K2Node_CallFunction',
      name: 'PrintString',
      memberName: 'PrintString',
      pins: [
        pin({ name: 'exec', type: 'exec', direction: 'input' }),
        pin({ name: 'InString', type: 'string', direction: 'input', linkedTo: ['src'] }),
      ],
    });
    const src = node({ id: 'src', type: 'K2Node_CallFunction', name: 'Format', memberName: 'Format' });
    const warnings: TranspileWarning[] = [];
    const code = generateNodeLogic({ nodes: [print, src] }, print, 'AFoo', warnings);
    expect(code).not.toContain('TEXT("%s")');
    expect(code).toContain('// TODO');
    expect(warnings).toHaveLength(1);
  });
});

describe('renderPinLiteral', () => {
  it('quotes string/text/name pins and escapes embedded quotes', () => {
    expect(renderPinLiteral({ name: 'S', type: 'string', direction: 'input', defaultValue: 'a "b"' }))
      .toEqual({ ok: true, code: 'TEXT("a \\"b\\"")' });
  });

  it('accepts bool and numeric literals but not identifiers posing as them', () => {
    expect(renderPinLiteral({ name: 'B', type: 'bool', direction: 'input', defaultValue: 'true' }).ok).toBe(true);
    expect(renderPinLiteral({ name: 'B', type: 'bool', direction: 'input', defaultValue: 'bIsAlive' }).ok).toBe(false);
    expect(renderPinLiteral({ name: 'N', type: 'float', direction: 'input', defaultValue: '1.5' }).ok).toBe(true);
    expect(renderPinLiteral({ name: 'N', type: 'float', direction: 'input', defaultValue: 'Speed * 2' }).ok).toBe(false);
  });

  it('refuses a connected pin even when it carries a stale default', () => {
    const r = renderPinLiteral({ name: 'X', type: 'float', direction: 'input', defaultValue: '0', linkedTo: ['n'] });
    expect(r.ok).toBe(false);
  });
});

describe('describeTranspileFidelity', () => {
  it('derives translated/TODO counts from the warning list, not a constant', () => {
    const f = describeTranspileFidelity({
      nodeCount: 5,
      warnings: [
        { nodeId: 'n2', message: 'x', severity: 'info' },
        { nodeId: 'n2', message: 'y', severity: 'info' },   // same node, counted once
        { message: 'module warning', severity: 'warning' }, // no node, not a TODO
      ],
    });
    expect(f.total).toBe(5);
    expect(f.todo).toBe(1);
    expect(f.translated).toBe(4);
    expect(f.label).toBe('4 of 5 nodes translated · 1 left as TODO');
  });

  it('reports a fully translated graph without a TODO clause', () => {
    expect(describeTranspileFidelity({ nodeCount: 3, warnings: [] }).label)
      .toBe('3 of 3 nodes translated');
  });
});

describe('the shipped sample transpiles honestly', () => {
  const result = generateCppFromBlueprint(parseBlueprintJson(SAMPLE_BLUEPRINT), 'PoF');

  it('never emits the fabricated `PrintString(Player Spawned!);`', () => {
    expect(result.sourceCode).not.toContain('PrintString(Player Spawned!)');
    expect(result.sourceCode).toContain('UE_LOG(LogTemp, Log, TEXT("Player Spawned!"));');
  });

  it('reports a non-zero warning count for the parts it did not translate', () => {
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(describeTranspileFidelity(result).todo).toBeGreaterThan(0);
  });
});

// ─── End-to-end: multi-node graph through the parser ──────────────────────────

describe('generateCppFromBlueprint — multi-node exec chains end-to-end', () => {
  it('transpiles the bundled-style BeginPlay chain so the PrintString call lands in BeginPlay()', () => {
    const result = generateCppFromBlueprint(
      asset({
        eventGraph: {
          name: 'EventGraph',
          graphType: 'event',
          nodes: [
            node({
              id: 'n1',
              type: 'K2Node_Event',
              name: 'BeginPlay',
              memberName: 'BeginPlay',
              pins: [pin({ name: 'exec', type: 'exec', direction: 'output', linkedTo: ['n2'] })],
            }),
            node({
              id: 'n2',
              type: 'K2Node_CallFunction',
              name: 'LogReady',
              memberName: 'LogReady',
              pins: [pin({ name: 'exec', type: 'exec', direction: 'input' })],
            }),
          ],
        },
      }),
      'P',
    );
    expect(result.sourceCode).toContain('void ATest::BeginPlay()');
    expect(result.sourceCode).toContain('Super::BeginPlay();');
    expect(result.sourceCode).toContain('LogReady();');
  });
});
