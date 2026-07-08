import { ACCENT_ORANGE } from '@/lib/chart-colors';

export const ACCENT = ACCENT_ORANGE;

export type TriageFilter = 'open' | 'all' | 'triaged';

export const TRIAGE_FILTER_LABELS: Record<TriageFilter, string> = {
  open: 'Open',
  all: 'All',
  triaged: 'Triaged',
};
