import { STATUS_ERROR, STATUS_WARNING, STATUS_BLOCKER } from '@/lib/chart-colors';

export function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return STATUS_ERROR;
    case 'high': return STATUS_BLOCKER;
    case 'medium': return STATUS_WARNING;
    default: return 'var(--text-muted)';
  }
}
