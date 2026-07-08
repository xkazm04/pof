import {
  Loader2, CheckCircle, XCircle, Clock, ChevronRight,
} from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, MODULE_COLORS } from '@/lib/chart-colors';
import type { ModuleReviewStatus } from '@/types/batch-review';

export const ACCENT = MODULE_COLORS.evaluator;

export const STATUS_ICON: Record<ModuleReviewStatus, typeof CheckCircle> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  error: XCircle,
  skipped: ChevronRight,
};

export const STATUS_COLOR: Record<ModuleReviewStatus, string> = {
  pending: 'var(--text-muted)',
  running: MODULE_COLORS.core,
  completed: STATUS_SUCCESS,
  error: STATUS_ERROR,
  skipped: 'var(--text-muted)',
};
