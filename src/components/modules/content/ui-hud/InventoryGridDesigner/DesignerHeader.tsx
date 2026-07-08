import { Grid3x3, Shield, Package, MousePointer2 } from 'lucide-react';
import { SectionTab } from './SectionTab';

type Section = 'grid' | 'slots' | 'equip' | 'interact';

export function DesignerHeader({
  activeSection,
  setActiveSection,
}: {
  activeSection: Section;
  setActiveSection: (s: Section) => void;
}) {
  return (
    <div className="relative z-10 w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 w-full border-b border-violet-900/40 pb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shadow-[inset_0_0_15px_rgba(167,139,250,0.1)]">
          <Grid3x3 className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-widest uppercase text-violet-100 shadow-[0_0_10px_rgba(167,139,250,0.5)]">Tactical Grid Configurator</h3>
          <p className="text-xs text-violet-400/60 uppercase mt-1">
            INVENTORY_LAYOUT_AND_INTERACTION_MATRIX
          </p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex items-center border-b border-violet-900/40 pb-0">
        <SectionTab
          label="Grid"
          icon={<Grid3x3 className="w-4 h-4" />}
          active={activeSection === 'grid'}
          onClick={() => setActiveSection('grid')}
        />
        <SectionTab
          label="Types"
          icon={<Package className="w-4 h-4" />}
          active={activeSection === 'slots'}
          onClick={() => setActiveSection('slots')}
        />
        <SectionTab
          label="Equip"
          icon={<Shield className="w-4 h-4" />}
          active={activeSection === 'equip'}
          onClick={() => setActiveSection('equip')}
        />
        <SectionTab
          label="Inputs"
          icon={<MousePointer2 className="w-4 h-4" />}
          active={activeSection === 'interact'}
          onClick={() => setActiveSection('interact')}
        />
      </div>
    </div>
  );
}
