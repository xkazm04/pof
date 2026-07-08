import {
  Code, ArrowRight, AlertTriangle, CheckCircle2, XCircle, GitCompare,
} from 'lucide-react';
import type { TranspilerTab, DiffConflictLevel } from '@/types/blueprint';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_15,
} from '@/lib/chart-colors';

export const ACCENT = MODULE_COLORS.systems;

export const TAB_CONFIG: { id: TranspilerTab; label: string; icon: typeof Code }[] = [
  { id: 'transpile', label: 'Transpile', icon: ArrowRight },
  { id: 'diff', label: 'Semantic Diff', icon: GitCompare },
];

export const CONFLICT_STYLES: Record<DiffConflictLevel, { color: string; bg: string; label: string; icon: typeof CheckCircle2 }> = {
  none: { color: STATUS_SUCCESS, bg: `${STATUS_SUCCESS}${OPACITY_15}`, label: 'No Conflicts', icon: CheckCircle2 },
  compatible: { color: STATUS_WARNING, bg: `${STATUS_WARNING}${OPACITY_15}`, label: 'Compatible Changes', icon: AlertTriangle },
  conflict: { color: STATUS_ERROR, bg: `${STATUS_ERROR}${OPACITY_15}`, label: 'Conflicts Detected', icon: XCircle },
};

export const SAMPLE_BLUEPRINT = JSON.stringify({
  ClassName: 'BP_PlayerCharacter',
  ParentClass: 'ACharacter',
  Variables: [
    { VarName: 'Health', VarType: 'float', PropertyFlags: ['CPF_Edit'], DefaultValue: '100.0', Tooltip: 'Current health points' },
    { VarName: 'MaxHealth', VarType: 'float', PropertyFlags: ['CPF_Edit'], DefaultValue: '100.0' },
    { VarName: 'MoveSpeed', VarType: 'float', PropertyFlags: ['CPF_Edit'], DefaultValue: '600.0' },
    { VarName: 'bIsDead', VarType: 'bool', DefaultValue: 'false' },
  ],
  Graphs: [
    {
      GraphName: 'EventGraph',
      GraphType: 'event',
      Nodes: [
        { NodeGuid: 'n1', NodeClass: 'K2Node_Event', Name: 'BeginPlay', MemberName: 'BeginPlay', Pins: [{ PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['n2'] }], NodePosX: 0, NodePosY: 0 },
        { NodeGuid: 'n2', NodeClass: 'K2Node_CallFunction', Name: 'PrintString', MemberName: 'PrintString', Pins: [{ PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Input' }, { PinName: 'InString', PinType: { PinCategory: 'string' }, Direction: 'EGPD_Input', DefaultValue: 'Player Spawned!' }, { PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output' }], NodePosX: 300, NodePosY: 0 },
        { NodeGuid: 'n3', NodeClass: 'K2Node_Event', Name: 'Tick', MemberName: 'Tick', Pins: [{ PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output' }], NodePosX: 0, NodePosY: 200 },
      ],
    },
    {
      GraphName: 'TakeDamage',
      GraphType: 'function',
      Nodes: [
        { NodeGuid: 'f1', NodeClass: 'K2Node_FunctionEntry', Name: 'Entry', Pins: [{ PinName: 'DamageAmount', PinType: { PinCategory: 'float' }, Direction: 'EGPD_Output' }, { PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Output', LinkedTo: ['f2'] }], NodePosX: 0, NodePosY: 0 },
        { NodeGuid: 'f2', NodeClass: 'K2Node_VariableSet', Name: 'Set Health', MemberName: 'Health', Pins: [{ PinName: 'exec', PinType: { PinCategory: 'exec' }, Direction: 'EGPD_Input' }, { PinName: 'Health', PinType: { PinCategory: 'float' }, Direction: 'EGPD_Input', DefaultValue: 'Health - DamageAmount' }], NodePosX: 300, NodePosY: 0 },
      ],
    },
  ],
}, null, 2);
