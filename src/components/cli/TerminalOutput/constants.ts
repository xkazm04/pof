import {
  User, Bot, Wrench, CheckCircle, AlertCircle,
  FileEdit, FilePlus, Eye, ListOrdered,
  Box, AlertTriangle, FileCode, Lightbulb, Footprints,
} from 'lucide-react';
import type { LogEntry } from '../types';
import {
  STATUS_INFO, STATUS_MUTED, ACCENT_VIOLET, MODULE_COLORS, CLI_COLORS,
} from '@/lib/chart-colors';
import type { InlineEntity } from './types';

// --- Constants ---

export const LOG_ICON_SIZE = 'w-3 h-3';

export const LOG_TYPE_ICONS: Record<LogEntry['type'], { icon: typeof User; colorClass: string }> = {
  user: { icon: User, colorClass: CLI_COLORS.prompt },
  assistant: { icon: Bot, colorClass: CLI_COLORS.assistant },
  tool_use: { icon: Wrench, colorClass: CLI_COLORS.warning },
  tool_result: { icon: CheckCircle, colorClass: CLI_COLORS.success },
  error: { icon: AlertCircle, colorClass: CLI_COLORS.error },
  system: { icon: ListOrdered, colorClass: CLI_COLORS.info },
};

export const TOOL_ICONS: Record<string, { icon: typeof FileEdit; colorClass: string }> = {
  Edit: { icon: FileEdit, colorClass: CLI_COLORS.warning },
  Write: { icon: FilePlus, colorClass: CLI_COLORS.success },
  Read: { icon: Eye, colorClass: CLI_COLORS.prompt },
};

/** Intrinsic-size hint (px) for offscreen rows skipped via content-visibility. */
export const LOG_ITEM_HEIGHT = 24;
export const TOOL_BATCH_THRESHOLD = 5;

export const TOOLBAR_PADDING = 6;
export const TOOLBAR_GAP = 8;
export const CARET_INSET = 12;

// --- Client-side entity extraction (lightweight regex, no server call) ---

export const UE_CLASS_RE = /\b([AUF][A-Z][A-Za-z0-9]+(?:Component|Controller|Character|Base|Instance|System|Subsystem|Widget|Effect|Ability|Set|Asset|Manager|Volume)?)\b/g;
export const UE_CLASS_EXCLUDE = new Set(['ANSI', 'ASCII', 'ATTR', 'AUTO', 'UPROPERTY', 'UFUNCTION', 'UCLASS', 'USTRUCT', 'UENUM', 'UMETA', 'FORCEINLINE']);
export const FILE_RE = /(?:Source\/|Private\/|Public\/|Content\/)[\w/.-]+\.\w{1,5}/g;
export const WARNING_RE = /(?:⚠️|Warning|WARN|Caution|Important|Be careful|Caveat)[:\s]+(.{10,120}?)(?:\n|$)/gi;
export const UE_CONCEPTS_SET = new Set([
  'gameplay ability system', 'gas', 'behavior tree', 'eqs', 'navmesh',
  'enhanced input', 'replication', 'rpc', 'gameplay effect', 'gameplay cue',
  'data table', 'data asset', 'subsystem', 'animation blueprint', 'montage',
  'blend space', 'state machine', 'niagara', 'material instance', 'post process',
  'world partition', 'gameplay tag', 'umg',
]);
export const UE_CONCEPT_LABELS: Record<string, string> = {
  'gameplay ability system': 'GAS', gas: 'GAS', 'behavior tree': 'Behavior Tree',
  eqs: 'EQS', navmesh: 'NavMesh', 'enhanced input': 'Enhanced Input',
  replication: 'Replication', rpc: 'RPC', 'gameplay effect': 'GameplayEffect',
  'gameplay cue': 'GameplayCue', 'data table': 'Data Table', 'data asset': 'Data Asset',
  subsystem: 'Subsystem', 'animation blueprint': 'AnimBP', montage: 'Montage',
  'blend space': 'Blend Space', 'state machine': 'State Machine', niagara: 'Niagara',
  'material instance': 'Material Instance', 'post process': 'Post Process',
  'world partition': 'World Partition', 'gameplay tag': 'Gameplay Tag', umg: 'UMG',
};

export const ENTITY_STYLES: Record<InlineEntity['type'], { color: string; icon: typeof Box }> = {
  class:   { color: STATUS_INFO, icon: Box },
  file:    { color: STATUS_MUTED, icon: FileCode },
  concept: { color: ACCENT_VIOLET, icon: Lightbulb },
  warning: { color: MODULE_COLORS.content, icon: AlertTriangle },
  step:    { color: MODULE_COLORS.setup, icon: Footprints },
};

export const STARTER_PROMPTS = [
  { label: 'Implement next checklist item', prompt: 'Look at the checklist and implement the next uncompleted item.' },
  { label: 'Build the project', prompt: 'Build the project and fix any errors.' },
  { label: 'Explain current module', prompt: 'Explain the architecture and purpose of this module.' },
];
