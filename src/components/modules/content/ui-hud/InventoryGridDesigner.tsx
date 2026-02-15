'use client';

import { useState, useCallback } from 'react';
import {
  Grid3x3, Shield, Sword, Zap, Package, Send, Loader2,
  Plus, Minus, GripVertical, MousePointer2, MousePointerClick,
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

const CONTENT_ACCENT = '#f59e0b';

// ── Equipment slot positions for the character silhouette layout ──

const EQUIP_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  head:      { x: 50, y: 4,   label: 'Head' },
  chest:     { x: 50, y: 28,  label: 'Chest' },
  hands:     { x: 14, y: 28,  label: 'Hands' },
  legs:      { x: 50, y: 52,  label: 'Legs' },
  feet:      { x: 50, y: 76,  label: 'Feet' },
  'weapon-l': { x: 14, y: 52, label: 'Wpn L' },
  'weapon-r': { x: 86, y: 52, label: 'Wpn R' },
  'ring-1':  { x: 14, y: 76,  label: 'Ring' },
  'ring-2':  { x: 86, y: 76,  label: 'Ring' },
  amulet:    { x: 86, y: 28,  label: 'Amul' },
  belt:      { x: 86, y: 4,   label: 'Belt' },
  cape:      { x: 14, y: 4,   label: 'Cape' },
};

// ── Rarity colors ──
const RARITY_COLORS: Record<string, string> = {
  Common:    'var(--text-muted)',
  Uncommon:  '#4ade80',
  Rare:      '#60a5fa',
  Epic:      '#a78bfa',
  Legendary: '#fbbf24',
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
    <div className="space-y-5">
      {/* Section tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <SectionTab
          label="Grid"
          icon={<Grid3x3 className="w-3 h-3" />}
          active={activeSection === 'grid'}
          onClick={() => setActiveSection('grid')}
        />
        <SectionTab
          label="Item Types"
          icon={<Package className="w-3 h-3" />}
          active={activeSection === 'slots'}
          onClick={() => setActiveSection('slots')}
        />
        <SectionTab
          label="Equipment"
          icon={<Shield className="w-3 h-3" />}
          active={activeSection === 'equip'}
          onClick={() => setActiveSection('equip')}
        />
        <SectionTab
          label="Interactions"
          icon={<MousePointer2 className="w-3 h-3" />}
          active={activeSection === 'interact'}
          onClick={() => setActiveSection('interact')}
        />
      </div>

      {/* ─── Grid Configuration ─── */}
      {activeSection === 'grid' && (
        <div className="space-y-4">
          {/* Dimension controls */}
          <div className="flex items-center gap-6">
            <DimensionControl label="Columns" value={config.gridCols} onChange={setCols} min={2} max={12} />
            <span className="text-text-muted text-lg mt-5">×</span>
            <DimensionControl label="Rows" value={config.gridRows} onChange={setRows} min={2} max={8} />
            <div className="mt-5 text-xs text-text-muted bg-surface px-2 py-1 rounded">
              {totalSlots} slots
            </div>
          </div>

          {/* Grid preview */}
          <SurfaceCard level={2} className="p-4">
            <div className="text-2xs uppercase tracking-wider text-text-muted mb-2 font-semibold">Preview</div>
            <div className="flex gap-6">
              {/* Inventory grid */}
              <div>
                <div
                  className="grid gap-[3px]"
                  style={{
                    gridTemplateColumns: `repeat(${config.gridCols}, 1fr)`,
                    width: config.gridCols * 32 + (config.gridCols - 1) * 3,
                  }}
                >
                  {Array.from({ length: totalSlots }, (_, i) => {
                    const slotType = enabledSlots[i % enabledSlots.length];
                    return (
                      <div
                        key={i}
                        className="w-[30px] h-[30px] rounded-[3px] border transition-colors flex items-center justify-center"
                        style={{
                          borderColor: slotType ? `${slotType.color}40` : '#2a2a4a',
                          backgroundColor: slotType ? `${slotType.color}08` : 'var(--surface)',
                        }}
                      >
                        {i < 3 && (
                          <div
                            className="w-4 h-4 rounded-sm"
                            style={{ backgroundColor: `${RARITY_COLORS[config.itemRarities[i]] ?? 'var(--text-muted)'}30` }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Equipment silhouette */}
              <div className="relative w-[120px] h-[120px] bg-surface rounded-lg border border-border flex-shrink-0">
                {/* Body silhouette line */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                  <path
                    d="M50 15 C50 15 42 20 42 30 L42 55 L35 65 L35 85 M50 15 C50 15 58 20 58 30 L58 55 L65 65 L65 85 M42 30 L25 35 M58 30 L75 35"
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                {enabledEquip.map((slot) => {
                  const pos = EQUIP_POSITIONS[slot.id];
                  if (!pos) return null;
                  return (
                    <div
                      key={slot.id}
                      className="absolute w-[22px] h-[22px] rounded-[3px] border border-status-amber-strong bg-status-amber-subtle flex items-center justify-center"
                      style={{
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        transform: 'translate(-50%, 0)',
                      }}
                      title={slot.label}
                    >
                      <span className="text-[6px] text-[#f59e0b80] font-medium leading-none">
                        {pos.label.slice(0, 2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </SurfaceCard>

          {/* Stack config */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.stackable}
                onChange={(e) => setConfig((c) => ({ ...c, stackable: e.target.checked }))}
                className="accent-[#f59e0b] w-3 h-3"
              />
              <span className="text-xs text-[#d0d4e8]">Stackable items</span>
            </label>
            {config.stackable && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Max stack:</span>
                <input
                  type="number"
                  value={config.maxStackSize}
                  onChange={(e) => setConfig((c) => ({ ...c, maxStackSize: Math.max(1, Math.min(9999, Number(e.target.value) || 1)) }))}
                  className="w-16 px-2 py-1 bg-surface border border-border rounded text-xs text-[#d0d4e8] outline-none focus:border-status-amber-strong"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Item Slot Types ─── */}
      {activeSection === 'slots' && (
        <div className="space-y-2">
          <p className="text-xs text-text-muted">
            Toggle item categories your inventory supports. These map to EItemType enum values.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {config.slotTypes.map((slot) => (
              <SlotTypeToggle
                key={slot.id}
                slot={slot}
                onToggle={() => toggleSlotType(slot.id)}
              />
            ))}
          </div>

          {/* Rarity configuration */}
          <div className="mt-4">
            <div className="text-2xs uppercase tracking-wider text-text-muted font-semibold mb-2">Item Rarities</div>
            <div className="flex flex-wrap gap-1.5">
              {config.itemRarities.map((rarity) => (
                <span
                  key={rarity}
                  className="text-xs px-2 py-0.5 rounded-full border font-medium"
                  style={{
                    color: RARITY_COLORS[rarity] ?? 'var(--text-muted)',
                    borderColor: `${RARITY_COLORS[rarity] ?? 'var(--text-muted)'}30`,
                    backgroundColor: `${RARITY_COLORS[rarity] ?? 'var(--text-muted)'}10`,
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
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            Configure equipment slots. These map to EEquipmentSlot enum values in C++.
          </p>

          {/* Visual equipment preview */}
          <SurfaceCard level={2} className="p-4">
            <div className="relative w-full max-w-[280px] h-[200px] mx-auto">
              {/* Body silhouette */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                <path
                  d="M50 10 C50 10 42 16 42 26 L42 50 L35 60 L35 85 M50 10 C50 10 58 16 58 26 L58 50 L65 60 L65 85 M42 26 L22 32 M58 26 L78 32"
                  fill="none"
                  stroke="#2a2a4a"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                {/* Head circle */}
                <circle cx="50" cy="7" r="4" fill="none" stroke="#2a2a4a" strokeWidth="1" />
              </svg>

              {config.equipmentSlots.map((slot) => {
                const pos = EQUIP_POSITIONS[slot.id];
                if (!pos) return null;
                return (
                  <button
                    key={slot.id}
                    onClick={() => toggleEquipSlot(slot.id)}
                    className="absolute w-[34px] h-[34px] rounded border-2 transition-all flex flex-col items-center justify-center gap-0.5"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      transform: 'translate(-50%, 0)',
                      borderColor: slot.enabled ? `${CONTENT_ACCENT}60` : '#2a2a4a',
                      backgroundColor: slot.enabled ? `${CONTENT_ACCENT}10` : '#0d0d1a',
                      opacity: slot.enabled ? 1 : 0.5,
                    }}
                    title={`${slot.label} (${slot.enabled ? 'enabled' : 'disabled'})`}
                  >
                    <span
                      className="text-2xs font-semibold leading-none"
                      style={{ color: slot.enabled ? CONTENT_ACCENT : 'var(--text-muted)' }}
                    >
                      {pos.label}
                    </span>
                    <span className="text-[6px] text-text-muted leading-none">
                      {slot.enabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          </SurfaceCard>

          <div className="text-xs text-text-muted-hover">
            {enabledEquip.length} equipment slots enabled.
            Click slots on the silhouette to toggle.
          </div>
        </div>
      )}

      {/* ─── Interaction Modes ─── */}
      {activeSection === 'interact' && (
        <div className="space-y-2">
          <p className="text-xs text-text-muted">
            Select interaction modes for your inventory. Each adds corresponding UMG input handling code.
          </p>
          <div className="space-y-1.5">
            {ALL_INTERACTIONS.map((interaction) => {
              const enabled = config.interactions.includes(interaction.id);
              return (
                <button
                  key={interaction.id}
                  onClick={() => toggleInteraction(interaction.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left"
                  style={{
                    borderColor: enabled ? `${CONTENT_ACCENT}40` : 'var(--border)',
                    backgroundColor: enabled ? `${CONTENT_ACCENT}08` : 'var(--surface)',
                  }}
                >
                  <div
                    className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      borderColor: enabled ? CONTENT_ACCENT : '#3a3a5a',
                      backgroundColor: enabled ? CONTENT_ACCENT : 'transparent',
                    }}
                  >
                    {enabled && (
                      <svg width="8" height="8" viewBox="0 0 8 8">
                        <path d="M1.5 4L3 5.5L6.5 2" stroke="var(--background)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#d0d4e8] font-medium">{interaction.label}</div>
                    <div className="text-xs text-text-muted">{interaction.description}</div>
                  </div>
                  <InteractionIcon id={interaction.id} enabled={enabled} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Summary & Generate ─── */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4 text-xs text-text-muted-hover">
            <span>{config.gridCols}×{config.gridRows} grid ({totalSlots} slots)</span>
            <span className="text-[#2a2a4a]">|</span>
            <span>{enabledSlots.length} item types</span>
            <span className="text-[#2a2a4a]">|</span>
            <span>{enabledEquip.length} equip slots</span>
            <span className="text-[#2a2a4a]">|</span>
            <span>{config.interactions.length} interactions</span>
          </div>
        </div>
        <button
          onClick={() => onGenerate(config)}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${CONTENT_ACCENT}18`,
            color: CONTENT_ACCENT,
            border: `1px solid ${CONTENT_ACCENT}35`,
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Inventory System...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Generate Inventory System with Claude
            </>
          )}
        </button>
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
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {icon}
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
          style={{ backgroundColor: CONTENT_ACCENT }}
        />
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
    <div className="space-y-1">
      <div className="text-2xs uppercase tracking-wider text-text-muted font-semibold">{label}</div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="w-6 h-6 rounded bg-surface border border-border flex items-center justify-center text-text-muted-hover hover:text-[#d0d4e8] hover:border-[#2a2a4a] disabled:opacity-30 transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-8 text-center text-sm font-bold text-text">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className="w-6 h-6 rounded bg-surface border border-border flex items-center justify-center text-text-muted-hover hover:text-[#d0d4e8] hover:border-[#2a2a4a] disabled:opacity-30 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function SlotTypeToggle({ slot, onToggle }: { slot: SlotTypeConfig; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left"
      style={{
        borderColor: slot.enabled ? `${slot.color}40` : 'var(--border)',
        backgroundColor: slot.enabled ? `${slot.color}08` : 'var(--surface)',
      }}
    >
      <div
        className="w-3 h-3 rounded-sm flex-shrink-0 transition-colors"
        style={{
          backgroundColor: slot.enabled ? slot.color : '#2a2a4a',
        }}
      />
      <span
        className="text-xs font-medium transition-colors"
        style={{ color: slot.enabled ? slot.color : 'var(--text-muted)' }}
      >
        {slot.label}
      </span>
    </button>
  );
}

function InteractionIcon({ id, enabled }: { id: InteractionMode; enabled: boolean }) {
  const color = enabled ? CONTENT_ACCENT : '#3a3a5a';
  switch (id) {
    case 'drag-drop':
      return <GripVertical className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />;
    case 'right-click-use':
      return <MousePointerClick className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />;
    case 'shift-click-split':
      return <Sword className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />;
    case 'double-click-equip':
      return <Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />;
    case 'ctrl-click-move':
      return <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />;
    default:
      return null;
  }
}
