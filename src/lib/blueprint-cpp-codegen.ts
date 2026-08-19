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
  BlueprintPin,
} from '@/types/blueprint';

/** A C++ identifier — anything else cannot appear as a name, scope, or macro. */
const CPP_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Sanitize a project/module name into a UE C++ module identifier.
 *
 * `projectName` is raw user text (Project Setup allows spaces), and it feeds
 * the `<MODULE>_API` macro. `"My Game"` used to emit `class MY GAME_API AFoo` —
 * a header that no compiler accepts. This is the single source of truth for the
 * identifier; the write modal's default module name uses it too, so the macro
 * and the `Source/<Module>/` directory are derived from the same rule.
 */
export function sanitizeModuleName(name: string): string {
  const cleaned = (name || '').replace(/[^A-Za-z0-9_]/g, '');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : 'Game';
}

/** The DLL-export macro a module's classes must be declared with. */
export function apiMacroFor(moduleName: string): string {
  return `${sanitizeModuleName(moduleName).toUpperCase()}_API`;
}

/**
 * A UE engine event this transpiler knows how to override, resolved to the ONE
 * signature used by both the declaration and the definition.
 *
 * The header used to declare `EndPlay` while the source pass only ever defined
 * `BeginPlay`/`Tick` — a declared-but-undefined override is an unresolved
 * external at link time. Both passes now walk the same resolved list, so a
 * declaration without a definition is structurally impossible.
 */
export interface EventOverride {
  /** C++ member name. `Tick` becomes `TickComponent` on a UActorComponent. */
  name: string;
  /** Parameter list, identical in the declaration and the definition. */
  params: string;
  /** Argument list for the `Super::` call in the definition body. */
  args: string;
}

export function resolveEventOverride(eventName: string, isComponent = false): EventOverride | null {
  // UE names the Blueprint-side node `ReceiveBeginPlay`; the C++ override is `BeginPlay`.
  switch (eventName.replace(/^Receive/, '')) {
    case 'BeginPlay':
      return { name: 'BeginPlay', params: '', args: '' };
    case 'Tick':
      return isComponent
        ? {
            name: 'TickComponent',
            params: 'float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction',
            args: 'DeltaTime, TickType, ThisTickFunction',
          }
        : { name: 'Tick', params: 'float DeltaTime', args: 'DeltaTime' };
    case 'EndPlay':
      return { name: 'EndPlay', params: 'const EEndPlayReason::Type EndPlayReason', args: 'EndPlayReason' };
    default:
      return null;
  }
}

export function overrideDeclaration(o: EventOverride): string {
  return `virtual void ${o.name}(${o.params}) override;`;
}

export function overrideDefinitionSignature(cppClassName: string, o: EventOverride): string {
  return `void ${cppClassName}::${o.name}(${o.params})`;
}

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
  const requestedModule = moduleName ?? projectName;
  const mod = sanitizeModuleName(requestedModule);
  const apiMacro = apiMacroFor(requestedModule);
  if (mod !== requestedModule) {
    warnings.push({
      message: `Module name "${requestedModule}" is not a C++ identifier — the API macro was emitted as ${apiMacro}. `
        + `That macro only exists if the module is named "${mod}"; set the module explicitly when writing to the project.`,
      severity: 'warning',
    });
  }

  // Replication scaffolding — drives the GetLifetimeReplicatedProps body,
  // the ReplicatedUsing specifiers, OnRep handlers, and the UnrealNetwork include.
  const replication = buildReplicationInfo(asset);
  const repProps = replication.properties;

  const parentClass = asset.parentClass;
  // UHT derives the required class prefix from the parent: UObject-rooted
  // (components included) take `U`, AActor-rooted take `A`. The old blanket `A`
  // emitted `AHealthComponent : public UActorComponent`, a prefix error, from
  // the same function that recognises components one branch later.
  const isComponent = parentClass === 'UActorComponent' || parentClass.includes('Component');
  const prefix = isComponent || parentClass.startsWith('U') ? 'U' : 'A';

  // Strip BP_ prefix for C++ class name
  const cppClassName = asset.className.startsWith('BP_')
    ? `${prefix}${asset.className.slice(3)}`
    : asset.className.startsWith('A') || asset.className.startsWith('U')
      ? asset.className
      : `${prefix}${asset.className}`;

  // An explicitly-prefixed source name we must not rewrite can still disagree
  // with the parent — say so rather than emitting a header UHT will reject.
  if (cppClassName[0] !== prefix) {
    warnings.push({
      message: `Class "${cppClassName}" carries a "${cppClassName[0]}" prefix but parent "${parentClass}" requires "${prefix}" — `
        + 'UHT rejects a mismatched class prefix. Rename the Blueprint or change its parent.',
      severity: 'error',
    });
  }

  const includes = new Set<string>(['CoreMinimal.h']);

  // Determine parent include
  if (parentClass === 'ACharacter' || parentClass === 'Character') {
    includes.add('GameFramework/Character.h');
  } else if (parentClass === 'APawn' || parentClass === 'Pawn') {
    includes.add('GameFramework/Pawn.h');
  } else if (parentClass === 'AActor' || parentClass === 'Actor') {
    includes.add('GameFramework/Actor.h');
  } else if (isComponent) {
    includes.add('Components/ActorComponent.h');
  }

  // `<Class>.generated.h` MUST be the final include — UHT errors on anything
  // after it, a rule this repo already prints a fix for in error-fingerprint.ts.
  // It is appended here (not seeded into the Set) so no later `includes.add`
  // can slip in behind it, and the reported `includes` list mirrors emission
  // order so a consumer rebuilding the header cannot reintroduce the defect.
  const emittedIncludes = [...includes, `${cppClassName}.generated.h`];

  // ── Header generation ──

  const headerLines: string[] = [];
  headerLines.push('#pragma once');
  headerLines.push('');
  for (const inc of emittedIncludes) {
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

  // Event graph events → overrides.
  //
  // Resolved ONCE here; the header declares and the source defines from this
  // same list, so every declaration is guaranteed a matching definition. A
  // repeated event (e.g. both `BeginPlay` and `ReceiveBeginPlay` present)
  // collapses to a single override — declaring it twice is a redefinition error.
  const eventNodes = asset.eventGraph.nodes.filter((n) =>
    n.type.includes('Event') && !n.type.includes('Custom')
  );
  const overrides: { override: EventOverride; node: BlueprintNode }[] = [];
  const unknownEvents: { name: string; node: BlueprintNode }[] = [];
  const seenOverrides = new Set<string>();
  for (const ev of eventNodes) {
    const eventName = ev.memberName ?? ev.name;
    const resolved = resolveEventOverride(eventName, isComponent);
    if (!resolved) {
      unknownEvents.push({ name: eventName, node: ev });
      continue;
    }
    if (seenOverrides.has(resolved.name)) {
      warnings.push({
        nodeId: ev.id,
        message: `Duplicate event "${eventName}" — ${resolved.name} is already overridden; this node's logic was not emitted.`,
        severity: 'warning',
      });
      continue;
    }
    seenOverrides.add(resolved.name);
    overrides.push({ override: resolved, node: ev });
  }

  if (overrides.length > 0 || unknownEvents.length > 0) {
    headerLines.push('protected:');
    headerLines.push('\t// ── Event Overrides ──');
    headerLines.push('');
    for (const { override } of overrides) {
      headerLines.push(`\t${overrideDeclaration(override)}`);
    }
    for (const unknown of unknownEvents) {
      headerLines.push(`\t// TODO: Override for ${unknown.name}`);
      warnings.push({ nodeId: unknown.node.id, message: `Unknown event: ${unknown.name}`, severity: 'warning' });
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
  // A UActorComponent has no PrimaryActorTick — its tick function is
  // PrimaryComponentTick, and naming the wrong one is a compile error.
  const tickField = isComponent ? 'PrimaryComponentTick' : 'PrimaryActorTick';
  const ticks = overrides.some((o) => o.override.name === 'Tick' || o.override.name === 'TickComponent');
  sourceLines.push(`\t${tickField}.bCanEverTick = ${ticks ? 'true' : 'false'};`);
  sourceLines.push('}');
  sourceLines.push('');

  // Event implementations — one per DECLARED override, from the same resolved
  // list the header used, so nothing can be declared without being defined.
  for (const { override, node: ev } of overrides) {
    sourceLines.push(overrideDefinitionSignature(cppClassName, override));
    sourceLines.push('{');
    sourceLines.push(`\tSuper::${override.name}(${override.args});`);
    sourceLines.push('');
    sourceLines.push(generateNodeLogic(asset.eventGraph, ev, cppClassName, warnings));
    sourceLines.push('}');
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
    includes: emittedIncludes,
    warnings,
    nodeCount: asset.eventGraph.nodes.length + asset.functions.reduce((s, f) => s + f.nodes.length, 0),
    functionCount: asset.functions.length + customEvents.length,
    replication,
  };
}

// ─── Node Logic Generator ───────────────────────────────────────────────────

/**
 * A pin's value rendered as C++, or the reason it could not be.
 *
 * The walker used to fall back to the PIN NAME when a pin had no literal, which
 * produced identifiers that exist nowhere. Every value now goes through this
 * type, and a `false` result routes the whole node into the honest `// TODO` +
 * warning path instead of guessing.
 */
export type PinExpression = { ok: true; code: string } | { ok: false; reason: string };

/** Matches a C++ numeric literal (including the UE `f` suffix). */
const NUMERIC_LITERAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[fF]?$/;

const STRING_PIN_TYPES = new Set(['string', 'text', 'name']);
const NUMERIC_PIN_TYPES = new Set(['int', 'int64', 'byte', 'float', 'double', 'real']);

function cppStringLiteral(raw: string): string {
  const escaped = raw
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `TEXT("${escaped}")`;
}

/**
 * Render a pin's own default value as a C++ literal of that pin's type.
 *
 * A pin that is CONNECTED is refused outright: its default is the (unused)
 * fallback UE keeps around, so emitting it would state a value the graph does
 * not use. A default that is not a literal of the declared type — an identifier
 * on a bool pin, an expression on a float pin, a `(X=,Y=,Z=)` struct blob — is
 * refused too. String/text/name are the only types where any content is valid,
 * and they are always quoted; they used to be emitted bare, which is how the
 * sample produced `PrintString(Player Spawned!);`.
 */
export function renderPinLiteral(pin: BlueprintPin): PinExpression {
  if (pin.linkedTo && pin.linkedTo.length > 0) {
    return { ok: false, reason: `pin "${pin.name}" is connected — its value comes from another node` };
  }
  const raw = pin.defaultValue;
  if (raw === undefined || raw === '') {
    return { ok: false, reason: `pin "${pin.name}" has no literal value` };
  }
  const type = pin.type.toLowerCase();
  if (STRING_PIN_TYPES.has(type)) return { ok: true, code: cppStringLiteral(raw) };
  if (type === 'bool') {
    const v = raw.trim().toLowerCase();
    if (v === 'true' || v === 'false') return { ok: true, code: v };
    return { ok: false, reason: `pin "${pin.name}" default "${raw}" is not a bool literal` };
  }
  if (NUMERIC_PIN_TYPES.has(type)) {
    const v = raw.trim();
    if (NUMERIC_LITERAL.test(v)) return { ok: true, code: v };
    return { ok: false, reason: `pin "${pin.name}" default "${raw}" is not a numeric literal` };
  }
  return {
    ok: false,
    reason: `pin "${pin.name}" default "${raw}" is a Blueprint ${pin.type} literal with no C++ equivalent`,
  };
}

/**
 * Resolve what an input pin evaluates to: its own literal, or — when it is fed
 * by a variable read — the NAME OF THAT VARIABLE, which is real graph data and
 * not a guess. Anything else (a math node, a function result, a cast) is
 * refused with the reason, naming the node that actually drives the pin.
 */
function resolveInputExpression(
  pin: BlueprintPin,
  endpointIndex: Map<string, BlueprintNode>,
): PinExpression {
  const links = pin.linkedTo ?? [];
  if (links.length === 0) return renderPinLiteral(pin);

  for (const id of links) {
    const src = endpointIndex.get(id);
    if (src?.type.includes('VariableGet') && src.memberName && CPP_IDENTIFIER.test(src.memberName)) {
      return { ok: true, code: src.memberName };
    }
  }
  const driver = endpointIndex.get(links[0]);
  return {
    ok: false,
    reason: driver
      ? `pin "${pin.name}" is driven by [${driver.type}] ${driver.name} — the expression is not derivable`
      : `pin "${pin.name}" is connected to an unresolved endpoint`,
  };
}

/** Input pins that carry a value (exec and the implicit `self` target excluded). */
function valueInputPins(node: BlueprintNode): BlueprintPin[] {
  return node.pins.filter(
    (p) => p.direction === 'input' && p.type !== 'exec' && p.name.toLowerCase() !== 'self',
  );
}

/**
 * How much of the graph actually became code.
 *
 * Derived from the warning list — every node the walker refused to translate
 * raises exactly one warning carrying its `nodeId` — so the readout cannot
 * drift from what was emitted. Warnings with no `nodeId` (e.g. a module-name
 * warning) describe the class, not a node, and are not counted as TODOs.
 */
export function describeTranspileFidelity(
  result: Pick<TranspileResult, 'warnings' | 'nodeCount'>,
): { total: number; translated: number; todo: number; label: string } {
  const flagged = new Set(
    result.warnings.filter((w) => w.nodeId !== undefined).map((w) => w.nodeId),
  );
  const total = result.nodeCount;
  const todo = Math.min(flagged.size, total);
  const translated = total - todo;
  return {
    total,
    translated,
    todo,
    label: todo > 0
      ? `${translated} of ${total} nodes translated · ${todo} left as TODO`
      : `${translated} of ${total} nodes translated`,
  };
}

/**
 * Walk a Blueprint exec chain from `startNode` and emit a best-effort C++
 * statement body. Unrecognised node types — and any node whose operands cannot
 * be derived from the graph — become `// TODO` comments plus an info-level
 * warning so nothing is silently dropped OR silently invented.
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

  /**
   * The one honest exit for anything the walker cannot translate: a `// TODO`
   * naming the node AND the reason, plus an info warning carrying the node id
   * (which is what the fidelity readout counts).
   */
  function untranslated(node: BlueprintNode, indent: string, reason: string) {
    const member = node.memberName ? ` — ${node.memberName}` : '';
    lines.push(`${indent}// TODO: [${node.type}] ${node.name}${member} — ${reason}`);
    warnings.push({
      nodeId: node.id,
      message: `Node "${node.name}" (${node.type}) needs manual translation: ${reason}`,
      severity: 'info',
    });
  }

  function walk(node: BlueprintNode, indent: string) {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    // Find exec output pin
    const execOut = node.pins.find((p) => p.direction === 'output' && p.type === 'exec');
    const nextNodeIds = execOut?.linkedTo ?? [];

    // Generate code based on node type.
    //
    // PrintString is matched FIRST. A real UE export spells it as a
    // `K2Node_CallFunction` with `MemberName: PrintString`, so it used to be
    // swallowed by the generic call branch and emitted as a bare
    // `PrintString(...)` — a function that does not exist unqualified. The old
    // dedicated branch below was unreachable for every real export.
    if (node.type.includes('PrintString') || node.memberName === 'PrintString') {
      const textPin = node.pins.find(
        (p) => p.direction === 'input' && ['instring', 'string', 'text'].includes(p.name.toLowerCase()),
      );
      const literal = textPin
        ? renderPinLiteral(textPin)
        : { ok: false as const, reason: 'no string input pin' };
      if (literal.ok && literal.code.startsWith('TEXT(')) {
        lines.push(`${indent}UE_LOG(LogTemp, Log, ${literal.code});`);
      } else {
        // The old fallback printed `TEXT("%s")` with no argument — a format
        // string promising a value it never passes.
        untranslated(node, indent, literal.ok ? 'printed value is not a string literal' : literal.reason);
      }
    } else if (node.type.includes('CallFunction') && node.memberName) {
      // `memberParent` is a UE object path (`/Script/Engine.KismetSystemLibrary`),
      // not a C++ scope — it used to be emitted verbatim in front of `::`.
      const parent = node.memberParent;
      if (parent !== undefined && !CPP_IDENTIFIER.test(parent)) {
        untranslated(node, indent, `call target "${parent}" is a Blueprint object path, not a C++ scope`);
      } else if (!CPP_IDENTIFIER.test(node.memberName)) {
        untranslated(node, indent, `function name "${node.memberName}" is not a C++ identifier`);
      } else {
        const exprs = valueInputPins(node).map((p) => resolveInputExpression(p, endpointIndex));
        const unresolved = exprs.find((e) => !e.ok);
        if (unresolved && !unresolved.ok) {
          // Emitting the call with a hole (or with the pin's own name in the
          // hole) would look translated and compile to nothing meaningful.
          untranslated(node, indent, `argument not derivable — ${unresolved.reason}`);
        } else {
          const args = exprs.map((e) => (e.ok ? e.code : '')).join(', ');
          lines.push(`${indent}${parent ? `${parent}::` : ''}${node.memberName}(${args});`);
        }
      }
    } else if (node.type.includes('IfThenElse')) {
      const condPin = node.pins.find((p) => p.direction === 'input' && p.name === 'Condition');
      const cond = condPin
        ? resolveInputExpression(condPin, endpointIndex)
        : { ok: false as const, reason: 'no Condition pin' };
      if (!cond.ok) {
        // Neither branch is emitted. An invented condition (the old
        // `bCondition`) makes one path run unconditionally — a wrong answer
        // dressed as a translation, which is worse than an unwritten one.
        untranslated(node, indent, `branch not emitted — ${cond.reason}; both exec paths need manual translation`);
        return;
      }
      const condExpr = cond.code;
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
      const valuePin = valueInputPins(node)[0];
      const value = valuePin
        ? resolveInputExpression(valuePin, endpointIndex)
        : { ok: false as const, reason: 'no value pin' };
      if (!CPP_IDENTIFIER.test(node.memberName)) {
        untranslated(node, indent, `variable name "${node.memberName}" is not a C++ identifier`);
      } else if (!value.ok) {
        // `/* value */` used to stand in for the right-hand side, producing an
        // assignment statement with no assignment in it.
        untranslated(node, indent, `assignment not emitted — ${value.reason}`);
      } else {
        lines.push(`${indent}${node.memberName} = ${value.code};`);
      }
    } else if (node.type.includes('SpawnActor')) {
      lines.push(`${indent}// TODO: SpawnActor — use GetWorld()->SpawnActor<>()`);
      warnings.push({ nodeId: node.id, message: 'SpawnActor requires manual completion', severity: 'info' });
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
