/**
 * PoF Bridge Types
 *
 * TypeScript types matching the PillarsOfFortuneBridge UE5 companion plugin's
 * JSON schemas. The plugin runs on port 30040 and serves endpoints under /pof/*.
 *
 * Covers: plugin status, asset manifest, test runner, snapshots,
 * compile/live-coding, and feature verification.
 */

import type { SubModuleId } from './modules';
import type { FeatureStatus } from './feature-matrix';

// ── Plugin Status ────────────────────────────────────────────────────────────

export interface PofBridgeStatus {
  pluginVersion: string;
  engineVersion: string;
  projectName: string;
  projectRoot: string;
  editorState: 'idle' | 'pie' | 'compiling' | 'cooking';
  pieRunning: boolean;
  liveCodingEnabled: boolean;
  manifestReady: boolean;
  manifestAssetCount: number;
  manifestLastUpdated: string;
  uptimeSeconds: number;
  port: number;
}

// ── Connection State ─────────────────────────────────────────────────────────

export type PofConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'reconnecting';

export interface PofConnectionState {
  status: PofConnectionStatus;
  pluginInfo: PofBridgeStatus | null;
  error: string | null;
  lastConnected: string | null;
  reconnectAttempts: number;
}

// ── Asset Manifest ───────────────────────────────────────────────────────────

export interface AssetManifest {
  version: number;
  generatedAt: string;
  projectName: string;
  engineVersion: string;
  assetCount: number;
  checksumSha256: string;
  blueprints: BlueprintEntry[];
  materials: MaterialEntry[];
  animAssets: AnimAssetEntry[];
  dataTables: DataTableEntry[];
  otherAssets: OtherAssetEntry[];
}

export interface BlueprintEntry {
  path: string;
  parentCppClass: string;
  parentCppModule: string;
  parentBlueprintClass?: string;
  overriddenFunctions: FunctionOverride[];
  addedComponents: ComponentEntry[];
  variables: VariableEntry[];
  eventGraphEntryPoints: string[];
  interfaces: string[];
  crossReferences: string[];
  contentHash: string;
}

export interface FunctionOverride {
  functionName: string;
  declaringClass: string;
  isEvent: boolean;
  isBlueprintCallable: boolean;
}

export interface ComponentEntry {
  componentName: string;
  componentClass: string;
  isSceneComponent: boolean;
  attachParent: string | null;
  defaultValues?: Record<string, unknown>;
}

export interface VariableEntry {
  name: string;
  type: string;
  subType?: string | null;
  defaultValue: string;
  isReplicated: boolean;
  category: string;
}

export interface MaterialEntry {
  path: string;
  parentMaterial: string | null;
  domain: string;
  blendMode: string;
  shadingModel: string;
  parameters: MaterialParameter[];
  materialInstances: string[];
  textureReferences: string[];
  crossReferences: string[];
  contentHash: string;
}

export interface MaterialParameter {
  name: string;
  type: 'ScalarParameter' | 'VectorParameter' | 'TextureParameter' | 'StaticSwitchParameter';
  defaultValue?: unknown;
  defaultTexture?: string;
  min?: number;
  max?: number;
}

export interface AnimAssetEntry {
  path: string;
  assetType: 'AnimMontage' | 'AnimBlueprint' | 'AnimSequence' | 'BlendSpace';
  skeletonPath: string;
  duration?: number;
  notifies?: AnimNotify[];
  sections?: string[];
  stateMachines?: StateMachine[];
  crossReferences: string[];
  contentHash: string;
}

export interface AnimNotify {
  name: string;
  time: number;
  notifyClass: string;
}

export interface StateMachine {
  name: string;
  states: string[];
  transitions: StateTransition[];
}

export interface StateTransition {
  from: string;
  to: string;
  condition: string;
}

export interface DataTableEntry {
  path: string;
  rowStruct: string;
  rowStructModule: string;
  rowCount: number;
  columnNames: string[];
  crossReferences: string[];
  contentHash: string;
}

export interface OtherAssetEntry {
  path: string;
  assetClass: string;
  crossReferences: string[];
  contentHash: string;
}

// ── Test Runner ──────────────────────────────────────────────────────────────

export interface PofTestSpec {
  testId: string;
  description: string;
  timeout: number;
  setup: PofSpawnEntry[];
  actions: PofTestAction[];
  assertions: PofAssertion[];
  cleanup: 'destroyAll' | 'none';
}

export interface PofSpawnEntry {
  spawn: string;
  tag: string;
  location: [number, number, number];
  rotation: [number, number, number];
  propertyOverrides?: Record<string, unknown>;
}

export interface PofTestAction {
  type: 'call' | 'wait';
  target?: string;
  function?: string;
  args?: Record<string, unknown>;
  duration?: number;
  reason?: string;
}

export type PofAssertionOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'contains'
  | 'hasTag'
  | 'isValid'
  | 'isNull'
  | 'isTrue'
  | 'isFalse';

export interface PofAssertion {
  id: string;
  target: string;
  property: string;
  operator: PofAssertionOperator;
  expected: unknown;
  description: string;
}

export interface PofTestResult {
  testId: string;
  status: 'passed' | 'failed' | 'error' | 'timeout' | 'running';
  startTime: string;
  endTime?: string;
  durationMs?: number;
  assertions: PofAssertionResult[];
  logs: PofTestLog[];
  errors: string[];
}

export interface PofAssertionResult {
  id: string;
  status: 'passed' | 'failed';
  description: string;
  expected: string;
  actual: string;
  failureReason?: string;
}

export interface PofTestLog {
  time: number;
  message: string;
}

// ── Snapshots ────────────────────────────────────────────────────────────────

export interface PofCameraPreset {
  id: string;
  name: string;
  description: string;
  location: [number, number, number];
  rotation: [number, number, number];
  fov: number;
  resolution: [number, number];
  mapPath: string;
  requiresPIE?: boolean;
  setupCommands?: string[];
}

export interface PofSnapshotCaptureRequest {
  presetIds: string[];
  saveBaseline?: boolean;
  compareToBaseline?: boolean;
  diffThreshold?: number;
}

export interface PofSnapshotDiffReport {
  generatedAt: string;
  diffThreshold: number;
  overallStatus: 'passed' | 'failed';
  results: PofSnapshotDiffResult[];
  summary: {
    totalPresets: number;
    passed: number;
    failed: number;
    noBaseline: number;
    skipped: number;
  };
}

export interface PofSnapshotDiffResult {
  presetId: string;
  presetName: string;
  status: 'passed' | 'failed' | 'no-baseline' | 'resolution-mismatch';
  diffPercentage: number;
  maxPixelDiff: number;
  diffPixelCount: number;
  totalPixelCount: number;
  baselinePath?: string;
  capturePath?: string;
  note?: string;
}

// ── Compile / Live Coding ────────────────────────────────────────────────────

export interface PofCompileRequest {
  waitForComplete?: boolean;
  timeoutSeconds?: number;
}

export type PofCompileStatus = 'idle' | 'compiling' | 'success' | 'failed' | 'timeout' | 'error';

export interface PofCompileResult {
  status: PofCompileStatus;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  diagnostics: PofDiagnostic[];
  summary?: {
    success: boolean;
    errorCount: number;
    warningCount: number;
    duration: string;
    rawText: string;
  };
  errorMessage?: string;
}

export interface PofDiagnostic {
  id: string;
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  rawText: string;
  category: 'compile' | 'link' | 'asset';
}

// ── Hot-Patch ────────────────────────────────────────────────────────────────

export type PofPatchPhase =
  | 'idle'
  | 'writing_file'
  | 'compiling'
  | 'verifying'
  | 'complete'
  | 'reverting'
  | 'reverted'
  | 'failed';

export interface PofHotPatchDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
}

export interface PofHotPatchRequest {
  filePath: string;
  fileContent: string;
  verifyObjectPath?: string;
  verifyFunctionName?: string;
}

export interface PofHotPatchResult {
  filePath: string;
  patchPhase: PofPatchPhase;
  durationMs: number;
  diagnostics: PofHotPatchDiagnostic[];
  errorMessage?: string;
  verificationOutput?: string;
  verificationPassed?: boolean;
  fileReverted?: boolean;
}

// ── Verification ─────────────────────────────────────────────────────────────

export interface VerificationRule {
  featureName: string;
  moduleId: SubModuleId;
  check: (manifest: AssetManifest) => FeatureStatus;
}

export interface VerificationResult {
  featureName: string;
  moduleId: SubModuleId;
  previousStatus: FeatureStatus | null;
  newStatus: FeatureStatus;
  details?: string;
}
