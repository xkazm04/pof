'use client';

import { useState } from 'react';
import {
  Layers, Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, SlidersHorizontal, Check,
} from 'lucide-react';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import type { FeelPreset } from '@/lib/character-feel-optimizer';
import {
  describeLayer, createBlankLayer, createLayerFromTemplate, countActiveLayers,
  LAYER_TEMPLATES,
} from '@/lib/feel-adjustment-layers';
import {
  withOpacity, OPACITY_8, OPACITY_15, OPACITY_25, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { LayerModifierEditor } from './LayerModifierEditor';
import { ACCENT } from './constants';

/* ── Adjustment-layer stack viewer ───────────────────────────────────────────
 * Photoshop-style non-destructive stack: a base preset stays authoritative
 * while named layers toggle on/off and reorder above it. The resolved profile
 * (base + enabled layers) is derived by the parent and feeds radar/CLI. */

const iconBtn =
  'p-1 rounded text-text-muted hover:text-text disabled:opacity-30 disabled:hover:text-text-muted focus-ring';

interface FeelLayerStackProps {
  basePreset: FeelPreset;
}

export function FeelLayerStack({ basePreset }: FeelLayerStackProps) {
  const layers = useCharacterBlueprintStore((s) => s.feelLayers);
  const addFeelLayer = useCharacterBlueprintStore((s) => s.addFeelLayer);
  const removeFeelLayer = useCharacterBlueprintStore((s) => s.removeFeelLayer);
  const toggleFeelLayer = useCharacterBlueprintStore((s) => s.toggleFeelLayer);
  const renameFeelLayer = useCharacterBlueprintStore((s) => s.renameFeelLayer);
  const moveFeelLayer = useCharacterBlueprintStore((s) => s.moveFeelLayer);
  const setLayerModifiers = useCharacterBlueprintStore((s) => s.setLayerModifiers);
  const clearFeelLayers = useCharacterBlueprintStore((s) => s.clearFeelLayers);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeCount = countActiveLayers(layers);

  const commitRename = (id: string) => {
    renameFeelLayer(id, draftName);
    setEditingId(null);
  };

  const addTemplate = (templateId: string) => {
    const layer = createLayerFromTemplate(templateId);
    if (layer) addFeelLayer(layer);
    setMenuOpen(false);
  };

  return (
    <BlueprintPanel color={ACCENT_EMERALD} className="p-3">
      <div className="flex items-center justify-between mb-2">
        <SectionHeader icon={Layers} label="Adjustment Stack" color={ACCENT_EMERALD} />
        <div className="flex items-center gap-1.5">
          {layers.length > 0 && (
            <span className="text-2xs font-mono uppercase tracking-[0.15em] text-text-muted">
              {activeCount}/{layers.length} active
            </span>
          )}
          {layers.length > 0 && (
            <button
              type="button"
              onClick={clearFeelLayers}
              className="text-2xs font-mono uppercase tracking-[0.15em] text-text-muted hover:text-text px-1.5 py-1 rounded focus-ring"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Base row — authoritative, not modifiable here */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1.5"
        style={{ backgroundColor: withOpacity(basePreset.color, OPACITY_8), border: `1px solid ${withOpacity(basePreset.color, OPACITY_15)}` }}
      >
        <span className="text-2xs font-mono uppercase tracking-[0.2em] px-1.5 py-0.5 rounded bg-surface-deep text-text-muted">Base</span>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: basePreset.color }} />
        <span className="text-xs font-bold" style={{ color: basePreset.color }}>{basePreset.name}</span>
        <span className="text-2xs font-mono text-text-muted ml-auto">{basePreset.genre}</span>
      </div>

      {/* Layer rows (apply in listed order; later layers override earlier) */}
      <div className="space-y-1.5">
        {layers.map((layer, i) => {
          const accent = layer.color ?? ACCENT;
          const isExpanded = expandedId === layer.id;
          return (
            <div
              key={layer.id}
              className="rounded-lg border"
              style={{
                borderColor: withOpacity(accent, layer.enabled ? OPACITY_25 : OPACITY_8),
                backgroundColor: layer.enabled ? withOpacity(accent, OPACITY_8) : 'transparent',
                opacity: layer.enabled ? 1 : 0.55,
              }}
            >
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => toggleFeelLayer(layer.id)}
                  aria-label={layer.enabled ? `Disable ${layer.name}` : `Enable ${layer.name}`}
                  aria-pressed={layer.enabled}
                  className="p-1 rounded focus-ring"
                  style={{ color: layer.enabled ? accent : 'var(--text-muted)' }}
                >
                  {layer.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                <div className="flex-1 min-w-0">
                  {editingId === layer.id ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => commitRename(layer.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(layer.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      aria-label="Layer name"
                      className="w-full rounded bg-surface-deep border border-border/40 text-xs font-bold px-1.5 py-0.5 text-text focus-ring"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditingId(layer.id); setDraftName(layer.name); }}
                      className="block w-full text-left focus-ring rounded"
                      title="Rename layer"
                    >
                      <span className="text-xs font-bold truncate" style={{ color: accent }}>{layer.name}</span>
                      <span className="block text-2xs font-mono text-text-muted truncate">{describeLayer(layer)}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button type="button" onClick={() => moveFeelLayer(layer.id, 'up')} disabled={i === 0} aria-label={`Move ${layer.name} up`} className={iconBtn}>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => moveFeelLayer(layer.id, 'down')} disabled={i === layers.length - 1} aria-label={`Move ${layer.name} down`} className={iconBtn}>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : layer.id)}
                    aria-label={`Edit ${layer.name} modifiers`}
                    aria-expanded={isExpanded}
                    className={iconBtn}
                    style={isExpanded ? { color: accent } : undefined}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => removeFeelLayer(layer.id)} aria-label={`Remove ${layer.name}`} className={iconBtn}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-2 pb-2 border-t border-border/20">
                  <LayerModifierEditor
                    modifiers={layer.modifiers}
                    color={accent}
                    onChange={(mods) => setLayerModifiers(layer.id, mods)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {layers.length === 0 && (
          <p className="text-2xs font-mono text-text-muted px-2 py-3 text-center">
            No layers — the resolved feel equals the base preset. Add a situational layer (boss fight, low health…) to modulate it non-destructively.
          </p>
        )}
      </div>

      {/* Add-layer control */}
      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold focus-ring"
          style={{ color: ACCENT_EMERALD, backgroundColor: withOpacity(ACCENT_EMERALD, OPACITY_8), border: `1px solid ${withOpacity(ACCENT_EMERALD, OPACITY_15)}` }}
        >
          <Plus className="w-3.5 h-3.5" /> Add layer
        </button>
        {menuOpen && (
          <div className="absolute z-20 top-full left-0 mt-1 w-72 rounded-xl border border-border/60 bg-surface shadow-xl p-1.5 space-y-0.5">
            {LAYER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.templateId}
                type="button"
                onClick={() => addTemplate(tpl.templateId)}
                className="w-full flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-surface-deep/60 focus-ring"
              >
                <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: tpl.color }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold" style={{ color: tpl.color }}>{tpl.name}</span>
                  <span className="block text-2xs font-mono text-text-muted truncate">{tpl.description}</span>
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { addFeelLayer(createBlankLayer()); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-surface-deep/60 border-t border-border/30 mt-0.5 pt-2 focus-ring"
            >
              <Check className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-bold text-text">Custom (blank layer)</span>
            </button>
          </div>
        )}
      </div>
    </BlueprintPanel>
  );
}
