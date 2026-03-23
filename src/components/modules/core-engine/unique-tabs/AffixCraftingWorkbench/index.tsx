'use client';

import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { RARITY_COLORS } from './data';
import type { AffixPoolEntry } from './data';
import { ACCENT, getCategoryColor } from './constants';
import { useAffixWorkbench } from './hooks';
import { AFFIX_POOL } from './data';
import { WorkbenchHeader } from './WorkbenchHeader';
import { AffixPoolPanel } from './AffixPoolPanel';
import { ItemBaseSelector } from './ItemBaseSelector';
import { ItemPreviewCard } from './ItemPreviewCard';
import { CraftingStation } from './CraftingStation';
import { ItemStatsSummary } from './ItemStatsSummary';
import { BreakpointTable } from './BreakpointTable';
import { PowerBudgetRadar } from '../affix-workbench/PowerBudgetRadar';
import { SynergyDetector } from '../affix-workbench/SynergyDetector';
import { ArchetypeSuggestionGrid } from '../affix-workbench/ArchetypeSuggestionGrid';
import { AffixExportPanel } from '../affix-workbench/AffixExportPanel';
import { generateExportCode } from './data';
import type { SubModuleId } from '@/types/modules';

/* ── Drag ghost builder ──────────────────────────────────────────────── */

function buildDragGhost(entry: AffixPoolEntry): HTMLDivElement {
  const catColor = getCategoryColor(entry.category);
  const ghost = document.createElement('div');
  ghost.style.cssText = `
    position:fixed;top:-100px;left:-100px;width:120px;height:28px;
    display:flex;align-items:center;gap:6px;padding:0 10px;
    background:rgba(15,15,25,0.9);border:1px solid ${catColor}60;
    border-radius:14px;font-family:ui-monospace,monospace;
    font-size:11px;font-weight:700;color:#e2e8f0;
    backdrop-filter:blur(8px);pointer-events:none;
    box-shadow:0 4px 12px rgba(0,0,0,0.4),0 0 8px ${catColor}30;`;
  const dot = document.createElement('span');
  dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${catColor};box-shadow:0 0 4px ${catColor};flex-shrink:0;`;
  const label = document.createElement('span');
  label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  label.textContent = entry.displayName;
  ghost.appendChild(dot);
  ghost.appendChild(label);
  return ghost;
}

/* ── Main Component ──────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AffixCraftingWorkbench({ moduleId }: { moduleId: SubModuleId }) {
  const wb = useAffixWorkbench();
  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  /* Drag handlers */
  const handleDragStart = useCallback((e: React.DragEvent, entry: AffixPoolEntry) => {
    e.dataTransfer.setData('text/plain', entry.id);
    e.dataTransfer.effectAllowed = 'copy';
    wb.setDraggingAffixId(entry.id);
    const ghost = buildDragGhost(entry);
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    e.dataTransfer.setDragImage(ghost, 60, 14);
  }, [wb]);

  const handleDragEnd = useCallback(() => {
    wb.setDraggingAffixId(null);
    if (dragGhostRef.current) {
      document.body.removeChild(dragGhostRef.current);
      dragGhostRef.current = null;
    }
  }, [wb]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    wb.setDragOverItem(true);
  }, [wb]);

  const handleDragLeave = useCallback(() => wb.setDragOverItem(false), [wb]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    wb.setDragOverItem(false);
    const entryId = e.dataTransfer.getData('text/plain');
    const entry = AFFIX_POOL.find((a) => a.id === entryId);
    if (entry) wb.addAffix(entry);
  }, [wb]);

  const rarityColor = RARITY_COLORS[wb.selectedBase.rarity];

  return (
    <div className="space-y-4">
      <WorkbenchHeader viewMode={wb.viewMode} setViewMode={wb.setViewMode}
        onRandomRoll={wb.randomRoll} onClear={wb.clearAffixes}
        showExport={wb.showExport} onToggleExport={() => wb.setShowExport(!wb.showExport)}
        onInjectToUE5={wb.handleInjectToUE5} ue5Status={wb.ue5Status}
        craftedAffixCount={wb.craftedAffixes.length} injectStatus={wb.injectStatus}
        injectError={wb.injectError} />

      {wb.viewMode === 'breakpoints' && (
        <BreakpointTable bpCategoryFilter={wb.bpCategoryFilter} setBpCategoryFilter={wb.setBpCategoryFilter}
          bpRarityFilter={wb.bpRarityFilter} setBpRarityFilter={wb.setBpRarityFilter}
          bpSearch={wb.bpSearch} setBpSearch={wb.setBpSearch} />
      )}

      {wb.viewMode === 'workbench' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] xl:grid-cols-[280px_1fr_280px] gap-4">
            {/* Left: Affix Pool */}
            <AffixPoolPanel filteredPool={wb.filteredPool} poolFilter={wb.poolFilter}
              setPoolFilter={wb.setPoolFilter} poolSearch={wb.poolSearch}
              setPoolSearch={wb.setPoolSearch} maxAffixes={wb.maxAffixes}
              craftedAffixCount={wb.craftedAffixes.length} rarityColor={rarityColor}
              rarity={wb.selectedBase.rarity} canAddMore={wb.canAddMore}
              draggingAffixId={wb.draggingAffixId} maxWeight={wb.maxWeight}
              totalWeight={wb.totalWeight} onAddAffix={wb.addAffix}
              onDragStart={handleDragStart} onDragEnd={handleDragEnd}
              getCategoryColor={getCategoryColor} />

            {/* Center: Item Preview */}
            <div className="space-y-4">
              <ItemBaseSelector selectedBase={wb.selectedBase} itemLevel={wb.itemLevel}
                onSelectBase={wb.selectBase} onSetItemLevel={wb.setItemLevel} />

              <ItemPreviewCard selectedBase={wb.selectedBase} craftedAffixes={wb.craftedAffixes}
                fullItemName={wb.fullItemName} itemLevel={wb.itemLevel}
                dragOverItem={wb.dragOverItem} onDragOver={handleDragOver}
                onDragLeave={handleDragLeave} onDrop={handleDrop}
                onRemoveAffix={wb.removeAffix} onUpdateMagnitude={wb.updateAffixMagnitude}
                onTogglePlacement={wb.toggleAffixPlacement}
                onSetPreviewTag={wb.setPreviewTag} maxAffixes={wb.maxAffixes} />

              <CraftingStation showCraftPanel={wb.showCraftPanel}
                onToggleCraftPanel={() => wb.setShowCraftPanel(!wb.showCraftPanel)}
                prefixLocked={wb.prefixLocked} suffixLocked={wb.suffixLocked}
                craftCount={wb.craftCount} wallet={wb.wallet}
                craftedAffixes={wb.craftedAffixes} maxAffixes={wb.maxAffixes}
                craftFlash={wb.craftFlash} craftLog={wb.craftLog}
                avgCraftCost={wb.avgCraftCost} onExecuteCraft={wb.executeCraft}
                onResetWallet={wb.resetWallet} canAfford={wb.canAfford} />
            </div>

            {/* Right: Budget + Synergies + Stats */}
            <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-1 xl:block xl:space-y-3">
              <PowerBudgetRadar radarAxes={wb.radarAxes} radarValues={wb.radarValues}
                ghostRadarValues={wb.ghostRadarValues} isOverBudget={wb.isOverBudget}
                powerBudget={wb.powerBudget} budgetMax={wb.budgetMax}
                budgetRatio={wb.budgetRatio} rarityLabel={wb.selectedBase.rarity}
                rarityColor={rarityColor} accentColor={ACCENT} />

              <SynergyDetector activeSynergies={wb.activeSynergies}
                expandedSynergies={wb.expandedSynergies}
                onToggleExpanded={() => wb.setExpandedSynergies(!wb.expandedSynergies)}
                synergyGlow={wb.synergyGlow} newSynergyLabels={wb.newSynergyLabels}
                craftedAffixCount={wb.craftedAffixes.length} />

              <ItemStatsSummary craftedAffixes={wb.craftedAffixes} maxAffixes={wb.maxAffixes}
                itemLevel={wb.itemLevel} activeSynergies={wb.activeSynergies}
                wallet={wb.wallet} prefixLocked={wb.prefixLocked}
                suffixLocked={wb.suffixLocked} totalSpent={wb.totalSpent} />
            </div>
          </div>

          <ArchetypeSuggestionGrid archetypes={wb.suggestedArchetypes}
            craftedAffixes={wb.craftedAffixes} onApplyArchetype={wb.applyArchetype}
            rarity={wb.selectedBase.rarity} />

          <AffixExportPanel visible={wb.showExport}
            exportCode={generateExportCode(wb.selectedBase, wb.craftedAffixes)}
            onCopy={wb.handleCopy} onDownload={wb.handleExportFile}
            copied={wb.copiedExport} accentColor={ACCENT} />
        </motion.div>
      )}
    </div>
  );
}
