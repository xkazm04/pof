'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { DzinLayout } from '@/lib/dzin/core';
import { pofRegistry } from '@/lib/dzin/panel-definitions';
import { COMPOSITION_PRESETS } from '@/lib/dzin/composition-presets';
import { DzinSelectionProvider, useDzinSelection } from '@/lib/dzin/selection-context';
import { DZIN_TIMING, EASE_ENTER, type CubicBezier } from '@/lib/dzin/animation-constants';
import { useIntentDispatch } from '@/hooks/useIntentDispatch';
import { useMultimodalInput } from '@/hooks/useMultimodalInput';
import { ConversationShell } from '@/components/prototype/chat/ConversationShell';
import { CorePanel } from '@/components/modules/core-engine/dzin-panels/CorePanel';
import { AbilitiesPanel } from '@/components/modules/core-engine/dzin-panels/AbilitiesPanel';
import { AttributesPanel } from '@/components/modules/core-engine/dzin-panels/AttributesPanel';
import { EffectsPanel } from '@/components/modules/core-engine/dzin-panels/EffectsPanel';
import { EffectTimelinePanel } from '@/components/modules/core-engine/dzin-panels/EffectTimelinePanel';
import { DamageCalcPanel } from '@/components/modules/core-engine/dzin-panels/DamageCalcPanel';
import { TagsPanel } from '@/components/modules/core-engine/dzin-panels/TagsPanel';
import { TagDepsPanel } from '@/components/modules/core-engine/dzin-panels/TagDepsPanel';
import { TagAuditPanel } from '@/components/modules/core-engine/dzin-panels/TagAuditPanel';
import { LoadoutPanel } from '@/components/modules/core-engine/dzin-panels/LoadoutPanel';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { PanelDensity } from '@/lib/dzin/core/types/panel';
import type { PanelDirective, LayoutTemplateId, SlotAssignment } from '@/lib/dzin/core/layout/types';
import type { FeatureRow } from '@/types/feature-matrix';
import type { FeatureDefinition } from '@/lib/feature-definitions';

/* ── Resize presets ────────────────────────────────────────────────────── */

const RESIZE_PRESETS = {
  Small: 160,
  Medium: 320,
  Large: 800,
} as const;

type ResizePreset = keyof typeof RESIZE_PRESETS;
type ControlMode = 'override' | 'resize';

const DENSITIES: PanelDensity[] = ['micro', 'compact', 'full'];

/* ── Template thumbnails ───────────────────────────────────────────────── */

const TEMPLATE_OPTIONS: { id: LayoutTemplateId; label: string }[] = [
  { id: 'split-2', label: 'Split 2' },
  { id: 'grid-4', label: 'Grid 4' },
  { id: 'primary-sidebar', label: 'Primary + Sidebar' },
  { id: 'studio', label: 'Studio' },
];

function TemplateThumbnail({ id }: { id: LayoutTemplateId }) {
  const fill = 'fill-blue-400/60';
  const gap = 1;
  const w = 24;
  const h = 24;

  switch (id) {
    case 'split-2':
      return (
        <svg width={w} height={h} viewBox="0 0 24 24" className="block">
          <rect x={0} y={0} width={15} height={h} rx={2} className={fill} />
          <rect x={15 + gap} y={0} width={8} height={h} rx={2} className={fill} />
        </svg>
      );
    case 'grid-4':
      return (
        <svg width={w} height={h} viewBox="0 0 24 24" className="block">
          <rect x={0} y={0} width={11} height={11} rx={2} className={fill} />
          <rect x={12} y={0} width={12} height={11} rx={2} className={fill} />
          <rect x={0} y={12} width={11} height={12} rx={2} className={fill} />
          <rect x={12} y={12} width={12} height={12} rx={2} className={fill} />
        </svg>
      );
    case 'primary-sidebar':
      return (
        <svg width={w} height={h} viewBox="0 0 24 24" className="block">
          <rect x={0} y={0} width={17} height={h} rx={2} className={fill} />
          <rect x={18} y={0} width={6} height={h} rx={2} className={fill} />
        </svg>
      );
    case 'studio':
      return (
        <svg width={w} height={h} viewBox="0 0 24 24" className="block">
          <rect x={0} y={0} width={15} height={15} rx={2} className={fill} />
          <rect x={16} y={0} width={8} height={7} rx={1} className={fill} />
          <rect x={16} y={8} width={8} height={7} rx={1} className={fill} />
          <rect x={0} y={16} width={11} height={8} rx={1} className={fill} />
          <rect x={12} y={16} width={12} height={8} rx={1} className={fill} />
        </svg>
      );
    default:
      return null;
  }
}

/* ── Panel dispatch ────────────────────────────────────────────────────── */

const PANEL_COMPONENTS: Record<string, React.FC<{ featureMap: Map<string, FeatureRow>; defs: FeatureDefinition[] }>> = {
  'arpg-combat-core': CorePanel,
  'arpg-combat-abilities': AbilitiesPanel,
  'arpg-combat-attributes': AttributesPanel,
  'arpg-combat-effects': EffectsPanel,
  'arpg-combat-effect-timeline': EffectTimelinePanel,
  'arpg-combat-damage-calc': DamageCalcPanel,
  'arpg-combat-tags': TagsPanel,
  'arpg-combat-tag-deps': TagDepsPanel,
  'arpg-combat-tag-audit': TagAuditPanel,
  'arpg-combat-loadout': LoadoutPanel,
};

/* ── Layout transition constants ───────────────────────────────────────── */

const layoutTransition = {
  duration: DZIN_TIMING.LAYOUT,
  ease: EASE_ENTER as CubicBezier,
};

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function PrototypePage() {
  const firstPreset = COMPOSITION_PRESETS[0];

  const [mode, setMode] = useState<ControlMode>('override');
  const [selectedDensity, setSelectedDensity] = useState<PanelDensity>('full');
  const [selectedPreset, setSelectedPreset] = useState<ResizePreset>('Large');
  const containerRef = useRef<HTMLDivElement>(null);

  const [templateId, setTemplateId] = useState<LayoutTemplateId>(firstPreset.templateId);
  const [activePresetId, setActivePresetId] = useState<string | null>(firstPreset.id);
  const [directives, setDirectives] = useState<PanelDirective[]>(firstPreset.directives);

  /* ── Intent system wiring ──────────────────────────────────────────── */

  const handleWorkspaceChange = useCallback((newDirectives: PanelDirective[], newTemplate: LayoutTemplateId) => {
    setDirectives(newDirectives);
    setTemplateId(newTemplate);
    setActivePresetId(null);
  }, []);

  const { bus, chatStore, advisorClient } = useIntentDispatch(
    firstPreset.directives,
    firstPreset.templateId,
    handleWorkspaceChange,
  );

  const { handleTextInput } = useMultimodalInput({
    bus,
    onLLMFallback: useCallback((text: string) => {
      // Send to advisor via HTTP
      const state = { panels: directives.map(d => ({ type: d.type, role: d.role ?? 'secondary' })), layout: templateId };
      advisorClient.sendContext(state, text);
    }, [directives, templateId, advisorClient]),
  });

  /* ── Data wiring (real hooks, no mocks) ─────────────────────────────── */

  const { features, isLoading } = useFeatureMatrix('arpg-combat');
  const defs = MODULE_FEATURE_DEFINITIONS['arpg-combat'] ?? [];

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  /* ── Directives with density override ────────────────────────────────── */

  const resolvedDirectives: PanelDirective[] = useMemo(
    () =>
      mode === 'override'
        ? directives.map((d) => ({ ...d, density: selectedDensity }))
        : directives,
    [mode, selectedDensity, directives],
  );

  /* ── Template picker handler ─────────────────────────────────────────── */

  const handleTemplateChange = useCallback((id: LayoutTemplateId) => {
    setTemplateId(id);
    setActivePresetId(null); // Manual template selection breaks preset association
  }, []);

  /* ── Preset selection handler ────────────────────────────────────────── */

  const handlePresetSelect = useCallback((preset: typeof COMPOSITION_PRESETS[number]) => {
    setTemplateId(preset.templateId);
    setDirectives(preset.directives);
    setActivePresetId(preset.id);
  }, []);

  /* ── Render panel callback ───────────────────────────────────────────── */

  const renderPanel = useCallback(
    (assignment: SlotAssignment) => {
      const Component = PANEL_COMPONENTS[assignment.panelType];
      if (!Component) return null;
      return (
        <motion.div
          layout
          layoutId={assignment.panelType}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={layoutTransition}
          className="h-full"
        >
          <Component featureMap={featureMap} defs={defs} />
        </motion.div>
      );
    },
    [featureMap, defs],
  );

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-deep flex items-center justify-center">
        <span className="text-text-muted text-sm animate-pulse">Loading feature data...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-deep p-6 flex flex-col">
      {/* Header */}
      <h1 className="text-2xl font-bold text-text mb-6">Dzin Prototype</h1>

      {/* Control bar */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <ModeButton
            label="Override"
            active={mode === 'override'}
            onClick={() => setMode('override')}
          />
          <ModeButton
            label="Resize"
            active={mode === 'resize'}
            onClick={() => setMode('resize')}
          />
        </div>

        {/* Density / Resize controls */}
        <div className="flex items-center gap-2">
          {mode === 'override' ? (
            DENSITIES.map((d) => (
              <ControlButton
                key={d}
                label={d}
                active={selectedDensity === d}
                onClick={() => setSelectedDensity(d)}
              />
            ))
          ) : (
            (Object.keys(RESIZE_PRESETS) as ResizePreset[]).map((preset) => (
              <ControlButton
                key={preset}
                label={preset}
                active={selectedPreset === preset}
                onClick={() => setSelectedPreset(preset)}
              />
            ))
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-border" />

        {/* Template picker */}
        <div className="flex items-center gap-1.5">
          {TEMPLATE_OPTIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              onClick={() => handleTemplateChange(t.id)}
              className={`p-1 rounded border transition-all ${
                templateId === t.id
                  ? 'border-blue-500/50 shadow-[0_0_6px_rgba(59,130,246,0.3)] bg-blue-500/10'
                  : 'border-transparent hover:border-border/80'
              }`}
            >
              <TemplateThumbnail id={t.id} />
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-border" />

        {/* Preset dropdown */}
        <PresetDropdown
          activePresetId={activePresetId}
          onSelect={handlePresetSelect}
        />
      </div>

      {/* Chat overlay */}
      <ConversationShell chatStore={chatStore} bus={bus} onSend={handleTextInput} />

      {/* Layout container with selection context */}
      <DzinSelectionProvider>
        <SelectionClearer directives={resolvedDirectives}>
          <div
            ref={containerRef}
            className="flex-1 min-h-[600px] transition-all duration-300 ease-in-out"
            style={
              mode === 'resize'
                ? { width: RESIZE_PRESETS[selectedPreset] }
                : undefined
            }
          >
            <LayoutGroup>
              <AnimatePresence mode="popLayout">
                <DzinLayout
                  directives={resolvedDirectives}
                  registry={pofRegistry}
                  renderPanel={renderPanel}
                  options={{ containerRef, preferredTemplate: templateId }}
                />
              </AnimatePresence>
            </LayoutGroup>
          </div>
        </SelectionClearer>
      </DzinSelectionProvider>
    </div>
  );
}

/* ── SelectionClearer ──────────────────────────────────────────────────── */

function SelectionClearer({
  directives,
  children,
}: {
  directives: PanelDirective[];
  children: React.ReactNode;
}) {
  const { setSelection } = useDzinSelection();

  useEffect(() => {
    setSelection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directives]);

  return <>{children}</>;
}

/* ── Preset dropdown ───────────────────────────────────────────────────── */

function PresetDropdown({
  activePresetId,
  onSelect,
}: {
  activePresetId: string | null;
  onSelect: (preset: typeof COMPOSITION_PRESETS[number]) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeLabel = COMPOSITION_PRESETS.find((p) => p.id === activePresetId)?.label ?? 'Custom';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border border-border bg-surface text-text-muted hover:text-text hover:border-border/80 transition-colors"
      >
        Preset: {activeLabel}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-lg border border-border bg-surface shadow-lg py-1">
            {COMPOSITION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onSelect(preset);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-surface-deep transition-colors"
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  {preset.id === activePresetId && (
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                  )}
                </span>
                <span className="flex flex-col">
                  <span className="text-text font-medium">{preset.label}</span>
                  <span className="text-text-muted text-xs">{preset.description}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Control components ────────────────────────────────────────────────── */

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
          : 'bg-surface text-text-muted hover:text-text hover:bg-surface-deep'
      }`}
    >
      {label}
    </button>
  );
}

function ControlButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
        active
          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
          : 'bg-surface border-border text-text-muted hover:text-text hover:border-border/80'
      }`}
    >
      {label}
    </button>
  );
}
