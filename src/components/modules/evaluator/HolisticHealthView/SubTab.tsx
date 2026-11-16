import { onTablistKeyDown } from '../UnifiedSummaryView/ViewModeToggle';

export const HEALTH_PANEL_ID = 'health-view-panel';
export const healthTabId = (tab: string) => `health-tab-${tab}`;

export function SubTab({ tab, label, active, onClick }: { tab: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      id={healthTabId(tab)}
      role="tab"
      aria-selected={active}
      aria-controls={HEALTH_PANEL_ID}
      tabIndex={active ? 0 : -1}
      onKeyDown={onTablistKeyDown}
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {label}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-emerald-400" />}
    </button>
  );
}
