import {
  Eye, Ear, Crosshair, Tag, Sparkles, AlertTriangle,
  CheckCircle2, XCircle, Circle, CircleDot, Loader2,
} from 'lucide-react';
import type { StimulusType, ScenarioStatus } from '@/types/ai-testing';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  STATUS_INFO, STATUS_BLOCKER, STATUS_NEUTRAL, ACCENT_PURPLE,
} from '@/lib/chart-colors';

export const SYSTEMS_ACCENT = MODULE_COLORS.systems;

// ── Stimulus type metadata ──

export const STIMULUS_META: Record<StimulusType, { label: string; icon: typeof Eye; color: string }> = {
  perception_sight: { label: 'Sight', icon: Eye, color: STATUS_INFO },
  perception_hearing: { label: 'Hearing', icon: Ear, color: STATUS_WARNING },
  perception_damage: { label: 'Damage Sense', icon: Crosshair, color: STATUS_ERROR },
  damage_event: { label: 'Damage Event', icon: AlertTriangle, color: STATUS_BLOCKER },
  gameplay_tag: { label: 'Gameplay Tag', icon: Tag, color: STATUS_SUCCESS },
  custom: { label: 'Custom', icon: Sparkles, color: ACCENT_PURPLE },
};

// Status metadata — icon + label + color so status survives colorblindness and
// grayscale (WCAG 1.4.1), rather than a color-only dot. `spin` marks in-progress.
export const STATUS_META: Record<ScenarioStatus, { icon: typeof Circle; label: string; color: string; spin?: boolean }> = {
  draft: { icon: Circle, label: 'Draft', color: STATUS_NEUTRAL },
  ready: { icon: CircleDot, label: 'Ready', color: STATUS_INFO },
  running: { icon: Loader2, label: 'Running', color: STATUS_WARNING, spin: true },
  passed: { icon: CheckCircle2, label: 'Passed', color: STATUS_SUCCESS },
  failed: { icon: XCircle, label: 'Failed', color: STATUS_ERROR },
  error: { icon: AlertTriangle, label: 'Error', color: STATUS_BLOCKER },
};

export const COMMIT_DEBOUNCE_MS = 400;
