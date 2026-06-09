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
  'eval.visual': {
    moduleId: string;
    itemId: string;
    verdict: 'pass' | 'fail';
    anyEmpty: boolean;
    notes: string;
    screenshotPath: string;
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
  'ue5.ws.connected': Record<string, never>;
  'ue5.ws.disconnected': { reason?: string };
  'ue5.ws.snapshot': { timestamp: number; editorState: string };
  'ue5.ws.pie': { action: string; sessionId?: string };
  'ue5.ws.selection': { actorCount: number };
  'ue5.ws.property': { watchId: string; propertyName: string };
}

/** Headless build pipeline events */
export interface BuildPipelineEvents {
  'build.queued': { buildId: string; targetName: string };
  'build.progress': { buildId: string; message: string; percent?: number };
  'build.succeeded': { buildId: string; errorCount: number; warningCount: number; durationMs: number };
  'build.failed': { buildId: string; errorCount: number; exitCode: number | null };
  'build.aborted': { buildId: string };
}

/** PoF Companion Plugin bridge events */
export interface PofBridgeEvents {
  'pof.connected': { pluginVersion: string; engineVersion: string; projectName: string };
  'pof.disconnected': { reason?: string };
  'pof.error': { message: string };
  'pof.manifest.updated': { assetCount: number; checksum: string };
  'pof.test.completed': { testId: string; status: 'passed' | 'failed' | 'error'; assertionsPassed: number; assertionsFailed: number };
  'pof.snapshot.captured': { presetIds: string[]; overallStatus: string };
  'pof.compile.completed': { status: string; errorCount: number; warningCount: number; durationMs: number };
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

/** Test-gate verdict events — emitted by the L3/L4 drain (`drainOne`) whenever a
 *  gate's verdict actually changes. `from` is the prior artifact status (null = no
 *  prior); `to` is the drained verdict; `regression` is the classic pass→fail. */
export interface GateEvents {
  'gate.verdict.changed': {
    catalogId: string;
    entityId: string;
    step: string;
    tier: 'L3' | 'L4';
    from: 'pass' | 'pending' | 'fail' | 'deferred' | null;
    to: 'pass' | 'fail';
    regression: boolean;
    detail: string;
  };
}

/** One-shot catalog job events */
export interface OneShotJobEvents {
  'oneshot.started':        { jobId: string; jobName: string; totalSteps: number; catalogId: string; entityId: string };
  'oneshot.step-completed': { jobId: string; stepIndex: number; totalSteps: number; stepName: string; outcome: 'pass' | 'fail' | 'skipped' | 'deferred'; reason?: string };
  'oneshot.completed':      { jobId: string; jobName: string; totalSteps: number; ran: number; passed: number; failed: number; skipped: number; deferred: number; catalogId: string; entityId: string };
  'oneshot.failed':         { jobId: string; jobName: string; stepIndex: number; totalSteps: number; error: string };
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
    BuildPipelineEvents,
    PofBridgeEvents,
    GateEvents,
    OneShotJobEvents {}

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
