/**
 * Blueprint → C++ Codegen
 *
 * Turns a parsed `BlueprintAsset` into UE5 C++ header + source code. This is the
 * pure, side-effect-free core behind the `transpile` action of
 * `/api/blueprint-transpiler`: given a Blueprint graph it derives the class
 * declaration (UPROPERTY/UFUNCTION, event overrides, custom events), the
 * matching source definitions, and a best-effort translation of node graphs into
 * C++ statement bodies.
 *
 * Replication scaffolding (GetLifetimeReplicatedProps, ReplicatedUsing,
 * OnRep handlers) is delegated to `replication-scaffolder.ts`. Keeping this
 * module free of React/I/O so it can be unit-tested directly and reused outside
 * the HTTP route — mirroring how `replication-scaffolder.ts` is kept pure.
 */

import { blueprintTypeToCpp, buildEndpointIndex } from '@/lib/blueprint-parser';
import {
  REPLICATION_INCLUDE,
  buildReplicationInfo,
  replicationSpecifier,
  lifetimeReplicatedPropsDeclaration,
  lifetimeReplicatedPropsDefinition,
  onRepDeclarations,
  onRepDefinitions,
} from '@/lib/replication-scaffolder';
import type {
  TranspileResult,
  TranspileWarning,
  BlueprintAsset,
  BlueprintGraph,
  BlueprintNode,
} from '@/types/blueprint';

/**
 * Derive the C++ parameter list and return type for a Blueprint function from
 * its entry/result nodes. Shared by both the header and source passes so their
 * signatures can never drift apart. Also returns the entry node, which the
 * source pass needs to generate the function body.
 */
export function deriveFunctionSignature(fn: BlueprintGraph): {
  params: string[];
  returnType: string;
  entryNode: BlueprintNode | undefined;
} {
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

  return { params, returnType, entryNode };
}

export function generateCppFromBlueprint(
  asset: BlueprintAsset,
  projectName: string,
  moduleName?: string,
): TranspileResult {
  const warnings: TranspileWarning[] = [];
  const mod = moduleName ?? projectName;
  const apiMacro = `${mod.toUpperCase()}_API`;

  // Replication scaffolding — drives the GetLifetimeReplicatedProps body,
  // the ReplicatedUsing specifiers, OnRep handlers, and the UnrealNetwork include.
  const replication = buildReplicationInfo(asset);
  const repProps = replication.properties;

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
      if (v.isReplicated) specifiers.push(replicationSpecifier({ name: v.name, repNotify: v.isRepNotify }));
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
    const { params, returnType } = deriveFunctionSignature(fn);

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

  // ── Networking / replication ──
  if (replication.hasReplication) {
    headerLines.push('public:');
    headerLines.push('\t// ── Networking ──');
    headerLines.push(`\t${lifetimeReplicatedPropsDeclaration()}`);
    headerLines.push('');

    const onRepDecls = onRepDeclarations(repProps);
    if (onRepDecls.length > 0) {
      headerLines.push('protected:');
      headerLines.push('\t// ── RepNotify Handlers ──');
      for (const line of onRepDecls) {
        headerLines.push(`\t${line}`);
      }
      headerLines.push('');
    }
  }

  headerLines.push('};');

  // ── Source generation ──

  const sourceLines: string[] = [];
  sourceLines.push(`#include "${cppClassName}.h"`);
  // DOREPLIFETIME macros live in Net/UnrealNetwork.h — mandatory for replicated classes.
  if (replication.hasReplication) sourceLines.push(`#include "${REPLICATION_INCLUDE}"`);
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
    const { params, returnType, entryNode } = deriveFunctionSignature(fn);

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

  // Replication: GetLifetimeReplicatedProps + OnRep handler bodies.
  if (replication.hasReplication) {
    sourceLines.push(lifetimeReplicatedPropsDefinition(cppClassName, repProps));
    sourceLines.push('');
    for (const def of onRepDefinitions(cppClassName, repProps)) {
      sourceLines.push(def);
      sourceLines.push('');
    }
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
    replication,
  };
}

// ─── Node Logic Generator ───────────────────────────────────────────────────

/**
 * Walk a Blueprint exec chain from `startNode` and emit a best-effort C++
 * statement body. Unrecognised node types become `// TODO` comments plus an
 * info-level warning so nothing is silently dropped.
 */
export function generateNodeLogic(
  graph: { nodes: BlueprintNode[] },
  startNode: BlueprintNode,
  _className: string,
  warnings: TranspileWarning[],
): string {
  const lines: string[] = [];
  const visited = new Set<string>();

  // Resolve every exec-edge endpoint (pin id *or* node id) to its owning node
  // in O(1). `linkedTo` holds pin ids in UE5 commandlet exports and node ids in
  // the bundled samples; the index registers both, so traversal is correct for
  // either and O(N+E) overall instead of the old per-edge O(N·pins) scan.
  const endpointIndex = buildEndpointIndex(graph.nodes);

  function walk(node: BlueprintNode, indent: string) {
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
          const next = endpointIndex.get(id);
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
          const next = endpointIndex.get(id);
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
      const nextNode = endpointIndex.get(nextId);
      if (nextNode) walk(nextNode, indent);
    }
  }

  walk(startNode, '\t');
  return lines.length > 0 ? lines.join('\n') : '\t// TODO: Implement logic';
}
