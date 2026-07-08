export type ViewTab = 'overview' | 'velocity' | 'quality' | 'milestones';

export interface HolisticHealthViewProps {
  /** Drill from a subsystem signal / dimension card into its source evaluator tab. */
  onNavigateTab?: (tab: string) => void;
}
