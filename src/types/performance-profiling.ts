// ── Performance Profiling Types ──────────────────────────────────────────────

export type ProfileSourceType = 'unreal-insights' | 'csv-stats' | 'manual';
export type FrameBudgetCategory = 'game-thread' | 'render-thread' | 'gpu' | 'rhi' | 'gc';
export type OptimizationPriority = 'critical' | 'high' | 'medium' | 'low';

/** Raw frame timing data from a profiling session */
export interface FrameTimingSample {
  frameIndex: number;
  timestampMs: number;
  gameThreadMs: number;
  renderThreadMs: number;
  gpuMs: number;
  rhiMs: number;
  totalFrameMs: number;
  drawCalls: number;
  triangleCount: number;
}

/** Per-actor/class tick cost aggregation */
export interface ActorTickProfile {
  className: string;
  instanceCount: number;
  avgTickMs: number;
  maxTickMs: number;
  totalTickMs: number;
  tickFrequencyHz: number;
  /** Percentage of total game thread time */
  gameThreadPercent: number;
  /** Suggestions from triage */
  suggestedFrequencyHz?: number;
}

/** Memory allocation by category */
export interface MemoryAllocation {
  category: string;
  currentMB: number;
  peakMB: number;
  allocationCount: number;
  /** MB per second allocation rate */
  allocationRateMBps: number;
}

/** GC pause event */
export interface GCPauseEvent {
  timestampMs: number;
  durationMs: number;
  objectsCollected: number;
  memoryFreedMB: number;
}

/** A complete profiling session */
export interface ProfilingSession {
  id: string;
  name: string;
  source: ProfileSourceType;
  /** Project path that produced this data */
  projectPath: string;
  importedAt: string;
  durationMs: number;
  frameCount: number;

  /** Summary metrics */
  summary: ProfilingSummary;

  /** Frame timing samples (may be downsampled for large traces) */
  frameSamples: FrameTimingSample[];

  /** Per-actor tick costs */
  actorProfiles: ActorTickProfile[];

  /** Memory breakdown */
  memoryAllocations: MemoryAllocation[];

  /** GC pause events */
  gcPauses: GCPauseEvent[];
}

/** Aggregated summary of a profiling session */
export interface ProfilingSummary {
  avgFrameMs: number;
  p99FrameMs: number;
  minFPS: number;
  avgFPS: number;
  maxFPS: number;

  avgGameThreadMs: number;
  avgRenderThreadMs: number;
  avgGpuMs: number;

  totalDrawCalls: number;
  avgDrawCallsPerFrame: number;
  peakDrawCalls: number;

  totalMemoryMB: number;
  peakMemoryMB: number;

  gcPauseCount: number;
  avgGcPauseMs: number;
  maxGcPauseMs: number;
  totalGcTimeMs: number;

  /** Frame budget target in ms (default 16.67 for 60fps) */
  frameBudgetMs: number;
  /** Percentage of frames meeting budget */
  budgetHitRate: number;
}

/** AI triage finding — an identified performance issue */
export interface PerformanceFinding {
  id: string;
  priority: OptimizationPriority;
  category: FrameBudgetCategory | 'memory' | 'tick' | 'draw-calls' | 'asset-loading';
  title: string;
  description: string;
  /** Estimated ms savings per frame */
  estimatedSavingsMs: number;
  /** Specific actor/class involved */
  involvedClasses: string[];
  /** Generated fix prompt for CLI */
  fixPrompt: string;
  /** Checklist item label for arpg-polish */
  checklistLabel: string;
  /** Metric that triggered this finding */
  metric: string;
  metricValue: number;
  metricThreshold: number;
}

/** Full triage result */
export interface TriageResult {
  sessionId: string;
  findings: PerformanceFinding[];
  overallScore: number; // 0-100, higher = better performance
  bottleneck: FrameBudgetCategory | 'balanced';
  generatedAt: string;
}

// ── CSV Stat Row (UE5 stat dump format) ─────────────────────────────────────

export interface CSVStatRow {
  /** stat name e.g. "STAT_GameThread" */
  name: string;
  /** Inclusive time in ms */
  inclusiveMs: number;
  /** Exclusive time in ms */
  exclusiveMs: number;
  /** Call count per frame */
  callCount: number;
  /** Category grouping */
  group: string;
}

// ── API Types ───────────────────────────────────────────────────────────────

export interface ImportCSVRequest {
  csvContent: string;
  sessionName: string;
  projectPath: string;
}

export interface GenerateSampleRequest {
  projectPath: string;
  scenarioType: 'combat-heavy' | 'exploration' | 'menu' | 'loading' | 'custom';
  enemyCount: number;
  targetFPS: number;
}

export interface TriageRequest {
  sessionId: string;
}
