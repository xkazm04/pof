import { MODULE_LABELS } from '@/lib/module-registry';
import { STATUS_ERROR, STATUS_WARNING, STATUS_STALE } from '@/lib/chart-colors';

// ── Helpers ──

export function moduleLabel(id: string): string {
  return MODULE_LABELS[id] ?? id;
}

export function similarityColor(sim: number): string {
  if (sim >= 0.6) return STATUS_ERROR;
  if (sim >= 0.4) return STATUS_WARNING;
  return STATUS_STALE;
}
