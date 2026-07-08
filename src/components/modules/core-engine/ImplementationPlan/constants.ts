import { CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { type EffortLevel } from '@/lib/implementation-planner/effort-estimator';

// ---------- Constants ----------

export const EFFORT_COLORS: Record<EffortLevel, { bg: string; text: string }> = {
  trivial: { bg: 'bg-green-500/15', text: 'text-green-400' },
  small: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  medium: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  large: { bg: 'bg-status-red-medium', text: 'text-red-400' },
};

export const STATUS_STYLES: Record<string, { icon: typeof CheckCircle; color: string }> = {
  partial: { icon: AlertCircle, color: 'text-yellow-400' },
  missing: { icon: Circle, color: 'text-red-400' },
  unknown: { icon: Circle, color: 'text-text-muted' },
};

export const PAGE_SIZE = 25;
