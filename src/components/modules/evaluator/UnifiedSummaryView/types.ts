// ─── Types ───────────────────────────────────────────────────────────────────

export type TabId = 'quality' | 'dependencies' | 'analytics' | 'scanner';

export interface Props {
  onNavigateTab: (tab: TabId) => void;
}

export type ViewMode = 'detailed' | 'brief';
