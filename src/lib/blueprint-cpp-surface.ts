/**
 * Blueprint → C++ member surface
 *
 * The ONE record of which C++ members a Blueprint becomes: the class name and
 * prefix, every UPROPERTY with its specifiers, every UFUNCTION (with where it
 * came from), the engine-event overrides and the replication block.
 *
 * `blueprint-cpp-codegen.ts` renders the header and source FROM this record and
 * `blueprint-semantic-diff.ts` compares a parsed header AGAINST it, so the two
 * are projections of one model rather than two derivations that can disagree.
 * They used to: codegen emitted `BlueprintReadWrite` on every property while
 * the diff read it as editor exposure, and codegen emitted custom events and
 * OnRep handlers the diff never expected — so the transpiler's own output
 * diffed dirty, and a header MISSING those members diffed clean.
 * Standard: ai-registry game-production/visual-script-to-code-transpilation,
 * "declaration-definition parity" + "structural round-trip diff".
 *
 * Pure (no React/I/O), like `replication-scaffolder.ts`.
 */

import { blueprintTypeToCpp } from '@/lib/blueprint-parser';
import { hasSpecifier } from '@/lib/cpp-semantic-parser';
import { buildReplicationInfo, onRepHandlerName, replicationSpecifier } from '@/lib/replication-scaffolder';
import type {
  BlueprintAsset,
  BlueprintGraph,
  BlueprintNode,
  BlueprintVariable,
  ReplicationInfo,
} from '@/types/blueprint';

/**
 * The specifiers that put a property in the Details panel. `BlueprintReadWrite`
 * / `BlueprintReadOnly` only expose it to graphs, so they are NOT editor
 * exposure — counting them made every transpiled property read as exposed.
 */
export const EDITOR_EXPOSURE_SPECIFIERS = ['EditAnywhere', 'EditDefaultsOnly', 'EditInstanceOnly'] as const;

export function isEditorExposed(specifiers: string[]): boolean {
  return EDITOR_EXPOSURE_SPECIFIERS.some((s) => hasSpecifier(specifiers, s));
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

/**
 * Derive the C++ parameter list and return type for a Blueprint function from
 * its entry/result nodes. Also returns the entry node, which the source pass
 * needs to generate the function body.
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

export interface CppSurfaceProperty {
  name: string;
  cppType: string;
  /** UPROPERTY specifiers in emission order. */
  specifiers: string[];
  tooltip?: string;
  defaultValue?: string;
  variable: BlueprintVariable;
}

interface CppSurfaceFunctionBase {
  name: string;
  returnType: string;
  /** Rendered `Type Name` parameters. */
  params: string[];
  /** UFUNCTION specifiers in emission order (may be empty: `UFUNCTION()`). */
  specifiers: string[];
}

/** Every UFUNCTION the Blueprint becomes, tagged with where it came from. */
export type CppSurfaceFunction =
  | (CppSurfaceFunctionBase & { origin: 'bp-function'; graph: BlueprintGraph; entryNode: BlueprintNode | undefined })
  | (CppSurfaceFunctionBase & { origin: 'custom-event'; node: BlueprintNode })
  | (CppSurfaceFunctionBase & { origin: 'onrep-handler'; property: string });

export interface CppSurface {
  cppClassName: string;
  /** Prefix UHT requires for this parent: `U` (UObject-rooted) or `A` (AActor-rooted). */
  prefix: 'A' | 'U';
  isComponent: boolean;
  properties: CppSurfaceProperty[];
  /** Emission order: Blueprint functions, then custom events, then OnRep handlers. */
  functions: CppSurfaceFunction[];
  overrides: { override: EventOverride; node: BlueprintNode }[];
  unknownEvents: { name: string; node: BlueprintNode }[];
  /** Events collapsed into an override already taken by an earlier node. */
  duplicateEvents: { name: string; overrideName: string; node: BlueprintNode }[];
  replication: ReplicationInfo;
}

/** The C++ name of a Blueprint function graph (Blueprint allows spaces). */
export function cppFunctionName(fn: BlueprintGraph): string {
  return fn.name.replace(/\s+/g, '');
}

function isCustomEventNode(n: BlueprintNode): boolean {
  return n.type.includes('CustomEvent') || n.type.includes('K2Node_Event_Custom');
}

export function deriveCppSurface(asset: BlueprintAsset): CppSurface {
  const parentClass = asset.parentClass;
  // UHT derives the required class prefix from the parent: UObject-rooted
  // (components included) take `U`, AActor-rooted take `A`.
  const isComponent = parentClass === 'UActorComponent' || parentClass.includes('Component');
  const prefix = isComponent || parentClass.startsWith('U') ? 'U' : 'A';
  // Strip BP_ prefix for the C++ class name.
  const cppClassName = asset.className.startsWith('BP_')
    ? `${prefix}${asset.className.slice(3)}`
    : asset.className.startsWith('A') || asset.className.startsWith('U')
      ? asset.className
      : `${prefix}${asset.className}`;

  const properties: CppSurfaceProperty[] = asset.variables.map((v) => {
    const specifiers: string[] = [];
    if (v.isExposedToEditor) specifiers.push(EDITOR_EXPOSURE_SPECIFIERS[0]);
    if (v.isReplicated) specifiers.push(replicationSpecifier({ name: v.name, repNotify: v.isRepNotify }));
    specifiers.push('BlueprintReadWrite');
    if (v.category) specifiers.push(`Category = "${v.category}"`);
    return { name: v.name, cppType: blueprintTypeToCpp(v.type), specifiers, tooltip: v.tooltip, defaultValue: v.defaultValue, variable: v };
  });

  const functions: CppSurfaceFunction[] = [];
  for (const graph of asset.functions) {
    const { params, returnType, entryNode } = deriveFunctionSignature(graph);
    functions.push({
      origin: 'bp-function', name: cppFunctionName(graph), returnType, params,
      specifiers: ['BlueprintCallable', `Category = "${asset.className}"`], graph, entryNode,
    });
  }
  for (const node of asset.eventGraph.nodes.filter(isCustomEventNode)) {
    functions.push({
      origin: 'custom-event', name: node.memberName ?? node.name, returnType: 'void', params: [],
      specifiers: ['BlueprintCallable', 'Category = "Events"'], node,
    });
  }
  const replication = buildReplicationInfo(asset);
  for (const p of replication.properties) {
    if (!p.repNotify) continue;
    functions.push({ origin: 'onrep-handler', name: onRepHandlerName(p.name), returnType: 'void', params: [], specifiers: [], property: p.name });
  }

  // Engine events → overrides, resolved ONCE: a repeated event (e.g. both
  // `BeginPlay` and `ReceiveBeginPlay`) collapses to one override, because
  // declaring it twice is a redefinition error.
  const overrides: CppSurface['overrides'] = [];
  const unknownEvents: CppSurface['unknownEvents'] = [];
  const duplicateEvents: CppSurface['duplicateEvents'] = [];
  const seen = new Set<string>();
  for (const node of asset.eventGraph.nodes) {
    if (!node.type.includes('Event') || node.type.includes('Custom')) continue;
    const name = node.memberName ?? node.name;
    const override = resolveEventOverride(name, isComponent);
    if (!override) unknownEvents.push({ name, node });
    else if (seen.has(override.name)) duplicateEvents.push({ name, overrideName: override.name, node });
    else {
      seen.add(override.name);
      overrides.push({ override, node });
    }
  }

  return { cppClassName, prefix, isComponent, properties, functions, overrides, unknownEvents, duplicateEvents, replication };
}
