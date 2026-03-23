'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Zap, Swords, Shield, Camera, Activity, Code2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, ACCENT_PINK, STATUS_WARNING, STATUS_ERROR,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { STAGGER_DEFAULT } from '../_shared';
import { useGenomeStore, createGenome } from '@/stores/genomeStore';
import type { CharacterGenome } from '@/types/character-genome';
import type { ProfileKey, FieldWarning } from './types';
import {
  ACCENT, MOVEMENT_FIELDS, COMBAT_FIELDS, DODGE_FIELDS,
  CAMERA_FIELDS, ATTRIBUTE_FIELDS, genomeToRadar,
} from './field-data';
import { generateSubclassHeader, generateSubclassCpp, generateAttributeInitTable } from './codegen';
import { validateGenome } from './validation';
import { CodePreview } from './CodePreview';
import { ProfileSection } from './ProfileSection';
import { ArchetypeComparisonPanel } from './ArchetypeComparisonPanel';
import { LevelScaledPowerCurve } from './LevelScaledPowerCurve';
import { LiveSimDashboard } from './LiveSimDashboard';
import { GenomeComparisonTable } from './GenomeComparisonTable';
import { GenomeHeaderPanel } from './GenomeHeaderPanel';
import { GenomeSelectorBar } from './GenomeSelectorBar';

/* ── Main Editor Component ───────────────────────────────────────────── */

export function CharacterGenomeEditor() {
  const genomes = useGenomeStore((s) => s.genomes);
  const activeId = useGenomeStore((s) => s.activeId);
  const compareIds = useGenomeStore((s) => s.compareIds);
  const setActiveId = useGenomeStore((s) => s.setActiveId);
  const toggleCompareId = useGenomeStore((s) => s.toggleCompareId);
  const clearCompareIds = useGenomeStore((s) => s.clearCompareIds);
  const storeAddGenome = useGenomeStore((s) => s.addGenome);
  const storeDeleteGenome = useGenomeStore((s) => s.deleteGenome);
  const storeUpdateGenome = useGenomeStore((s) => s.updateGenome);

  const [codePreview, setCodePreview] = useState<{ code: string; title: string } | null>(null);

  const resolvedActiveId = genomes.some((g) => g.id === activeId) ? activeId : genomes[0]?.id ?? '';
  useEffect(() => {
    if (resolvedActiveId !== activeId) setActiveId(resolvedActiveId);
  }, [resolvedActiveId, activeId, setActiveId]);

  const activeGenome = useMemo(() => genomes.find((g) => g.id === resolvedActiveId)!, [genomes, resolvedActiveId]);
  const compareIdSet = useMemo(() => new Set(compareIds), [compareIds]);
  const compareGenomes = useMemo(() => genomes.filter((g) => compareIdSet.has(g.id)), [genomes, compareIdSet]);

  const updateGenome = useCallback((id: string, updater: (g: CharacterGenome) => CharacterGenome) => {
    storeUpdateGenome(id, updater);
  }, [storeUpdateGenome]);

  const updateProfile = useCallback((profile: ProfileKey, key: string, value: number) => {
    updateGenome(resolvedActiveId, (g) => ({
      ...g, updatedAt: new Date().toISOString(),
      [profile]: { ...g[profile], [key]: value },
    }));
  }, [resolvedActiveId, updateGenome]);

  const addGenome = useCallback(() => {
    const colors = [ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_CYAN, ACCENT_PINK, STATUS_WARNING];
    storeAddGenome(createGenome(`Archetype ${genomes.length + 1}`, colors[genomes.length % colors.length]));
  }, [genomes.length, storeAddGenome]);

  const exportGenome = useCallback((genome: CharacterGenome) => {
    const blob = new Blob([JSON.stringify(genome, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `genome-${genome.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, []);

  const radarOverlays = useMemo(() => {
    const targets = compareGenomes.length > 0 ? compareGenomes : genomes.filter((g) => g.id !== resolvedActiveId);
    return targets.map((g) => ({ data: genomeToRadar(g), color: g.color, label: g.name }));
  }, [genomes, resolvedActiveId, compareGenomes]);

  const warningsByProfile = useMemo(() => {
    const all = validateGenome(activeGenome);
    const grouped: Record<string, Map<string, FieldWarning>> = {};
    for (const w of all) {
      const [profile, field] = w.fieldKey.split('.');
      if (!grouped[profile]) grouped[profile] = new Map();
      const existing = grouped[profile].get(field);
      if (!existing || (w.severity === 'error' && existing.severity === 'warning')) grouped[profile].set(field, w);
    }
    return grouped;
  }, [activeGenome]);

  const PROFILES = useMemo(() => [
    { key: 'movement' as const, title: 'Movement', icon: Zap, color: ACCENT_EMERALD, fields: MOVEMENT_FIELDS },
    { key: 'combat' as const, title: 'Combat', icon: Swords, color: STATUS_ERROR, fields: COMBAT_FIELDS },
    { key: 'dodge' as const, title: 'Dodge', icon: Activity, color: ACCENT_ORANGE, fields: DODGE_FIELDS },
    { key: 'camera' as const, title: 'Camera', icon: Camera, color: ACCENT_CYAN, fields: CAMERA_FIELDS },
    { key: 'attributes' as const, title: 'Attributes', icon: Shield, color: ACCENT_VIOLET, fields: ATTRIBUTE_FIELDS },
  ], []);

  const CODE_BUTTONS = useMemo(() => [
    { label: 'Generate .h Header', color: ACCENT, gen: () => ({ code: generateSubclassHeader(activeGenome), title: `${activeGenome.name} \u2014 Header (.h)` }) },
    { label: 'Generate .cpp Implementation', color: ACCENT_EMERALD, gen: () => ({ code: generateSubclassCpp(activeGenome), title: `${activeGenome.name} \u2014 Implementation (.cpp)` }) },
    { label: 'Generate AttributeInitTable (CSV)', color: ACCENT_VIOLET, gen: () => ({ code: generateAttributeInitTable(activeGenome), title: `${activeGenome.name} \u2014 AttributeInitTable (CSV)` }) },
  ], [activeGenome]);

  return (
    <div className="space-y-4">
      <GenomeSelectorBar genomes={genomes} resolvedActiveId={resolvedActiveId}
        onSelectGenome={setActiveId} onAddGenome={addGenome}
        onImportGenome={storeAddGenome} onUpdateGenome={updateGenome} />

      <GenomeHeaderPanel activeGenome={activeGenome} genomes={genomes} resolvedActiveId={resolvedActiveId}
        compareIds={compareIds} compareIdSet={compareIdSet} radarOverlays={radarOverlays}
        onUpdateGenome={updateGenome} onExport={exportGenome} onDelete={storeDeleteGenome}
        onToggleCompare={toggleCompareId} onClearCompare={clearCompareIds} />

      <ArchetypeComparisonPanel genomes={genomes} activeGenome={activeGenome} />
      <LevelScaledPowerCurve genomes={genomes} activeId={resolvedActiveId} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {PROFILES.map((p, i) => (
          <motion.div key={`section-${p.key}-${resolvedActiveId}`}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'tween', duration: 0.3, delay: i * STAGGER_DEFAULT }}>
            <ProfileSection title={p.title} icon={p.icon} color={p.color} fields={p.fields}
              values={activeGenome[p.key] as unknown as Record<string, number>}
              onChange={(k, v) => updateProfile(p.key, k, v)}
              compareValues={compareGenomes[0]?.[p.key] as unknown as Record<string, number>}
              compareColor={compareGenomes[0]?.color} fieldWarnings={warningsByProfile[p.key]} />
          </motion.div>
        ))}
        <BlueprintPanel color={ACCENT} className="p-3">
          <div className="space-y-4">
            <SectionHeader icon={Code2} label="UE5 Code Generation" color={ACCENT} />
            <p className="text-xs text-text-muted">Auto-generate ARPGCharacterBase subclass constructor and AttributeInitTable rows.</p>
            <div className="space-y-1.5">
              {CODE_BUTTONS.map((btn) => (
                <button key={btn.label} onClick={() => setCodePreview(btn.gen())}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-colors hover:brightness-110 text-left"
                  style={{ borderColor: `${btn.color}30`, backgroundColor: `${btn.color}08`, color: btn.color }}>
                  <Code2 className="w-3.5 h-3.5 flex-shrink-0" /><span className="flex-1">{btn.label}</span>
                  <ChevronRight className="w-3 h-3 opacity-50" />
                </button>
              ))}
            </div>
          </div>
        </BlueprintPanel>
      </div>

      <LiveSimDashboard genome={activeGenome} compareGenome={compareGenomes[0]} />

      <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
        <div className="mb-3"><SectionHeader icon={Activity} label="Genome Comparison Matrix" color={ACCENT_VIOLET} /></div>
        <div className="overflow-x-auto custom-scrollbar"><GenomeComparisonTable genomes={genomes} activeId={resolvedActiveId} /></div>
      </BlueprintPanel>

      <AnimatePresence>
        {codePreview && <CodePreview code={codePreview.code} title={codePreview.title} onClose={() => setCodePreview(null)} />}
      </AnimatePresence>
    </div>
  );
}
