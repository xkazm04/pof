import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseBlueprintJson, summarizeBlueprintForPrompt, blueprintTypeToCpp } from '@/lib/blueprint-parser';
import type { TranspileResult, TranspileWarning, SemanticDiffResult, SemanticChange, BlueprintAsset } from '@/types/blueprint';

// ─── POST /api/blueprint-transpiler ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'parse':
        return handleParse(body.blueprintJson);

      case 'transpile':
        return handleTranspile(body.blueprintJson, body.projectName, body.moduleName);

      case 'diff':
        return handleDiff(body.blueprintJson, body.existingCpp, body.projectName);

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('Blueprint transpiler error:', error);
    return apiError(error instanceof Error ? error.message : 'Transpiler error');
  }
}

// ─── Parse Blueprint JSON ───────────────────────────────────────────────────

function handleParse(blueprintJson: string) {
  if (!blueprintJson) return apiError('blueprintJson is required', 400);

  try {
    const asset = parseBlueprintJson(blueprintJson);
    return apiSuccess({
      asset,
      summary: summarizeBlueprintForPrompt(asset),
    });
  } catch (e) {
    return apiError(`Failed to parse Blueprint JSON: ${e instanceof Error ? e.message : 'Parse error'}`, 400);
  }
}

// ─── Transpile to C++ ───────────────────────────────────────────────────────

function handleTranspile(
  blueprintJson: string,
  projectName?: string,
  moduleName?: string,
) {
  if (!blueprintJson) return apiError('blueprintJson is required', 400);

  try {
    const asset = parseBlueprintJson(blueprintJson);
    const result = generateCppFromBlueprint(asset, projectName ?? 'MyProject', moduleName);
    return apiSuccess(result);
  } catch (e) {
    return apiError(`Transpilation failed: ${e instanceof Error ? e.message : 'Error'}`, 400);
  }
}

// ─── Semantic Diff ──────────────────────────────────────────────────────────

function handleDiff(
  blueprintJson: string,
  existingCpp: string,
  projectName?: string,
) {
  if (!blueprintJson) return apiError('blueprintJson is required', 400);
  if (!existingCpp) return apiError('existingCpp is required', 400);

  try {
    const asset = parseBlueprintJson(blueprintJson);
    const result = computeSemanticDiff(asset, existingCpp, projectName ?? 'MyProject');
    return apiSuccess(result);
  } catch (e) {
    return apiError(`Diff failed: ${e instanceof Error ? e.message : 'Error'}`, 400);
  }
}

// ─── C++ Generation ─────────────────────────────────────────────────────────

function generateCppFromBlueprint(
  asset: BlueprintAsset,
  projectName: string,
  moduleName?: string,
): TranspileResult {
  const warnings: TranspileWarning[] = [];
  const mod = moduleName ?? projectName;
  const apiMacro = `${mod.toUpperCase()}_API`;

  // Strip BP_ prefix for C++ class name
  const cppClassName = asset.className.startsWith('BP_')
    ? `A${asset.className.slice(3)}`
    : asset.className.startsWith('A') || asset.className.startsWith('U')
      ? asset.className
      : `A${asset.className}`;

  const parentClass = asset.parentClass;
  const includes = new Set<string>(['CoreMinimal.h', `${cppClassName}.generated.h`]);

  // Determine parent include
  if (parentClass === 'ACharacter' || parentClass === 'Character') {
    includes.add('GameFramework/Character.h');
  } else if (parentClass === 'APawn' || parentClass === 'Pawn') {
    includes.add('GameFramework/Pawn.h');
  } else if (parentClass === 'AActor' || parentClass === 'Actor') {
    includes.add('GameFramework/Actor.h');
  } else if (parentClass === 'UActorComponent' || parentClass.includes('Component')) {
    includes.add('Components/ActorComponent.h');
  }

  // ── Header generation ──

  const headerLines: string[] = [];
  headerLines.push('#pragma once');
  headerLines.push('');
  for (const inc of includes) {
    headerLines.push(`#include "${inc}"`);
  }
  headerLines.push('');
  headerLines.push(`UCLASS()`);
  headerLines.push(`class ${apiMacro} ${cppClassName} : public ${parentClass}`);
  headerLines.push('{');
  headerLines.push('\tGENERATED_BODY()');
  headerLines.push('');
  headerLines.push('public:');
  headerLines.push(`\t${cppClassName}();`);
  headerLines.push('');

  // Variables → UPROPERTY
  if (asset.variables.length > 0) {
    headerLines.push('\t// ── Properties ──');
    headerLines.push('');
    for (const v of asset.variables) {
      const cppType = blueprintTypeToCpp(v.type);
      const specifiers: string[] = [];
      if (v.isExposedToEditor) specifiers.push('EditAnywhere');
      if (v.isReplicated) specifiers.push('Replicated');
      specifiers.push('BlueprintReadWrite');
      if (v.category) specifiers.push(`Category = "${v.category}"`);

      if (v.tooltip) {
        headerLines.push(`\t/** ${v.tooltip} */`);
      }
      headerLines.push(`\tUPROPERTY(${specifiers.join(', ')})`);
      headerLines.push(`\t${cppType} ${v.name}${v.defaultValue ? ` = ${v.defaultValue}` : ''};`);
      headerLines.push('');
    }
  }

  // Functions → UFUNCTION
  const declaredFunctions: string[] = [];
  for (const fn of asset.functions) {
    const fnName = fn.name.replace(/\s+/g, '');
    declaredFunctions.push(fnName);

    // Determine return type and params from entry/result nodes
    const entryNode = fn.nodes.find((n) => n.type.includes('FunctionEntry'));
    const resultNode = fn.nodes.find((n) => n.type.includes('FunctionResult'));

    const params: string[] = [];
    if (entryNode) {
      for (const pin of entryNode.pins.filter((p) => p.direction === 'output' && p.type !== 'exec')) {
        params.push(`${blueprintTypeToCpp(pin.type)} ${pin.name}`);
      }
    }

    let returnType = 'void';
    if (resultNode) {
      const returnPin = resultNode.pins.find((p) => p.direction === 'input' && p.type !== 'exec');
      if (returnPin) returnType = blueprintTypeToCpp(returnPin.type);
    }

    headerLines.push(`\tUFUNCTION(BlueprintCallable, Category = "${asset.className}")`);
    headerLines.push(`\t${returnType} ${fnName}(${params.join(', ')});`);
    headerLines.push('');
  }

  // Event graph events → overrides
  const eventNodes = asset.eventGraph.nodes.filter((n) =>
    n.type.includes('Event') && !n.type.includes('Custom')
  );
  if (eventNodes.length > 0) {
    headerLines.push('protected:');
    headerLines.push('\t// ── Event Overrides ──');
    headerLines.push('');
    for (const ev of eventNodes) {
      const eventName = ev.memberName ?? ev.name;
      if (eventName === 'BeginPlay' || eventName === 'ReceiveBeginPlay') {
        headerLines.push('\tvirtual void BeginPlay() override;');
      } else if (eventName === 'Tick' || eventName === 'ReceiveTick') {
        headerLines.push('\tvirtual void Tick(float DeltaTime) override;');
      } else if (eventName === 'EndPlay') {
        headerLines.push('\tvirtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;');
      } else {
        headerLines.push(`\t// TODO: Override for ${eventName}`);
        warnings.push({ nodeId: ev.id, message: `Unknown event: ${eventName}`, severity: 'warning' });
      }
    }
    headerLines.push('');
  }

  // Custom events → UFUNCTION
  const customEvents = asset.eventGraph.nodes.filter((n) =>
    n.type.includes('CustomEvent') || n.type.includes('K2Node_Event_Custom')
  );
  if (customEvents.length > 0) {
    headerLines.push('public:');
    headerLines.push('\t// ── Custom Events ──');
    headerLines.push('');
    for (const ev of customEvents) {
      const evName = ev.memberName ?? ev.name;
      headerLines.push(`\tUFUNCTION(BlueprintCallable, Category = "Events")`);
      headerLines.push(`\tvoid ${evName}();`);
      headerLines.push('');
    }
  }

  headerLines.push('};');

  // ── Source generation ──

  const sourceLines: string[] = [];
  sourceLines.push(`#include "${cppClassName}.h"`);
  sourceLines.push('');
  sourceLines.push(`${cppClassName}::${cppClassName}()`);
  sourceLines.push('{');
  if (eventNodes.some((n) => (n.memberName ?? n.name).includes('Tick'))) {
    sourceLines.push('\tPrimaryActorTick.bCanEverTick = true;');
  } else {
    sourceLines.push('\tPrimaryActorTick.bCanEverTick = false;');
  }
  sourceLines.push('}');
  sourceLines.push('');

  // Event implementations
  for (const ev of eventNodes) {
    const eventName = ev.memberName ?? ev.name;
    if (eventName === 'BeginPlay' || eventName === 'ReceiveBeginPlay') {
      sourceLines.push(`void ${cppClassName}::BeginPlay()`);
      sourceLines.push('{');
      sourceLines.push('\tSuper::BeginPlay();');
      sourceLines.push('');
      sourceLines.push(generateNodeLogic(asset.eventGraph, ev, cppClassName, warnings));
      sourceLines.push('}');
    } else if (eventName === 'Tick' || eventName === 'ReceiveTick') {
      sourceLines.push(`void ${cppClassName}::Tick(float DeltaTime)`);
      sourceLines.push('{');
      sourceLines.push('\tSuper::Tick(DeltaTime);');
      sourceLines.push('');
      sourceLines.push(generateNodeLogic(asset.eventGraph, ev, cppClassName, warnings));
      sourceLines.push('}');
    }
    sourceLines.push('');
  }

  // Function implementations
  for (const fn of asset.functions) {
    const fnName = fn.name.replace(/\s+/g, '');
    const entryNode = fn.nodes.find((n) => n.type.includes('FunctionEntry'));
    const resultNode = fn.nodes.find((n) => n.type.includes('FunctionResult'));

    const params: string[] = [];
    if (entryNode) {
      for (const pin of entryNode.pins.filter((p) => p.direction === 'output' && p.type !== 'exec')) {
        params.push(`${blueprintTypeToCpp(pin.type)} ${pin.name}`);
      }
    }

    let returnType = 'void';
    if (resultNode) {
      const returnPin = resultNode.pins.find((p) => p.direction === 'input' && p.type !== 'exec');
      if (returnPin) returnType = blueprintTypeToCpp(returnPin.type);
    }

    sourceLines.push(`${returnType} ${cppClassName}::${fnName}(${params.join(', ')})`);
    sourceLines.push('{');
    if (entryNode) {
      sourceLines.push(generateNodeLogic(fn, entryNode, cppClassName, warnings));
    } else {
      sourceLines.push('\t// TODO: Implement function logic');
    }
    if (returnType !== 'void') {
      sourceLines.push(`\treturn ${returnType === 'bool' ? 'false' : returnType.includes('*') ? 'nullptr' : `${returnType}()`};`);
    }
    sourceLines.push('}');
    sourceLines.push('');
  }

  // Custom event implementations
  for (const ev of customEvents) {
    const evName = ev.memberName ?? ev.name;
    sourceLines.push(`void ${cppClassName}::${evName}()`);
    sourceLines.push('{');
    sourceLines.push(generateNodeLogic(asset.eventGraph, ev, cppClassName, warnings));
    sourceLines.push('}');
    sourceLines.push('');
  }

  return {
    headerCode: headerLines.join('\n'),
    sourceCode: sourceLines.join('\n'),
    className: cppClassName,
    parentClass,
    includes: [...includes],
    warnings,
    nodeCount: asset.eventGraph.nodes.length + asset.functions.reduce((s, f) => s + f.nodes.length, 0),
    functionCount: asset.functions.length + customEvents.length,
  };
}

// ─── Node Logic Generator ───────────────────────────────────────────────────

function generateNodeLogic(
  graph: { nodes: BlueprintAsset['eventGraph']['nodes'] },
  startNode: BlueprintAsset['eventGraph']['nodes'][0],
  _className: string,
  warnings: TranspileWarning[],
): string {
  const lines: string[] = [];
  const visited = new Set<string>();

  function walk(node: typeof startNode, indent: string) {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    // Find exec output pin
    const execOut = node.pins.find((p) => p.direction === 'output' && p.type === 'exec');
    const nextNodeIds = execOut?.linkedTo ?? [];

    // Generate code based on node type
    if (node.type.includes('CallFunction') && node.memberName) {
      const args = node.pins
        .filter((p) => p.direction === 'input' && p.type !== 'exec')
        .map((p) => p.defaultValue ?? p.name)
        .join(', ');
      const target = node.memberParent ? `${node.memberParent}::` : '';
      lines.push(`${indent}${target}${node.memberName}(${args});`);
    } else if (node.type.includes('IfThenElse')) {
      const condPin = node.pins.find((p) => p.direction === 'input' && p.name === 'Condition');
      const condExpr = condPin?.defaultValue ?? 'bCondition';
      const thenPin = node.pins.find((p) => p.direction === 'output' && p.name === 'Then');
      const elsePin = node.pins.find((p) => p.direction === 'output' && p.name === 'Else');

      lines.push(`${indent}if (${condExpr})`);
      lines.push(`${indent}{`);
      if (thenPin?.linkedTo) {
        for (const id of thenPin.linkedTo) {
          const next = graph.nodes.find((n) => n.pins.some((p) => p.name === id || n.id === id));
          if (next) walk(next, indent + '\t');
        }
      } else {
        lines.push(`${indent}\t// TODO: Then branch`);
      }
      lines.push(`${indent}}`);

      if (elsePin?.linkedTo && elsePin.linkedTo.length > 0) {
        lines.push(`${indent}else`);
        lines.push(`${indent}{`);
        for (const id of elsePin.linkedTo) {
          const next = graph.nodes.find((n) => n.pins.some((p) => p.name === id || n.id === id));
          if (next) walk(next, indent + '\t');
        }
        lines.push(`${indent}}`);
      }
      return; // Branch handles its own continuations
    } else if (node.type.includes('VariableSet') && node.memberName) {
      const valuePin = node.pins.find((p) => p.direction === 'input' && p.type !== 'exec' && p.name !== 'self');
      lines.push(`${indent}${node.memberName} = ${valuePin?.defaultValue ?? '/* value */'};`);
    } else if (node.type.includes('SpawnActor')) {
      lines.push(`${indent}// TODO: SpawnActor — use GetWorld()->SpawnActor<>()`);
      warnings.push({ nodeId: node.id, message: 'SpawnActor requires manual completion', severity: 'info' });
    } else if (node.type.includes('PrintString') || node.memberName === 'PrintString') {
      const textPin = node.pins.find((p) => p.direction === 'input' && (p.name === 'InString' || p.name === 'string'));
      lines.push(`${indent}UE_LOG(LogTemp, Log, TEXT("${textPin?.defaultValue ?? '%s'}"));`);
    } else if (!node.type.includes('Event') && !node.type.includes('FunctionEntry')) {
      lines.push(`${indent}// TODO: [${node.type}] ${node.name}${node.memberName ? ` — ${node.memberName}` : ''}`);
      warnings.push({ nodeId: node.id, message: `Node type "${node.type}" needs manual translation`, severity: 'info' });
    }

    // Follow exec chain
    for (const nextId of nextNodeIds) {
      const nextNode = graph.nodes.find((n) => n.id === nextId || n.pins.some((p) => p.name === nextId));
      if (nextNode) walk(nextNode, indent);
    }
  }

  walk(startNode, '\t');
  return lines.length > 0 ? lines.join('\n') : '\t// TODO: Implement logic';
}

// ─── Semantic Diff Engine ───────────────────────────────────────────────────

function computeSemanticDiff(
  asset: BlueprintAsset,
  existingCpp: string,
  _projectName: string,
): SemanticDiffResult {
  const changes: SemanticChange[] = [];
  let changeId = 0;

  // Extract function names from existing C++
  const cppFunctions = new Set<string>();
  const cppVariables = new Set<string>();
  const fnRegex = /(?:void|bool|int32|float|double|FString|FVector|FRotator|[A-Z]\w+\*?)\s+(\w+)\s*\(/g;
  const varRegex = /UPROPERTY\([^)]*\)\s*\n?\s*(\w+)\s+(\w+)/g;

  let match: RegExpExecArray | null;
  while ((match = fnRegex.exec(existingCpp)) !== null) {
    cppFunctions.add(match[1]);
  }
  while ((match = varRegex.exec(existingCpp)) !== null) {
    cppVariables.add(match[2]);
  }

  // Check Blueprint variables vs C++ variables
  for (const v of asset.variables) {
    if (cppVariables.has(v.name)) {
      // Both sides have it — check for type conflicts
      const typeInCpp = existingCpp.match(new RegExp(`(\\w+)\\s+${v.name}\\s*[;=]`));
      const expectedType = blueprintTypeToCpp(v.type);
      if (typeInCpp && typeInCpp[1] !== expectedType) {
        changes.push({
          id: `change-${changeId++}`,
          type: 'modify',
          scope: 'variable',
          name: v.name,
          description: `Type mismatch: Blueprint uses ${v.type} but C++ has ${typeInCpp[1]}`,
          blueprintSide: `${v.name}: ${v.type}`,
          cppSide: `${typeInCpp[1]} ${v.name}`,
          conflictLevel: 'conflict',
          resolution: `Update C++ type to ${expectedType}`,
        });
      }
    } else {
      changes.push({
        id: `change-${changeId++}`,
        type: 'add',
        scope: 'variable',
        name: v.name,
        description: `Variable "${v.name}" exists in Blueprint but not in C++`,
        blueprintSide: `${v.name}: ${v.type}`,
        conflictLevel: 'compatible',
        resolution: `Add UPROPERTY ${blueprintTypeToCpp(v.type)} ${v.name} to header`,
      });
    }
  }

  // Check for C++ variables not in Blueprint
  for (const cppVar of cppVariables) {
    if (!asset.variables.some((v) => v.name === cppVar)) {
      changes.push({
        id: `change-${changeId++}`,
        type: 'remove',
        scope: 'variable',
        name: cppVar,
        description: `Variable "${cppVar}" exists in C++ but not in Blueprint`,
        cppSide: cppVar,
        conflictLevel: 'compatible',
        resolution: 'Keep in C++ (may be C++-only property) or remove if migrated to Blueprint',
      });
    }
  }

  // Check Blueprint functions vs C++ functions
  for (const fn of asset.functions) {
    const fnName = fn.name.replace(/\s+/g, '');
    if (!cppFunctions.has(fnName)) {
      changes.push({
        id: `change-${changeId++}`,
        type: 'add',
        scope: 'function',
        name: fnName,
        description: `Function "${fnName}" exists in Blueprint but not in C++`,
        blueprintSide: `${fnName}() — ${fn.nodes.length} nodes`,
        conflictLevel: 'compatible',
        resolution: `Transpile function ${fnName} to C++`,
      });
    }
  }

  // Determine overall conflict level
  const hasConflict = changes.some((c) => c.conflictLevel === 'conflict');
  const hasCompatible = changes.some((c) => c.conflictLevel === 'compatible');

  return {
    changes,
    blueprintSummary: `${asset.className}: ${asset.variables.length} variables, ${asset.functions.length} functions, ${asset.eventGraph.nodes.length} event nodes`,
    cppSummary: `${cppFunctions.size} functions, ${cppVariables.size} properties detected`,
    overallConflict: hasConflict ? 'conflict' : hasCompatible ? 'compatible' : 'none',
    timestamp: Date.now(),
  };
}
