import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { BuildStatus } from '@/types/ue5-bridge';

export function statusColor(status: BuildStatus): string {
  if (status === 'success') return STATUS_SUCCESS;
  if (status === 'failed') return STATUS_ERROR;
  if (status === 'aborted') return STATUS_WARNING;
  return STATUS_NEUTRAL;
}
