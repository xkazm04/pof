'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Code, Zap, Shield, Swords, Tag, Cable, FlaskConical, LayoutTemplate, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { BlueprintPanel, SectionHeader } from '../_design';
import type { EditorAttribute, EditorEffect, TagRule, GASLoadoutSlot } from '@/lib/gas-codegen';
import type { AttrRelationship } from './types';
import type { EditorPanel } from './data';
import { ACCENT, SEED_ATTRIBUTES, SEED_RELATIONSHIPS, SEED_EFFECTS, SEED_TAG_RULES, SEED_LOADOUT, PANEL_BREADCRUMBS } from './data';
import { generateAttributeSetHeader, generateTagsHeader, generateEffectsCode } from './codegen';
import { GAS_TEMPLATES, type GASTemplate } from './templates';
import { WiringGraphEditor } from './WiringGraphEditor';
import { RelationshipWebEditor } from './RelationshipWebEditor';
import { EffectTimelineEditor } from './EffectTimelineEditor';
import { TagRulesEditor } from './TagRulesEditor';
import { LoadoutEditor } from './LoadoutEditor';
import { CodePreview } from './CodePreview';
import { TemplatePicker } from './TemplatePicker';
import { SimulationSandbox } from '../gas-blueprint/SimulationSandbox';

const PANELS: { id: EditorPanel; label: string; icon: typeof Swords }[] = [
  { id: 'wiring', label: 'Wiring', icon: Cable },
  { id: 'relationships', label: 'Attributes', icon: Swords },
  { id: 'effects', label: 'Effects', icon: Zap },
  { id: 'tags', label: 'Tag Rules', icon: Tag },
  { id: 'loadout', label: 'Loadout', icon: Shield },
  { id: 'simulate', label: 'Simulate', icon: FlaskConical },
  { id: 'codegen', label: 'Code Gen', icon: Code },
];

export function GASBlueprintEditor() {
  const [attributes, setAttributes] = useState<EditorAttribute[]>(SEED_ATTRIBUTES);
  const [relationships, setRelationships] = useState<AttrRelationship[]>(SEED_RELATIONSHIPS);
  const [effects, setEffects] = useState<EditorEffect[]>(SEED_EFFECTS);
  const [tagRules, setTagRules] = useState<TagRule[]>(SEED_TAG_RULES);
  const [loadout, setLoadout] = useState<GASLoadoutSlot[]>(SEED_LOADOUT);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [activeTemplateName, setActiveTemplateName] = useState<string | null>(null);
  const [prevCode, setPrevCode] = useState<Record<string, string | null>>({ attrs: null, tags: null, effects: null });
  const [activePanel, setActivePanelRaw] = useState<EditorPanel>('wiring');
  const [codeTab, setCodeTab] = useState<'attrs' | 'tags' | 'effects'>('attrs');
  const [breadcrumbDetail, setBreadcrumbDetail] = useState<string | null>(null);

  const setActivePanel = useCallback((panel: EditorPanel) => { setActivePanelRaw(panel); setBreadcrumbDetail(null); }, []);
  const breadcrumbs = useMemo(() => {
    const crumbs = [...PANEL_BREADCRUMBS[activePanel]];
    if (breadcrumbDetail) crumbs.push(breadcrumbDetail);
    return crumbs;
  }, [activePanel, breadcrumbDetail]);

  const generatedCode = useMemo(() => ({
    attrs: generateAttributeSetHeader(attributes),
    tags: generateTagsHeader(tagRules, loadout),
    effects: generateEffectsCode(effects),
  }), [attributes, tagRules, loadout, effects]);

  const snapshotCode = useCallback(() => { setPrevCode({ ...generatedCode }); }, [generatedCode]);

  const loadTemplate = useCallback((tpl: GASTemplate) => {
    setAttributes(tpl.attributes as EditorAttribute[]);
    setRelationships(tpl.relationships as AttrRelationship[]);
    setEffects(tpl.effects as EditorEffect[]);
    setTagRules(tpl.tagRules as TagRule[]);
    setLoadout(tpl.loadout as GASLoadoutSlot[]);
    setActiveTemplateName(tpl.name);
    setShowTemplatePicker(false);
    setActivePanelRaw('wiring');
    setBreadcrumbDetail(null);
  }, []);

  const stats = useMemo(() => ({
    attrs: attributes.length, rels: relationships.length, effects: effects.length,
    rules: tagRules.length, slots: loadout.length,
  }), [attributes, relationships, effects, tagRules, loadout]);

  return (
    <div className="space-y-4">
      {showTemplatePicker && (
        <TemplatePicker templates={GAS_TEMPLATES} activeTemplateName={activeTemplateName}
          onSelect={loadTemplate} onClose={() => setShowTemplatePicker(false)} />
      )}

      {/* Header */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden" style={{ borderLeft: `2px solid ${ACCENT}40` }}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-text flex items-center gap-2">
              <Code className="w-4 h-4" style={{ color: ACCENT }} /> GAS Blueprint Editor
              <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${ACCENT_CYAN}15`, color: ACCENT_CYAN, border: `1px solid ${ACCENT_CYAN}30` }}>INTERACTIVE</span>
              {activeTemplateName && <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${ACCENT_EMERALD}15`, color: ACCENT_EMERALD, border: `1px solid ${ACCENT_EMERALD}30` }}>{activeTemplateName}</span>}
            </div>
            <div className="text-2xs text-text-muted mt-0.5">Visual editor for Gameplay Ability System — exports C++ code</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowTemplatePicker(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
              <LayoutTemplate className="w-3.5 h-3.5" /> Templates
            </button>
            <div className="flex items-center gap-3 text-2xs font-mono text-text-muted">
              <span><span className="font-bold text-text">{stats.attrs}</span> attrs</span>
              <span><span className="font-bold text-text">{stats.rels}</span> rels</span>
              <span><span className="font-bold text-text">{stats.effects}</span> effects</span>
              <span><span className="font-bold text-text">{stats.rules}</span> rules</span>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-0.5 px-1 py-1 overflow-x-auto custom-scrollbar">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          const isDetail = isLast && breadcrumbDetail && crumb === breadcrumbDetail;
          return (
            <span key={`${crumb}-${i}`} className="flex items-center gap-0.5 whitespace-nowrap">
              {i > 0 && <ChevronRight className="w-3 h-3 text-text-muted/40 flex-shrink-0" />}
              <span className="text-xs font-mono px-1.5 py-0.5 rounded transition-colors"
                style={{ color: isLast ? ACCENT : 'var(--text-muted)', fontWeight: isLast ? 700 : 400,
                  backgroundColor: isDetail ? `${ACCENT}10` : 'transparent', border: isDetail ? `1px solid ${ACCENT}25` : '1px solid transparent' }}>
                {crumb}
              </span>
            </span>
          );
        })}
      </div>

      {/* Panel tabs */}
      <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-0.5">
        {PANELS.map(({ id, label, icon: Icon }) => {
          const isActive = activePanel === id;
          return (
            <button key={id} onClick={() => { if (id === 'codegen') snapshotCode(); setActivePanel(id); }}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
              style={{ backgroundColor: isActive ? `${ACCENT}15` : 'transparent', color: isActive ? ACCENT : 'var(--text-muted)', border: `1px solid ${isActive ? `${ACCENT}40` : 'transparent'}` }}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          );
        })}
      </div>

      {/* Panel content */}
      <AnimatePresence mode="sync">
        <motion.div key={activePanel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          <BlueprintPanel color={ACCENT} className="p-3">
            {activePanel === 'wiring' && (<><SectionHeader icon={Cable} label="Visual Wiring Graph" color={ACCENT_EMERALD} /><p className="text-2xs text-text-muted mt-1 mb-2">Node-based view of the GAS data pipeline — attributes feed into effects, which grant tags that trigger blocking/cancellation rules.</p><WiringGraphEditor attributes={attributes} effects={effects} tagRules={tagRules} relationships={relationships} onSelectItem={setBreadcrumbDetail} /></>)}
            {activePanel === 'relationships' && (<><SectionHeader icon={Swords} label="Attribute Relationship Web" color={ACCENT_VIOLET} /><p className="text-2xs text-text-muted mt-1 mb-2">Drag from one attribute node to another to create scaling/clamping dependencies. Click an edge line to remove it.</p><RelationshipWebEditor attributes={attributes} relationships={relationships} onChange={setRelationships} /></>)}
            {activePanel === 'effects' && (<><SectionHeader icon={Zap} label="Effect Lifecycle Timeline" color={STATUS_ERROR} /><p className="text-2xs text-text-muted mt-1 mb-2">Place GameplayEffect blocks on a timeline. Click to select and edit duration, modifiers, and granted tags.</p><EffectTimelineEditor effects={effects} onChange={setEffects} onSelectItem={setBreadcrumbDetail} /></>)}
            {activePanel === 'tags' && (<><SectionHeader icon={Tag} label="Tag Dependency Rules" color={STATUS_WARNING} /><p className="text-2xs text-text-muted mt-1 mb-2">Define blocking, cancellation, and requirement rules between gameplay tags. Supports wildcard patterns (e.g. Ability.*).</p><TagRulesEditor rules={tagRules} onChange={setTagRules} effects={effects} loadout={loadout} /></>)}
            {activePanel === 'loadout' && (<><SectionHeader icon={Shield} label="Loadout Hotbar" color={ACCENT_VIOLET} /><p className="text-2xs text-text-muted mt-1 mb-2">Configure ability loadout slots with names and cooldown tags. Add/remove slots to match your hotbar design.</p><LoadoutEditor loadout={loadout} onChange={setLoadout} /></>)}
            {activePanel === 'simulate' && (<><SectionHeader icon={FlaskConical} label="Live Simulation Sandbox" color={STATUS_SUCCESS} /><p className="text-2xs text-text-muted mt-1 mb-2">Queue effects at specific times and watch attribute values change in real-time.</p><SimulationSandbox attributes={attributes} effects={effects} relationships={relationships} accent={ACCENT} /></>)}
            {activePanel === 'codegen' && (<><SectionHeader icon={Code} label="Generated C++ Code" color={ACCENT_CYAN} /><p className="text-2xs text-text-muted mt-1 mb-2">Auto-generated C++ from your visual design. Toggle diff mode to see what changed since last visit.</p>
              <div className="flex gap-1 mb-2">
                {([{ id: 'attrs' as const, label: 'AttributeSet.h', count: stats.attrs }, { id: 'tags' as const, label: 'GameplayTags.h', count: stats.rules }, { id: 'effects' as const, label: 'Effects.cpp', count: stats.effects }]).map((tab) => (
                  <button key={tab.id} onClick={() => setCodeTab(tab.id)} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-mono transition-all"
                    style={{ backgroundColor: codeTab === tab.id ? `${ACCENT_CYAN}15` : 'transparent', color: codeTab === tab.id ? ACCENT_CYAN : 'var(--text-muted)', border: `1px solid ${codeTab === tab.id ? `${ACCENT_CYAN}30` : 'transparent'}` }}>
                    {tab.label} <span className="opacity-60">({tab.count})</span>
                  </button>
                ))}
              </div>
              <CodePreview code={generatedCode[codeTab]} prevCode={prevCode[codeTab]} />
            </>)}
          </BlueprintPanel>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
