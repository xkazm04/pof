'use client';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { handleRovingTabKeyDown } from '@/components/ui/rovingTab';
import { OPACITY_10 } from '@/lib/chart-colors';
import { ColorPickerField, SliderField } from './Fields';
import { FadeTimeline } from './FadeTimeline';
import { sectionParams, readColor, type HudSection, type HudThemeParam } from './themeSchema';
import type { HudTheme, RGBA } from './types';

type SectionId = HudSection;

interface Section {
  id: SectionId;
  label: string;
  color: string;
}

const tabId = (s: SectionId) => `hud-theme-tab-${s}`;
const panelId = (s: SectionId) => `hud-theme-panel-${s}`;

// One panel per section, rendered from the parameter table: colour rows first,
// then sliders, in table order. Each UPROPERTY has exactly one control.
const SECTION_HEADINGS: Record<SectionId, { colors: string; floats: string }> = {
  health: { colors: 'ARPGHUDWidget Colors', floats: 'Low-Health Pulse' },
  damage: { colors: 'Element Colors', floats: 'Font & Animation' },
  enemy: { colors: 'EnemyHealthBarWidget', floats: 'Bar & Fade Timing' },
};

const heading = 'text-xs font-bold text-text-muted uppercase';

function ParamControl({ p, theme, setParam }: {
  p: HudThemeParam;
  theme: HudTheme;
  setParam: (p: HudThemeParam, value: number | RGBA) => void;
}) {
  if (p.kind === 'color') {
    return <ColorPickerField label={p.label} value={readColor(theme, p)} onChange={(c) => setParam(p, c)} />;
  }
  const scale = p.displayScale;
  const toDisplay = (v: number) => (scale === 1 ? v : Math.round(v * scale));
  // The readout prints the export's precision, shifted by the display scale (0.25 at 2 dp, x100 -> "25").
  const decimals = Math.max(0, p.precision - Math.round(Math.log10(scale)));
  return (
    <SliderField
      label={p.label}
      value={toDisplay(theme[p.key])}
      min={toDisplay(p.min)} max={toDisplay(p.max)} step={toDisplay(p.step)} unit={p.unit}
      onChange={(v) => setParam(p, v / scale)}
      color={p.accent}
      decimals={decimals}
    />
  );
}

export function ParameterEditor({
  theme,
  setParam,
  activeSection,
  setActiveSection,
  sections,
}: {
  theme: HudTheme;
  setParam: (p: HudThemeParam, value: number | RGBA) => void;
  activeSection: SectionId;
  setActiveSection: (id: SectionId) => void;
  sections: Section[];
}) {
  const params = sectionParams(activeSection);
  const colors = params.filter(p => p.kind === 'color');
  const floats = params.filter(p => p.kind === 'float');
  const headings = SECTION_HEADINGS[activeSection];
  return (
    <SurfaceCard level={2} className="p-3 space-y-3">
      {/* Section tabs */}
      <div
        role="tablist"
        aria-label="HUD theme parameter sections"
        onKeyDown={handleRovingTabKeyDown}
        className="flex gap-1"
      >
        {sections.map(s => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={tabId(s.id)}
            aria-selected={activeSection === s.id}
            aria-controls={panelId(s.id)}
            // Roving tabindex — Arrow/Home/End move between tabs.
            tabIndex={activeSection === s.id ? 0 : -1}
            onClick={() => setActiveSection(s.id)}
            className="focus-ring flex-1 px-2 py-1.5 text-2xs font-bold rounded-md border transition-colors"
            style={{
              borderColor: activeSection === s.id ? s.color : 'var(--border)',
              backgroundColor: activeSection === s.id ? `${s.color}${OPACITY_10}` : 'transparent',
              color: activeSection === s.id ? s.color : 'var(--text-muted)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div
        className="space-y-3"
        role="tabpanel"
        id={panelId(activeSection)}
        aria-labelledby={tabId(activeSection)}
      >
        <div className={heading}>{headings.colors}</div>
        {colors.map(p => <ParamControl key={p.ueName} p={p} theme={theme} setParam={setParam} />)}
        <div className="h-px bg-border/40" />
        <div className={heading}>{headings.floats}</div>
        {floats.map(p => <ParamControl key={p.ueName} p={p} theme={theme} setParam={setParam} />)}

        {activeSection === 'enemy' && (
          <>
            {/* Fade timeline visualization */}
            <div className={`${heading} mt-2`}>Fade Timeline</div>
            <div className="relative h-10 rounded bg-black/40 border border-border/40 overflow-hidden">
              <FadeTimeline theme={theme} />
            </div>
          </>
        )}
      </div>
    </SurfaceCard>
  );
}
