import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type {
  AntiPatternHit,
  AntiPatternCategory,
  Severity,
  FileChurn,
  ShotgunSurgery,
  RefactoringItem,
} from '@/types/codebase-archeologist';
import { SEVERITY_TOKENS, type SeverityToken } from '@/lib/chart-colors';

// ── Stable empty references (Zustand selector safety) ──

export const EMPTY_HITS: AntiPatternHit[] = [];
export const EMPTY_CHURN: FileChurn[] = [];
export const EMPTY_SURGERY: ShotgunSurgery[] = [];
export const EMPTY_BACKLOG: RefactoringItem[] = [];

// ── Helpers ──

export type ViewTab = 'overview' | 'anti-patterns' | 'churn' | 'backlog';

export const CATEGORY_LABELS: Record<AntiPatternCategory, string> = {
  'missing-generated-body': 'Missing GENERATED_BODY()',
  'circular-include': 'Circular Includes',
  'hard-coded-asset-path': 'Hard-coded Asset Paths',
  'untracked-newobject': 'Untracked NewObject',
  'deprecated-api': 'Deprecated API',
  'god-class': 'God Class',
};

// Shared severity tokens — keeps critical/warning/info identical to Deep Eval
// and GDD Compliance instead of the local text-red-400 / text-yellow-400 set.
export const SEVERITY_CONFIG: Record<Severity, SeverityToken & { icon: typeof AlertCircle }> = {
  critical: { icon: AlertCircle, ...SEVERITY_TOKENS.critical },
  warning:  { icon: AlertTriangle, ...SEVERITY_TOKENS.warning },
  info:     { icon: Info, ...SEVERITY_TOKENS.info },
};
