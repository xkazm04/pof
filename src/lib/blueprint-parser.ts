/**
 * Blueprint JSON Parser
 *
 * Parses UE5 Blueprint JSON exports (from commandlet or copy-paste) into
 * a structured BlueprintAsset that can be fed to Claude for transpilation.
 *
 * UE5 Blueprint JSON structure (simplified):
 * - Nodes array with K2Node_* types
 * - Pins on each node with connections
 * - Variables with UPROPERTY metadata
 * - Function graphs and event graph
 */

import type {
  BlueprintAsset,
  BlueprintGraph,
  BlueprintNode,
  BlueprintPin,
  BlueprintVariable,
} from '@/types/blueprint';

// ─── UE5 Node Type Mapping ──────────────────────────────────────────────────

const NODE_TYPE_LABELS: Record<string, string> = {
  'K2Node_Event': 'Event',
  'K2Node_CallFunction': 'Function Call',
  'K2Node_IfThenElse': 'Branch',
  'K2Node_MacroInstance': 'Macro',
  'K2Node_VariableGet': 'Get Variable',
  'K2Node_VariableSet': 'Set Variable',
  'K2Node_FunctionEntry': 'Function Entry',
  'K2Node_FunctionResult': 'Function Return',
  'K2Node_SpawnActorFromClass': 'Spawn Actor',
  'K2Node_Timeline': 'Timeline',
  'K2Node_ForEachElementInEnum': 'For Each',
  'K2Node_MakeArray': 'Make Array',
  'K2Node_CastByteToEnum': 'Cast',
  'K2Node_DynamicCast': 'Cast To',
  'K2Node_SwitchEnum': 'Switch',
  'K2Node_Composite': 'Collapsed Graph',
  'K2Node_Select': 'Select',
  'K2Node_Self': 'Self',
  'K2Node_MathExpression': 'Math Expression',
  'K2Node_CommutativeAssociativeBinaryOperator': 'Math Op',
};

/** Map a UE5 Blueprint type string to a C++ type. */
export function blueprintTypeToCpp(bpType: string): string {
  const TYPE_MAP: Record<string, string> = {
    'bool': 'bool',
    'byte': 'uint8',
    'int': 'int32',
    'int64': 'int64',
    'float': 'float',
    'double': 'double',
    'name': 'FName',
    'string': 'FString',
    'text': 'FText',
    'vector': 'FVector',
    'rotator': 'FRotator',
    'transform': 'FTransform',
    'color': 'FLinearColor',
    'object': 'UObject*',
    'class': 'UClass*',
    'actor': 'AActor*',
    'exec': 'void',
    'struct': 'FStruct',
    'softobject': 'TSoftObjectPtr<UObject>',
    'softclass': 'TSoftClassPtr<UObject>',
  };

  const lower = bpType.toLowerCase().replace(/\s+/g, '');

  // Direct match
  if (TYPE_MAP[lower]) return TYPE_MAP[lower];

  // Array<Type>
  const arrayMatch = bpType.match(/^(?:Array|TArray)\s*<\s*(.+)\s*>$/i);
  if (arrayMatch) return `TArray<${blueprintTypeToCpp(arrayMatch[1])}>`;

  // Map<K,V>
  const mapMatch = bpType.match(/^(?:Map|TMap)\s*<\s*(.+)\s*,\s*(.+)\s*>$/i);
  if (mapMatch) return `TMap<${blueprintTypeToCpp(mapMatch[1])}, ${blueprintTypeToCpp(mapMatch[2])}>`;

  // Set<Type>
  const setMatch = bpType.match(/^(?:Set|TSet)\s*<\s*(.+)\s*>$/i);
  if (setMatch) return `TSet<${blueprintTypeToCpp(setMatch[1])}>`;

  // Object reference (e.g. "UStaticMesh*")
  if (bpType.startsWith('U') || bpType.startsWith('A') || bpType.startsWith('F')) {
    return bpType.includes('*') ? bpType : bpType;
  }

  // Fallback — return as-is
  return bpType;
}

// ─── Parser ─────────────────────────────────────────────────────────────────

interface RawBlueprintJson {
  ClassName?: string;
  ParentClass?: string;
  Nodes?: RawNode[];
  Variables?: RawVariable[];
  Graphs?: RawGraph[];
  [key: string]: unknown;
}

interface RawNode {
  NodeGuid?: string;
  NodeType?: string;
  NodeClass?: string;
  Name?: string;
  NodeComment?: string;
  MemberParent?: string;
  MemberName?: string;
  Pins?: RawPin[];
  NodePosX?: number;
  NodePosY?: number;
  [key: string]: unknown;
}

interface RawPin {
  PinName?: string;
  PinType?: { PinCategory?: string; PinSubCategoryObject?: string };
  Direction?: string;
  LinkedTo?: string[];
  DefaultValue?: string;
  [key: string]: unknown;
}

interface RawVariable {
  VarName?: string;
  VarType?: string | { PinCategory?: string };
  Category?: string;
  DefaultValue?: string;
  PropertyFlags?: string[];
  Tooltip?: string;
  [key: string]: unknown;
}

interface RawGraph {
  GraphName?: string;
  GraphType?: string;
  Nodes?: RawNode[];
  [key: string]: unknown;
}

function parsePin(raw: RawPin): BlueprintPin {
  const typeStr = raw.PinType?.PinSubCategoryObject
    ?? raw.PinType?.PinCategory
    ?? 'unknown';
  return {
    name: raw.PinName ?? 'unnamed',
    type: typeStr,
    direction: raw.Direction === 'EGPD_Output' ? 'output' : 'input',
    linkedTo: raw.LinkedTo,
    defaultValue: raw.DefaultValue || undefined,
  };
}

function parseNode(raw: RawNode): BlueprintNode {
  const nodeType = raw.NodeClass ?? raw.NodeType ?? 'Unknown';
  const shortType = nodeType.split('.').pop() ?? nodeType;
  return {
    id: raw.NodeGuid ?? `node-${Math.random().toString(36).slice(2, 8)}`,
    type: shortType,
    name: raw.Name ?? NODE_TYPE_LABELS[shortType] ?? shortType,
    comment: raw.NodeComment || undefined,
    memberParent: raw.MemberParent || undefined,
    memberName: raw.MemberName || undefined,
    pins: (raw.Pins ?? []).map(parsePin),
    posX: raw.NodePosX ?? 0,
    posY: raw.NodePosY ?? 0,
  };
}

function parseVariable(raw: RawVariable): BlueprintVariable {
  const flags = raw.PropertyFlags ?? [];
  const varType = typeof raw.VarType === 'string'
    ? raw.VarType
    : raw.VarType?.PinCategory ?? 'unknown';
  return {
    name: raw.VarName ?? 'unnamed',
    type: varType,
    category: raw.Category || undefined,
    defaultValue: raw.DefaultValue || undefined,
    isExposedToEditor: flags.includes('CPF_Edit') || flags.includes('EditAnywhere'),
    isReplicated: flags.includes('CPF_Net') || flags.includes('Replicated'),
    tooltip: raw.Tooltip || undefined,
  };
}

function parseGraph(raw: RawGraph): BlueprintGraph {
  const gt = (raw.GraphType ?? '').toLowerCase();
  const graphType: BlueprintGraph['graphType'] =
    gt.includes('function') ? 'function'
    : gt.includes('macro') ? 'macro'
    : 'event';
  return {
    name: raw.GraphName ?? 'Unnamed',
    graphType,
    nodes: (raw.Nodes ?? []).map(parseNode),
  };
}

/**
 * Parse a Blueprint JSON export into a structured BlueprintAsset.
 * Accepts either a JSON string or pre-parsed object.
 */
export function parseBlueprintJson(input: string | object): BlueprintAsset {
  const data: RawBlueprintJson = typeof input === 'string' ? JSON.parse(input) : input as RawBlueprintJson;

  const variables = (data.Variables ?? []).map(parseVariable);
  const graphs = (data.Graphs ?? []).map(parseGraph);

  // Separate event graph from function graphs
  const eventGraph = graphs.find((g) => g.graphType === 'event' && g.name === 'EventGraph')
    ?? graphs.find((g) => g.graphType === 'event')
    ?? { name: 'EventGraph', graphType: 'event' as const, nodes: (data.Nodes ?? []).map(parseNode) };

  const functions = graphs.filter((g) => g.graphType === 'function');

  return {
    className: data.ClassName ?? 'BP_Unknown',
    parentClass: data.ParentClass ?? 'AActor',
    variables,
    functions,
    eventGraph,
  };
}

/**
 * Build a human-readable summary of a Blueprint asset for Claude.
 * This is what gets sent to Claude for transpilation.
 */
export function summarizeBlueprintForPrompt(asset: BlueprintAsset): string {
  const lines: string[] = [];

  lines.push(`Blueprint: ${asset.className} (inherits ${asset.parentClass})`);
  lines.push('');

  // Variables
  if (asset.variables.length > 0) {
    lines.push('## Variables');
    for (const v of asset.variables) {
      const flags: string[] = [];
      if (v.isExposedToEditor) flags.push('EditAnywhere');
      if (v.isReplicated) flags.push('Replicated');
      const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
      lines.push(`- ${v.name}: ${v.type}${flagStr}${v.defaultValue ? ` = ${v.defaultValue}` : ''}`);
    }
    lines.push('');
  }

  // Event Graph
  if (asset.eventGraph.nodes.length > 0) {
    lines.push('## Event Graph');
    for (const node of asset.eventGraph.nodes) {
      const connections = node.pins
        .filter((p) => p.direction === 'output' && p.linkedTo && p.linkedTo.length > 0)
        .map((p) => `${p.name} → [${p.linkedTo!.length} connections]`);
      const connStr = connections.length > 0 ? ` (${connections.join(', ')})` : '';
      lines.push(`- [${node.type}] ${node.name}${node.memberName ? ` → ${node.memberName}` : ''}${connStr}`);
    }
    lines.push('');
  }

  // Functions
  for (const fn of asset.functions) {
    lines.push(`## Function: ${fn.name}`);
    for (const node of fn.nodes) {
      lines.push(`  - [${node.type}] ${node.name}${node.memberName ? ` → ${node.memberName}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
