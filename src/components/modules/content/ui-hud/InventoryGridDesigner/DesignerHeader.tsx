import { Grid3x3, Shield, Package, MousePointer2 } from 'lucide-react';
import { SectionTab } from './SectionTab';

type Section = 'grid' | 'slots' | 'equip' | 'interact';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'grid', label: 'Grid', icon: <Grid3x3 className="w-4 h-4" /> },
  { id: 'slots', label: 'Types', icon: <Package className="w-4 h-4" /> },
  { id: 'equip', label: 'Equip', icon: <Shield className="w-4 h-4" /> },
  { id: 'interact', label: 'Inputs', icon: <MousePointer2 className="w-4 h-4" /> },
];

/** Tab / panel ids — shared with the panels rendered in `index.tsx`. */
export const tabId = (s: Section) => `inventory-tab-${s}`;
export const panelId = (s: Section) => `inventory-panel-${s}`;

export function DesignerHeader({
  activeSection,
  setActiveSection,
}: {
  activeSection: Section;
  setActiveSection: (s: Section) => void;
}) {
  // Arrow/Home/End roving focus over the tab strip (WAI-ARIA tabs pattern,
  // automatic activation). Reads the rendered tabs so the strip stays the
  // single source of tab order.
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const current = tabs.findIndex((t) => t === document.activeElement);
    if (current === -1) return;
    e.preventDefault();
    const next =
      e.key === 'Home' ? 0
        : e.key === 'End' ? tabs.length - 1
          : e.key === 'ArrowRight' ? (current + 1) % tabs.length
            : (current - 1 + tabs.length) % tabs.length;
    tabs[next].focus();
    tabs[next].click();
  };

  return (
    <div className="relative z-10 w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 w-full border-b border-violet-900/40 pb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shadow-[inset_0_0_15px_rgba(167,139,250,0.1)]">
          <Grid3x3 className="w-5 h-5 text-violet-400" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-widest uppercase text-violet-100 shadow-[0_0_10px_rgba(167,139,250,0.5)]">Tactical Grid Configurator</h3>
          <p className="text-xs text-violet-400/60 uppercase mt-1">
            INVENTORY_LAYOUT_AND_INTERACTION_MATRIX
          </p>
        </div>
      </div>

      {/* Section tabs */}
      <div
        role="tablist"
        aria-label="Inventory designer sections"
        onKeyDown={handleTabKeyDown}
        className="flex items-center border-b border-violet-900/40 pb-0"
      >
        {SECTIONS.map((s) => (
          <SectionTab
            key={s.id}
            id={tabId(s.id)}
            panelId={panelId(s.id)}
            label={s.label}
            icon={s.icon}
            active={activeSection === s.id}
            onClick={() => setActiveSection(s.id)}
          />
        ))}
      </div>
    </div>
  );
}
