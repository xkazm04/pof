import type { SubModuleId } from './modules';

// ── Typed Event Bus — Channel Definitions ──
//
// Namespaced event channels for cross-module communication.
// Add new channels by extending the EventMap interface.

/** CLI-related events */
export interface CLIEvents {
  'cli.task.started': {
    tabId: string;
    sessionLabel: string;
    moduleId?: string;
    prompt?: string;
  };
  'cli.task.completed': {
    tabId: string;
    sessionLabel: string;
    moduleId?: string;
    success: boolean;
  };
  'cli.session.created': {
    tabId: string;
    sessionLabel: string;
    moduleId?: string;
  };
  'cli.session.removed': {
    tabId: string;
  };
}

/** Evaluator / quality scan events */
export interface EvaluatorEvents {
  'eval.scan.completed': {
    overallScore: number;
    recommendationCount: number;
  };
  'eval.recommendation': {
    title: string;
    description: string;
    moduleId?: string;
    priority: string;
    suggestedPrompt?: string;
  };
}

/** Build events */
export interface BuildEvents {
  'build.started': {
    moduleId?: string;
  };
  'build.completed': {
    moduleId?: string;
    success: boolean;
    errors?: number;
    warnings?: number;
  };
}

/** Checklist / progress events */
export interface ChecklistEvents {
  'checklist.item.changed': {
    moduleId: SubModuleId;
    itemId: string;
    checked: boolean;
    source: 'user' | 'auto-verify' | 'cli';
  };
  'checklist.module.completed': {
    moduleId: SubModuleId;
    totalItems: number;
  };
}

/** File watcher events */
export interface FileEvents {
  'file.changed': {
    path: string;
    kind: 'create' | 'modify' | 'delete';
  };
  'file.verified': {
    moduleId: SubModuleId;
    itemId: string;
    status: 'full' | 'partial' | 'stub' | 'missing';
    completeness: number;
  };
}

/** UE5 Remote Control events */
export interface UE5Events {
  'ue5.connected': { version: string };
  'ue5.disconnected': { reason?: string };
  'ue5.error': { message: string };
}

/** Headless build pipeline events */
export interface BuildPipelineEvents {
  'build.queued': { buildId: string; targetName: string };
  'build.progress': { buildId: string; message: string; percent?: number };
  'build.succeeded': { buildId: string; errorCount: number; warningCount: number; durationMs: number };
  'build.failed': { buildId: string; errorCount: number; exitCode: number | null };
  'build.aborted': { buildId: string };
}

/** Navigation events */
export interface NavigationEvents {
  'nav.module.changed': {
    moduleId: SubModuleId;
    previousModuleId?: string;
  };
  'nav.tab.changed': {
    tabKey: string;
  };
}

/** The complete event map — union of all channel groups */
export interface EventMap
  extends CLIEvents,
    EvaluatorEvents,
    BuildEvents,
    ChecklistEvents,
    FileEvents,
    NavigationEvents,
    UE5Events,
    BuildPipelineEvents {}

/** Any valid channel name */
export type EventChannel = keyof EventMap;

/** Payload type for a given channel */
export type EventPayload<C extends EventChannel> = EventMap[C];

/** A fully-resolved event envelope */
export interface BusEvent<C extends EventChannel = EventChannel> {
  id: string;
  channel: C;
  payload: EventPayload<C>;
  timestamp: number;
  /** Optional source identifier for debugging */
  source?: string;
}

/** Subscription callback */
export type EventHandler<C extends EventChannel> = (event: BusEvent<C>) => void;

/** Wildcard handler receives any event */
export type WildcardHandler = (event: BusEvent) => void;

/** Namespace prefix for channel matching (e.g., 'cli' matches 'cli.*') */
export type EventNamespace = EventChannel extends `${infer NS}.${string}` ? NS : never;
