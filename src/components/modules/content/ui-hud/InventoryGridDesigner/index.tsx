'use client';

import { useState, useCallback } from 'react';
import type {
  InventoryConfig,
  InteractionMode,
} from '@/lib/prompts/inventory';
import {
  DEFAULT_CONFIG,
} from '@/lib/prompts/inventory';
import { DesignerHeader } from './DesignerHeader';
import { GridSection } from './GridSection';
import { SlotTypesSection } from './SlotTypesSection';
import { EquipSection } from './EquipSection';
import { InteractSection } from './InteractSection';
import { SummaryBar } from './SummaryBar';

interface InventoryGridDesignerProps {
  onGenerate: (config: InventoryConfig) => void;
  isGenerating: boolean;
}

export function InventoryGridDesigner({ onGenerate, isGenerating }: InventoryGridDesignerProps) {
  const [config, setConfig] = useState<InventoryConfig>(() => structuredClone(DEFAULT_CONFIG));
  const [activeSection, setActiveSection] = useState<'grid' | 'slots' | 'equip' | 'interact'>('grid');

  // ── Grid dimension handlers ──

  const setCols = useCallback((v: number) => {
    setConfig((c) => ({ ...c, gridCols: Math.max(2, Math.min(12, v)) }));
  }, []);

  const setRows = useCallback((v: number) => {
    setConfig((c) => ({ ...c, gridRows: Math.max(2, Math.min(8, v)) }));
  }, []);

  // ── Slot type toggles ──

  const toggleSlotType = useCallback((id: string) => {
    setConfig((c) => ({
      ...c,
      slotTypes: c.slotTypes.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  }, []);

  // ── Equipment slot toggles ──

  const toggleEquipSlot = useCallback((id: string) => {
    setConfig((c) => ({
      ...c,
      equipmentSlots: c.equipmentSlots.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  }, []);

  // ── Interaction toggles ──

  const toggleInteraction = useCallback((id: InteractionMode) => {
    setConfig((c) => ({
      ...c,
      interactions: c.interactions.includes(id)
        ? c.interactions.filter((i) => i !== id)
        : [...c.interactions, id],
    }));
  }, []);

  const enabledSlots = config.slotTypes.filter((s) => s.enabled);
  const enabledEquip = config.equipmentSlots.filter((s) => s.enabled);
  const totalSlots = config.gridCols * config.gridRows;

  return (
    <div className="space-y-6 bg-[#03030a] p-6 rounded-2xl border border-violet-900/30 shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] relative w-full overflow-hidden">
      {/* Ambient tech background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 -right-1/4 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] opacity-30 pointer-events-none" />
      </div>

      <DesignerHeader activeSection={activeSection} setActiveSection={setActiveSection} />

      {/* ─── Grid Configuration ─── */}
      <div className="relative z-10 space-y-6 pt-4">
        {activeSection === 'grid' && (
          <GridSection
            config={config}
            setConfig={setConfig}
            setCols={setCols}
            setRows={setRows}
            enabledSlots={enabledSlots}
            enabledEquip={enabledEquip}
            totalSlots={totalSlots}
          />
        )}

        {/* ─── Item Slot Types ─── */}
        {activeSection === 'slots' && (
          <SlotTypesSection config={config} toggleSlotType={toggleSlotType} />
        )}

        {/* ─── Equipment Layout ─── */}
        {activeSection === 'equip' && (
          <EquipSection config={config} toggleEquipSlot={toggleEquipSlot} enabledEquip={enabledEquip} />
        )}

        {/* ─── Interaction Modes ─── */}
        {activeSection === 'interact' && (
          <InteractSection config={config} toggleInteraction={toggleInteraction} />
        )}

        {/* ─── Summary & Generate ─── */}
        <SummaryBar
          config={config}
          totalSlots={totalSlots}
          enabledSlots={enabledSlots}
          enabledEquip={enabledEquip}
          onGenerate={onGenerate}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
}
