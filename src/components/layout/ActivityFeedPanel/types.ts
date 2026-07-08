import type { ActivityEvent, ActivityEventType } from '@/stores/activityFeedStore';
import type { SubModuleId } from '@/types/modules';

// ── Time grouping ──

export type TimePeriod = 'Today' | 'Yesterday' | 'Earlier this week' | 'Older';

export interface EventGroup {
  type: ActivityEventType;
  moduleId: SubModuleId | undefined;
  events: ActivityEvent[];
}

export interface TimePeriodSection {
  period: TimePeriod;
  groups: EventGroup[];
}
