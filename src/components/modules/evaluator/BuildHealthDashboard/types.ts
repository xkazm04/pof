import type { BuildHealthReport } from '@/lib/ue5-bridge/build-health';

export interface BuildHealthDashboardProps {
  /** Pre-supplied report — bypasses the network fetch (used by tests / SSR). */
  initialReport?: BuildHealthReport;
}
