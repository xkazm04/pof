'use client';

import { useState, useCallback } from 'react';
import {
  Grid3x3, Shield, Sword, Zap, Package, Send, Loader2,
  Plus, Minus, GripVertical, MousePointer2, MousePointerClick, Check
} from 'lucide-react';
import type {
  InventoryConfig,
  SlotTypeConfig,
  EquipmentSlotConfig,
  InteractionMode,
} from '@/lib/prompts/inventory';
import {
  DEFAULT_CONFIG,
  ALL_INTERACTIONS,
} from '@/lib/prompts/inventory';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_SUCCESS, STATUS_INFO, ACCENT_VIOLET, STATUS_WARNING } from '@/lib/chart-colors';

// ── Equipment slot positions for the character silhouette layout ──

const EQUIP_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  head: { x: 50, y: 4, label: 'Head' },
  chest: { x: 50, y: 28, label: 'Chest' },
  hands: { x: 14, y: 28, label: 'Hands' },
  legs: { x: 50, y: 52, label: 'Legs' },
  feet: { x: 50, y: 76, label: 'Feet' },
  'weapon-l': { x: 14, y: 52, label: 'Wpn L' },
  'weapon-r': { x: 86, y: 52, label: 'Wpn R' },
  'ring-1': { x: 14, y: 76, label: 'Ring' },
  'ring-2': { x: 86, y: 76, label: 'Ring' },
  amulet: { x: 86, y: 28, label: 'Amul' },
  belt: { x: 86, y: 4, label: 'Belt' },
  cape: { x: 14, y: 4, label: 'Cape' },
};

// ── Rarity colors ──
const RARITY_COLORS: Record<string, string> = {
  Common: 'var(--text-muted)',
  Uncommon: STATUS_SUCCESS,
  Rare: STATUS_INFO,
  Epic: ACCENT_VIOLET,
  Legendary: STATUS_WARNING,
};

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
    <div className="space-y-6 bg-[#03030a] p-6 rounded-2xl border border-indigo-900/30 shadow-[inset_0_0_80px_rgba(99,102,241,0.05)] relative w-full overflow-hidden">
      {/* Ambient tech background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 -right-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] opacity-30 pointer-events-none" />
      </div>

      <div className="relative z-10 w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 w-full border-b border-indigo-900/40 pb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-[inset_0_0_15px_rgba(99,102,241,0.1)]">
            <Grid3x3 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-indigo-100 shadow-[0_0_10px_rgba(99,102,241,0.5)]">Tactical Grid Configurator</h3>
            <p className="text-[10px] text-indigo-400/60 uppercase tracking-widest mt-1">
              INVENTORY_LAYOUT_AND_INTERACTION_MATRIX
            </p>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex items-center border-b border-indigo-900/40 pb-0">
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

      {/* ─── Grid Configuration ─── */}
      <div className="relative z-10 space-y-6 pt-4">
        {activeSection === 'grid' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Dimension controls */}
            <div className="flex items-center gap-6 bg-black/40 p-4 rounded-xl border border-indigo-900/30 backdrop-blur-md shadow-lg w-fit">
              <DimensionControl label="Columns" value={config.gridCols} onChange={setCols} min={2} max={12} />
              <span className="text-indigo-500/50 text-xl font-light">×</span>
              <DimensionControl label="Rows" value={config.gridRows} onChange={setRows} min={2} max={8} />
              <div className="ml-4 flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-widest text-indigo-400/60 font-bold mb-1">Total Capacity</span>
                <div className="flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-lg text-indigo-200 font-bold tracking-wider shadow-[inset_0_0_10px_rgba(99,102,241,0.1)]">
                  {totalSlots} SLOTS
                </div>
              </div>
            </div>

            {/* Grid preview */}
            <div className="p-6 bg-black/60 border border-indigo-900/50 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.1)_inset] relative overflow-hidden">
              {/* Glow effect */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] pointer-events-none" />

              <div className="text-[10px] uppercase tracking-widest text-indigo-400 mb-6 font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                Live Matrix Preview
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                {/* Inventory grid */}
                <div className="p-4 bg-black/40 rounded-xl border border-indigo-900/40 shadow-inner relative group">
                  <div className="absolute inset-0 border border-indigo-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-[0_0_20px_rgba(99,102,241,0.1)]" />
                  <div
                    className="grid gap-1.5 relative z-10"
                    style={{
                      gridTemplateColumns: `repeat(${config.gridCols}, 1fr)`,
                      width: config.gridCols * 36 + (config.gridCols - 1) * 6,
                    }}
                  >
                    {Array.from({ length: totalSlots }, (_, i) => {
                      const slotType = enabledSlots[i % enabledSlots.length];
                      return (
                        <div
                          key={i}
                          className="w-[36px] h-[36px] rounded-lg border transition-all duration-300 flex items-center justify-center relative group/slot overflow-hidden"
                          style={{
                            borderColor: slotType ? `${slotType.color}50` : 'rgba(49,46,129,0.4)',
                            backgroundColor: slotType ? `${slotType.color}15` : 'rgba(0,0,0,0.5)',
                            boxShadow: slotType ? `inset 0 0 10px ${slotType.color}20` : 'inset 0 0 10px rgba(49,46,129,0.1)',
                          }}
                        >
                          <div className="absolute inset-0 opacity-0 group-hover/slot:opacity-100 transition-opacity bg-white/5 pointer-events-none" />
                          {i < 3 && (
                            <div
                              className="w-5 h-5 rounded-md shadow-[0_0_10px_currentColor] transition-transform group-hover/slot:scale-110"
                              style={{
                                backgroundColor: RARITY_COLORS[config.itemRarities[i]] ?? 'var(--text-muted)',
                                color: RARITY_COLORS[config.itemRarities[i]] ?? 'var(--text-muted)'
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Equipment silhouette */}
                <div className="relative w-[160px] h-[160px] bg-black/40 rounded-xl border border-indigo-900/40 flex-shrink-0 shadow-inner overflow-hidden flex items-center justify-center p-2">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15)_0%,transparent_70%)] pointer-events-none" />
                  {/* Body silhouette line */}
                  <svg className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                    <path
                      d="M50 15 C50 15 42 20 42 30 L42 55 L35 65 L35 85 M50 15 C50 15 58 20 58 30 L58 55 L65 65 L65 85 M42 30 L25 35 M58 30 L75 35"
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      style={{ filter: 'drop-shadow(0 0 4px rgba(79,70,229,0.6))' }}
                    />
                  </svg>
                  {enabledEquip.map((slot) => {
                    const pos = EQUIP_POSITIONS[slot.id];
                    if (!pos) return null;
                    return (
                      <div
                        key={slot.id}
                        className="absolute w-[24px] h-[24px] rounded-md border border-amber-500/60 bg-amber-500/20 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.3)_inset] group/equip cursor-help"
                        style={{
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        title={slot.label}
                      >
                        <span className="text-[7px] text-amber-300 font-bold leading-none select-none uppercase tracking-widest">
                          {pos.label.slice(0, 3)}
                        </span>
                        <div className="absolute inset-0 border border-amber-400/50 rounded-md animate-ping opacity-20 pointer-events-none" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Stack config */}
            <div className="flex items-center gap-6 bg-black/40 p-4 rounded-xl border border-indigo-900/30 backdrop-blur-md shadow-lg w-fit">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center w-5 h-5">
                  <input
                    type="checkbox"
                    checked={config.stackable}
                    onChange={(e) => setConfig((c) => ({ ...c, stackable: e.target.checked }))}
                    className="peer appearance-none w-5 h-5 border border-indigo-900/60 rounded bg-black/50 checked:bg-indigo-500/20 checked:border-indigo-500 transition-all outline-none cursor-pointer shadow-inner"
                  />
                  <Check className="w-3 h-3 text-indigo-400 absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity drop-shadow-[0_0_2px_rgba(99,102,241,0.8)]" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-200 group-hover:text-white transition-colors">Stackable Assets</span>
              </label>

              {config.stackable && (
                <div className="flex items-center gap-3 pl-6 border-l border-indigo-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/80">Stack Limit:</span>
                  <input
                    type="number"
                    value={config.maxStackSize}
                    onChange={(e) => setConfig((c) => ({ ...c, maxStackSize: Math.max(1, Math.min(9999, Number(e.target.value) || 1)) }))}
                    className="w-20 px-3 py-1.5 bg-black/50 border border-indigo-900/60 rounded-lg text-[11px] font-mono text-indigo-200 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 transition-all shadow-inner text-center"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Item Slot Types ─── */}
        {activeSection === 'slots' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-4 flex items-start gap-4 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-indigo-200 mb-1">Supported Asset Classifications</h4>
                <p className="text-[10px] font-mono text-indigo-400/60 leading-relaxed uppercase tracking-wider">
                  Define the permissible item typologies managed by this grid. Mapped directly to EItemType enumerations.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {config.slotTypes.map((slot) => (
                <SlotTypeToggle
                  key={slot.id}
                  slot={slot}
                  onToggle={() => toggleSlotType(slot.id)}
                />
              ))}
            </div>

            {/* Rarity configuration */}
            <div className="mt-8 p-6 bg-black/40 border border-indigo-900/40 rounded-2xl shadow-inner">
              <div className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold mb-4 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" />
                Rarity Tiers Mapping
              </div>
              <div className="flex flex-wrap gap-2.5">
                {config.itemRarities.map((rarity) => (
                  <span
                    key={rarity}
                    className="px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]"
                    style={{
                      color: RARITY_COLORS[rarity] ?? 'rgba(156,163,175,0.8)',
                      borderColor: `${RARITY_COLORS[rarity] ?? 'rgba(156,163,175,0.8)'}40`,
                      backgroundColor: `${RARITY_COLORS[rarity] ?? 'rgba(156,163,175,0.8)'}15`,
                      textShadow: `0 0 10px ${RARITY_COLORS[rarity] ?? 'rgba(156,163,175,0.8)'}`,
                    }}
                  >
                    {rarity}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Equipment Layout ─── */}
        {activeSection === 'equip' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-4 flex items-start gap-4 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-indigo-200 mb-1">Equipment Slot Configuration</h4>
                <p className="text-[10px] font-mono text-indigo-400/60 leading-relaxed uppercase tracking-wider">
                  Enable or disable specific anatomical hardpoints for equipable assets. Mapped to EEquipmentSlot definitions.
                </p>
              </div>
            </div>

            {/* Visual equipment preview */}
            <div className="p-8 bg-black/60 border border-indigo-900/50 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.1)_inset] relative text-center">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 blur-[80px] pointer-events-none" />

              <div className="relative w-full max-w-[320px] h-[260px] mx-auto z-10">
                {/* Body silhouette */}
                <svg className="absolute inset-0 w-full h-full opacity-50" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                  <path
                    d="M50 10 C50 10 42 16 42 26 L42 50 L35 60 L35 85 M50 10 C50 10 58 16 58 26 L58 50 L65 60 L65 85 M42 26 L22 32 M58 26 L78 32"
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(79,70,229,0.5))' }}
                  />
                  {/* Head circle */}
                  <circle cx="50" cy="7" r="4" fill="none" stroke="#4f46e5" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 6px rgba(79,70,229,0.5))' }} />
                </svg>

                {config.equipmentSlots.map((slot) => {
                  const pos = EQUIP_POSITIONS[slot.id];
                  if (!pos) return null;
                  const isEnabled = slot.enabled;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => toggleEquipSlot(slot.id)}
                      className="absolute w-[44px] h-[44px] rounded-lg border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 group overflow-hidden"
                      style={{
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        transform: 'translate(-50%, -50%)',
                        borderColor: isEnabled ? 'rgba(52,211,153,0.6)' : 'rgba(49,46,129,0.5)',
                        backgroundColor: isEnabled ? 'rgba(52,211,153,0.15)' : 'rgba(0,0,0,0.6)',
                        boxShadow: isEnabled ? '0 0 15px rgba(52,211,153,0.2), inset 0 0 10px rgba(52,211,153,0.1)' : 'none',
                      }}
                      title={`${slot.label}`}
                    >
                      {isEnabled && (
                        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent pointer-events-none" />
                      )}
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider relative z-10 transition-colors"
                        style={{ color: isEnabled ? '#6ee7b7' : 'rgba(156,163,175,0.5)' }}
                      >
                        {pos.label.slice(0, 4)}
                      </span>
                      <span
                        className={`text-[8px] font-mono leading-none px-1.5 py-0.5 rounded ${isEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-900/30 text-indigo-400/50'}`}
                      >
                        {isEnabled ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-indigo-950/30 border border-indigo-900/40 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-200">
                  ACTIVE_SLOTS: {enabledEquip.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── Interaction Modes ─── */}
        {activeSection === 'interact' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-4 flex items-start gap-4 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <MousePointer2 className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-indigo-200 mb-1">UMG Interaction Protocol</h4>
                <p className="text-[10px] font-mono text-indigo-400/60 leading-relaxed uppercase tracking-wider">
                  Select input handling routines mapped to the inventory grid widget.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {ALL_INTERACTIONS.map((interaction) => {
                const enabled = config.interactions.includes(interaction.id);
                return (
                  <button
                    key={interaction.id}
                    onClick={() => toggleInteraction(interaction.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all duration-300 text-left group overflow-hidden relative"
                    style={{
                      borderColor: enabled ? 'rgba(99,102,241,0.5)' : 'rgba(49,46,129,0.4)',
                      backgroundColor: enabled ? 'rgba(99,102,241,0.1)' : 'rgba(0,0,0,0.4)',
                      boxShadow: enabled ? 'inset 0 0 20px rgba(99,102,241,0.05)' : 'none',
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all border shadow-inner"
                      style={{
                        borderColor: enabled ? '#6366f1' : 'rgba(49,46,129,0.6)',
                        backgroundColor: enabled ? '#6366f1' : 'rgba(0,0,0,0.5)',
                      }}
                    >
                      {enabled && (
                        <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-white font-bold uppercase tracking-widest mb-1 group-hover:text-indigo-200 transition-colors">{interaction.label}</div>
                      <div className="text-[10px] font-mono text-indigo-300/50 uppercase tracking-wider">{interaction.description}</div>
                    </div>
                    <div className={`p-2 rounded-lg border transition-colors ${enabled ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-indigo-950/20 border-indigo-900/30'}`}>
                      <InteractionIcon id={interaction.id} enabled={enabled} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Summary & Generate ─── */}
        <div className="relative z-10 pt-6 mt-6 border-t border-indigo-900/40">
          <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
            <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono uppercase tracking-widest text-indigo-400/80">
              <span className="bg-indigo-950/40 px-2 py-1 rounded border border-indigo-900/30">GRID: <span className="text-indigo-200 font-bold">{config.gridCols}×{config.gridRows} ({totalSlots})</span></span>
              <span className="bg-indigo-950/40 px-2 py-1 rounded border border-indigo-900/30">TYPES: <span className="text-indigo-200 font-bold">{enabledSlots.length}</span></span>
              <span className="bg-indigo-950/40 px-2 py-1 rounded border border-indigo-900/30">EQUIP: <span className="text-indigo-200 font-bold">{enabledEquip.length}</span></span>
              <span className="bg-indigo-950/40 px-2 py-1 rounded border border-indigo-900/30">INTERACT: <span className="text-indigo-200 font-bold">{config.interactions.length}</span></span>
            </div>
          </div>
          <button
            onClick={() => onGenerate(config)}
            disabled={isGenerating}
            className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 group outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-[#03030a]"
            style={{
              backgroundColor: 'rgba(99,102,241,0.15)',
              color: '#818cf8',
              border: '1px solid rgba(99,102,241,0.5)',
              boxShadow: '0 0 20px rgba(99,102,241,0.2), inset 0 0 10px rgba(99,102,241,0.1)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
            <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin drop-shadow-[0_0_8px_currentColor]" />
                COMPILING_SYSTEM...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform drop-shadow-[0_0_8px_currentColor]" />
                INITIALIZE_BUILD_SEQUENCE
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function SectionTab({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 px-6 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative overflow-hidden group border-r border-indigo-900/40 last:border-r-0 flex-1 hover:bg-white/5 ${active ? 'text-indigo-200' : 'text-indigo-500/50 hover:text-indigo-300'
        }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110 drop-shadow-[0_0_8px_currentColor]' : 'group-hover:scale-110'}`}>
        {icon}
      </div>
      {label}
      {active && (
        <>
          <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
          <span className="absolute inset-0 bg-gradient-to-t from-indigo-500/10 to-transparent pointer-events-none" />
        </>
      )}
    </button>
  );
}

function DimensionControl({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-2 flex flex-col items-center">
      <div className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold shadow-[0_0_10px_rgba(0,0,0,0.5)]">{label}</div>
      <div className="flex items-center gap-2 bg-black/50 p-1.5 rounded-lg border border-indigo-900/60 shadow-inner">
        <button
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="w-7 h-7 rounded-md bg-indigo-950/40 border border-indigo-900/40 flex items-center justify-center text-indigo-400 hover:text-white hover:bg-indigo-600/30 hover:border-indigo-500/50 disabled:opacity-30 transition-all"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center text-[13px] font-bold text-white tracking-widest">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className="w-7 h-7 rounded-md bg-indigo-950/40 border border-indigo-900/40 flex items-center justify-center text-indigo-400 hover:text-white hover:bg-indigo-600/30 hover:border-indigo-500/50 disabled:opacity-30 transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function SlotTypeToggle({ slot, onToggle }: { slot: SlotTypeConfig; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left shadow-inner hover:brightness-110"
      style={{
        borderColor: slot.enabled ? `${slot.color}60` : 'rgba(49,46,129,0.4)',
        backgroundColor: slot.enabled ? `${slot.color}15` : 'rgba(0,0,0,0.4)',
        boxShadow: slot.enabled ? `inset 0 0 15px ${slot.color}10` : 'none',
      }}
    >
      <div
        className="w-4 h-4 rounded-md flex-shrink-0 transition-all duration-300 shadow-[inset_0_0_4px_rgba(0,0,0,0.5)]"
        style={{
          backgroundColor: slot.enabled ? slot.color : 'rgba(30,27,75,0.8)',
          boxShadow: slot.enabled ? `0 0 10px ${slot.color}80` : 'none',
        }}
      />
      <span
        className="text-[11px] font-bold uppercase tracking-widest transition-colors drop-shadow-md"
        style={{ color: slot.enabled ? 'white' : 'rgba(156,163,175,0.6)', textShadow: slot.enabled ? `0 0 8px ${slot.color}80` : 'none' }}
      >
        {slot.label}
      </span>
    </button>
  );
}

function InteractionIcon({ id, enabled }: { id: InteractionMode; enabled: boolean }) {
  const color = enabled ? '#818cf8' : 'rgba(99,102,241,0.4)';
  const iconClass = `w-4 h-4 flex-shrink-0 transition-colors ${enabled ? 'drop-shadow-[0_0_8px_currentColor]' : ''}`;

  switch (id) {
    case 'drag-drop':
      return <GripVertical className={iconClass} style={{ color }} />;
    case 'right-click-use':
      return <MousePointerClick className={iconClass} style={{ color }} />;
    case 'shift-click-split':
      return <Sword className={iconClass} style={{ color }} />;
    case 'double-click-equip':
      return <Shield className={iconClass} style={{ color }} />;
    case 'ctrl-click-move':
      return <Zap className={iconClass} style={{ color }} />;
    default:
      return null;
  }
}
