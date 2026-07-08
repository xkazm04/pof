import type { CrashType, CrashSeverity } from '@/types/crash-analyzer';

// ── Constants ───────────────────────────────────────────────────────────────

// Crash severities draw from the shared SEVERITY_TOKENS map (chart-colors), the
// same source Deep Eval / GDD Compliance / Archeologist use — so a `critical`
// crash renders with the identical hue everywhere instead of mixing status-red
// design tokens with raw orange/amber/blue palette classes. `CrashSeverity`
// (critical|high|medium|low) is a subset of the token keys, so direct indexing
// is type-safe.
export const SEVERITY_LABELS: Record<CrashSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const CRASH_TYPE_LABELS: Record<CrashType, string> = {
  nullptr_deref: 'Null Pointer',
  access_violation: 'Access Violation',
  assertion_failed: 'Assertion',
  ensure_failed: 'Ensure',
  gc_reference: 'GC Reference',
  stack_overflow: 'Stack Overflow',
  out_of_memory: 'OOM',
  unhandled_exception: 'Unhandled',
  fatal_error: 'Fatal Error',
  gpu_crash: 'GPU Crash',
  unknown: 'Unknown',
};

export type ViewTab = 'crashes' | 'patterns' | 'import' | 'health';
