'use client';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO,
  ACCENT_CYAN, ACCENT_VIOLET,
  OPACITY_10,
} from '@/lib/chart-colors';
import { ColorPickerField, SliderField } from './Fields';
import { FadeTimeline } from './FadeTimeline';
import type { HudTheme, RGBA } from './types';

type SectionId = 'health' | 'damage' | 'enemy';

interface Section {
  id: SectionId;
  label: string;
  color: string;
}

export function ParameterEditor({
  theme,
  update,
  updateElementColor,
  activeSection,
  setActiveSection,
  sections,
}: {
  theme: HudTheme;
  update: <K extends keyof HudTheme>(key: K, value: HudTheme[K]) => void;
  updateElementColor: (element: string, color: RGBA) => void;
  activeSection: SectionId;
  setActiveSection: (id: SectionId) => void;
  sections: Section[];
}) {
  return (
    <SurfaceCard level={2} className="p-3 space-y-3">
      {/* Section tabs */}
      <div className="flex gap-1">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="flex-1 px-2 py-1.5 text-2xs font-bold rounded-md border transition-colors"
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

      {/* Health & Mana section */}
      {activeSection === 'health' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-text-muted uppercase">
            ARPGHUDWidget Colors
          </div>
          <ColorPickerField
            label="Healthy Color"
            value={theme.healthyColor}
            onChange={(c) => update('healthyColor', c)}
          />
          <ColorPickerField
            label="Danger Color"
            value={theme.dangerColor}
            onChange={(c) => update('dangerColor', c)}
          />
          <ColorPickerField
            label="Mana Color"
            value={theme.manaColor}
            onChange={(c) => update('manaColor', c)}
          />
          <div className="h-px bg-border/40" />
          <div className="text-xs font-bold text-text-muted uppercase">
            Low-Health Pulse
          </div>
          <SliderField
            label="LowHealthThreshold"
            value={Math.round(theme.lowHealthThreshold * 100)}
            min={5} max={75} step={1} unit="%"
            onChange={(v) => update('lowHealthThreshold', v / 100)}
            color={STATUS_WARNING}
          />
          <SliderField
            label="LowHealthPulseSpeed"
            value={theme.lowHealthPulseSpeed}
            min={0.5} max={6} step={0.1} unit=" Hz"
            onChange={(v) => update('lowHealthPulseSpeed', v)}
            color={STATUS_SUCCESS}
          />
          <SliderField
            label="BarInterpSpeed"
            value={theme.barInterpSpeed}
            min={1} max={30} step={0.5} unit="/s"
            onChange={(v) => update('barInterpSpeed', v)}
            color={ACCENT_CYAN}
          />
        </div>
      )}

      {/* Damage Numbers section */}
      {activeSection === 'damage' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-text-muted uppercase">
            Element Colors
          </div>
          {Object.entries(theme.elementColors).map(([name, color]) => (
            <ColorPickerField
              key={name}
              label={name}
              value={color}
              onChange={(c) => updateElementColor(name, c)}
            />
          ))}
          <div className="h-px bg-border/40" />
          <div className="text-xs font-bold text-text-muted uppercase">
            Font & Animation
          </div>
          <SliderField
            label="Normal Font Size"
            value={theme.normalFontSize}
            min={10} max={32} step={1} unit="pt"
            onChange={(v) => update('normalFontSize', v)}
            color={STATUS_INFO}
          />
          <SliderField
            label="Crit Font Size"
            value={theme.critFontSize}
            min={16} max={48} step={1} unit="pt"
            onChange={(v) => update('critFontSize', v)}
            color={STATUS_WARNING}
          />
          <SliderField
            label="Float Distance"
            value={theme.floatDistance}
            min={20} max={200} step={5} unit="px"
            onChange={(v) => update('floatDistance', v)}
          />
          <SliderField
            label="Horizontal Spread"
            value={theme.horizontalSpread}
            min={0} max={80} step={5} unit="px"
            onChange={(v) => update('horizontalSpread', v)}
          />
          <SliderField
            label="Damage Lifetime"
            value={theme.damageLifetime}
            min={0.3} max={3.0} step={0.1} unit="s"
            onChange={(v) => update('damageLifetime', v)}
            color={ACCENT_VIOLET}
          />
        </div>
      )}

      {/* Enemy HP Bar section */}
      {activeSection === 'enemy' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-text-muted uppercase">
            EnemyHealthBarWidget
          </div>
          <ColorPickerField
            label="Enemy Bar Color"
            value={theme.enemyBarColor}
            onChange={(c) => update('enemyBarColor', c)}
          />
          <div className="h-px bg-border/40" />
          <div className="text-xs font-bold text-text-muted uppercase">
            Fade Timing
          </div>
          <SliderField
            label="FadeInDuration"
            value={theme.fadeInDuration}
            min={0.05} max={1.0} step={0.05} unit="s"
            onChange={(v) => update('fadeInDuration', v)}
            color={STATUS_SUCCESS}
          />
          <SliderField
            label="FadeOutDuration"
            value={theme.fadeOutDuration}
            min={0.1} max={2.0} step={0.05} unit="s"
            onChange={(v) => update('fadeOutDuration', v)}
            color={ACCENT_VIOLET}
          />
          <SliderField
            label="FadeOutDelay"
            value={theme.fadeOutDelay}
            min={0.5} max={10} step={0.5} unit="s"
            onChange={(v) => update('fadeOutDelay', v)}
            color={STATUS_WARNING}
          />
          <SliderField
            label="BarInterpSpeed"
            value={theme.barInterpSpeed}
            min={1} max={30} step={0.5} unit="/s"
            onChange={(v) => update('barInterpSpeed', v)}
            color={ACCENT_CYAN}
          />

          {/* Fade timeline visualization */}
          <div className="text-xs font-bold text-text-muted uppercase mt-2">
            Fade Timeline
          </div>
          <div className="relative h-10 rounded bg-black/40 border border-border/40 overflow-hidden">
            <FadeTimeline theme={theme} />
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}
