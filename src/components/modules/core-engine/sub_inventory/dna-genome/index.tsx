'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Library } from 'lucide-react';
import { SubTabNavigation } from '@/components/modules/core-engine/unique-tabs/_shared';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import type { ItemGenome, TraitAxis, DNARollResult } from '@/types/item-genome';
import { rollAffixesWithDNA } from '@/lib/item-dna/rolling-engine';
import { sanitizeItemGenome } from '@/lib/item-dna/defaults';
import { useItemGenomeStore } from '@/stores/itemGenomeStore';
import {
  ACCENT, DEMO_AFFIX_POOL, SUB_TABS,
  createGenome, genomeToRadar,
} from './data';
import { ITEM_DIFF_SPECS } from './diff-fields';
import { EditorTab } from './EditorTab';
import { RollerTab } from './RollerTab';
import { BreedingTab } from './BreedingTab';
import { EvolutionTab } from './EvolutionTab';
import { LibraryTab } from './LibraryTab';
import { CodePreview } from './CodePreview';
import { GenomeImportPanel } from '../../unique-tabs/_genome-share/GenomeImportPanel';
import { BuildCodeExportPanel } from '../../unique-tabs/_genome-share/BuildCodeExport';
import { GenomeEditorHeader } from './GenomeEditorHeader';
import { GenomeSelector } from './GenomeSelector';

/* ── Main Component ────────────────────────────────────────────────────── */

interface Props { moduleId: string }

const EXTENDED_SUB_TABS = [
  ...SUB_TABS,
  { id: 'library', label: 'Library', icon: Library },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ItemDNAGenomeEditor({ moduleId }: Props) {
  /* ── Persisted state from store ── */
  const genomes = useItemGenomeStore((s) => s.genomes);
  const selectedId = useItemGenomeStore((s) => s.selectedId);
  const breedParentA = useItemGenomeStore((s) => s.breedParentA);
  const breedParentB = useItemGenomeStore((s) => s.breedParentB);
  const setSelectedId = useItemGenomeStore((s) => s.setSelectedId);
  const setBreedParentA = useItemGenomeStore((s) => s.setBreedParentA);
  const setBreedParentB = useItemGenomeStore((s) => s.setBreedParentB);
  const storeAddGenome = useItemGenomeStore((s) => s.addGenome);
  const storeDeleteGenome = useItemGenomeStore((s) => s.deleteGenome);
  const storeUpdateGenome = useItemGenomeStore((s) => s.updateGenome);
  const storeImportGenome = useItemGenomeStore((s) => s.importGenome);
  const storeDuplicateGenome = useItemGenomeStore((s) => s.duplicateGenome);
  const storeBreedSelected = useItemGenomeStore((s) => s.breedSelected);
  const storeEvolveById = useItemGenomeStore((s) => s.evolveById);
  const storeResetToPresets = useItemGenomeStore((s) => s.resetToPresets);

  /* ── Transient UI state ── */
  const [activeTab, setActiveTab] = useState('editor');
  const [rollRarity, setRollRarity] = useState('Rare');
  const [rollLevel, setRollLevel] = useState(10);
  const [rollResult, setRollResult] = useState<DNARollResult | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  /* ── Resolved selection (handles empty / stale selectedId) ── */
  const resolvedSelectedId = genomes.some((g) => g.id === selectedId)
    ? selectedId
    : genomes[0]?.id ?? '';
  useEffect(() => {
    if (resolvedSelectedId && resolvedSelectedId !== selectedId) {
      setSelectedId(resolvedSelectedId);
    }
  }, [resolvedSelectedId, selectedId, setSelectedId]);

  const selected = useMemo(
    () => genomes.find((g) => g.id === resolvedSelectedId) ?? genomes[0],
    [genomes, resolvedSelectedId],
  );

  const updateGenome = useCallback((id: string, updater: (g: ItemGenome) => ItemGenome) => {
    storeUpdateGenome(id, (g) => {
      const next = updater(g);
      // Promote a preset to a mutable custom genome when the user edits it
      return next.isPreset ? { ...next, isPreset: undefined } : next;
    });
  }, [storeUpdateGenome]);

  const updateTrait = useCallback((axis: TraitAxis, weight: number) => {
    if (!selected) return;
    updateGenome(selected.id, (g) => ({
      ...g,
      traits: g.traits.map((t) => t.axis === axis ? { ...t, weight } : t),
      updatedAt: new Date().toISOString(),
    }));
  }, [selected, updateGenome]);

  const addGenome = useCallback(() => {
    const g = createGenome(`Custom ${genomes.length + 1}`, ACCENT, {});
    storeAddGenome(g);
  }, [genomes.length, storeAddGenome]);

  const deleteGenome = useCallback((id: string) => {
    storeDeleteGenome(id);
  }, [storeDeleteGenome]);

  const applyImported = useCallback((g: ItemGenome) => {
    storeImportGenome(g);
  }, [storeImportGenome]);

  const doRoll = useCallback(() => {
    if (!selected) return;
    const result = rollAffixesWithDNA(selected, rollRarity, rollLevel, DEMO_AFFIX_POOL);
    setRollResult(result);
  }, [selected, rollRarity, rollLevel]);

  const doBreed = useCallback(() => {
    storeBreedSelected();
  }, [storeBreedSelected]);

  const doEvolve = useCallback(() => {
    if (!selected) return;
    const tierChanged = storeEvolveById(selected.id, 50 + Math.floor(Math.random() * 100));
    if (tierChanged) setRollResult(null);
  }, [selected, storeEvolveById]);

  const radarData = useMemo(() => selected ? genomeToRadar(selected) : [], [selected]);

  if (!selected) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3 p-2"
    >
      {/* Header */}
      <GenomeEditorHeader
        genomesCount={genomes.length}
        onToggleExport={() => { setShowExport((v) => !v); setShowImport(false); }}
        onToggleImport={() => { setShowImport((v) => !v); setShowExport(false); }}
        onAdd={addGenome}
      />

      {/* Build code export / import */}
      <AnimatePresence>
        {showExport && (
          <BuildCodeExportPanel
            key="item-export"
            kind="item"
            genome={selected}
            color={ACCENT_VIOLET}
            onClose={() => setShowExport(false)}
          />
        )}
        {showImport && (
          <GenomeImportPanel<ItemGenome>
            key="item-import"
            kind="item"
            kindLabel="item"
            accent={ACCENT}
            baseline={selected}
            baselineName={selected.name}
            getName={(g) => g.name}
            sanitize={sanitizeItemGenome}
            diffSpecs={ITEM_DIFF_SPECS}
            onApply={applyImported}
            onClose={() => setShowImport(false)}
          />
        )}
      </AnimatePresence>

      {/* Genome selector */}
      <GenomeSelector genomes={genomes} selectedId={selected.id} onSelect={setSelectedId} />

      {/* Sub-tabs */}
      <SubTabNavigation tabs={EXTENDED_SUB_TABS} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />

      {activeTab === 'editor' && (
        <EditorTab
          selected={selected}
          radarData={radarData}
          genomeCount={genomes.filter((g) => !g.isPreset).length}
          updateGenome={updateGenome}
          updateTrait={updateTrait}
          deleteGenome={deleteGenome}
        />
      )}

      {activeTab === 'roller' && (
        <RollerTab
          selected={selected}
          rollRarity={rollRarity}
          setRollRarity={setRollRarity}
          rollLevel={rollLevel}
          setRollLevel={setRollLevel}
          rollResult={rollResult}
          doRoll={doRoll}
        />
      )}

      {activeTab === 'breeding' && (
        <BreedingTab
          genomes={genomes}
          breedParentA={breedParentA}
          breedParentB={breedParentB}
          setBreedParentA={setBreedParentA}
          setBreedParentB={setBreedParentB}
          doBreed={doBreed}
        />
      )}

      {activeTab === 'evolution' && (
        <EvolutionTab selected={selected} doEvolve={doEvolve} />
      )}

      {activeTab === 'library' && (
        <LibraryTab
          genomes={genomes}
          selectedId={selected.id}
          onSelect={setSelectedId}
          onDuplicate={storeDuplicateGenome}
          onDelete={deleteGenome}
          onResetPresets={storeResetToPresets}
        />
      )}

      {/* UE5 C++ Code Preview */}
      <CodePreview selected={selected} />
    </motion.div>
  );
}
