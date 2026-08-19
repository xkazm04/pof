'use client';

import { Info, Flag, CheckSquare, LayoutList, Rows3 } from 'lucide-react';
import type { SubModuleId } from '@/types/modules';
import { PRIORITY_CONFIG } from './constants';
import type { RoadmapChecklistProps } from './types';
import { useRoadmapChecklist } from './useRoadmapChecklist';
import { MatrixScopeBanner } from '@/components/modules/shared/FeatureMatrix/MatrixScopeBanner';
import { NBABanner } from './NBABanner';
import { BulkActionBar } from './BulkActionBar';
import { CompactChecklist } from './CompactChecklist';
import { CardsChecklist } from './CardsChecklist';
import { ChecklistContextMenu } from './ChecklistContextMenu';

export type { RoadmapChecklistProps } from './types';

export function RoadmapChecklist({
  items, subModuleId, onRunPrompt, accentColor, isRunning,
  activeItemId, lastCompletedItemId, onBatchRun, batchQueue = [],
}: RoadmapChecklistProps) {
  const {
    progress, verification, toggleItem, suggestions,
    hoveredItemId, setHoveredItemId,
    layout, setLayout,
    metadata,
    setExpandedNotes,
    editingNotes, setEditingNotes,
    expandedNotes,
    priorityDropdown, setPriorityDropdown,
    contextMenu,
    handleContextMenu, closeContextMenu, handleMarkAllAbove, handleResetItem,
    selectMode, selected, selectDispatch,
    toggleSelected, selectAll, selectNone, exitSelectMode,
    saveMetadata, handleSetPriority, toggleNotes,
    nbaTop, nbaRecs, nbaLoading, nbaExpanded, setNbaExpanded,
    nbaScope, nbaScopedRows,
    completedCount, progressPercent, criticalCount, importantCount,
  } = useRoadmapChecklist(items, subModuleId);

  return (
    <div className="space-y-4">
      {/* NBA scores an unseen feature as unimplemented, so rows held by another
          project turn into confident advice to redo reviewed work. The shared
          scope disclosure sits ABOVE the recommendation it qualifies. */}
      <MatrixScopeBanner scope={nbaScope} visibleRows={nbaScopedRows} testId="pof-nba-scope" />

      {/* Next Best Action banner */}
      {!nbaLoading && nbaTop && !progress[nbaTop.item.id] && activeItemId !== nbaTop.item.id && (
        <NBABanner
          top={nbaTop}
          runners={nbaRecs.slice(1, 4)}
          expanded={nbaExpanded}
          onToggleExpand={() => setNbaExpanded((p) => !p)}
          onRun={(rec) => onRunPrompt(rec.item.id, rec.item.prompt)}
          accentColor={accentColor}
          isRunning={isRunning}
        />
      )}

      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Progress</span>
            {/* Layout toggle */}
            <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5">
              <button
                onClick={() => setLayout('compact')}
                className={`p-0.5 rounded transition-colors ${layout === 'compact' ? 'bg-border text-text' : 'text-text-muted hover:text-text'}`}
                title="Compact view"
              >
                <Rows3 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setLayout('cards')}
                className={`p-0.5 rounded transition-colors ${layout === 'cards' ? 'bg-border text-text' : 'text-text-muted hover:text-text'}`}
                title="Card view"
              >
                <LayoutList className="w-3 h-3" />
              </button>
            </div>
            {layout === 'cards' && (
              <button
                onClick={() => selectMode ? exitSelectMode() : selectDispatch({ type: 'ENTER' })}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs transition-colors ${
                  selectMode
                    ? 'bg-accent-medium text-accent-setup'
                    : 'text-text-muted hover:text-text hover:bg-surface-hover'
                }`}
                title={selectMode ? 'Exit select mode' : 'Select multiple items'}
              >
                <CheckSquare className="w-3 h-3" />
                {selectMode ? 'Cancel' : 'Select'}
              </button>
            )}
            {selectMode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={selectAll}
                  className="px-1.5 py-0.5 rounded text-2xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                >
                  All
                </button>
                <button
                  onClick={selectNone}
                  className="px-1.5 py-0.5 rounded text-2xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                >
                  None
                </button>
                {selected.size > 0 && (
                  <span className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-accent-subtle" style={{ color: accentColor }}>
                    {selected.size}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 text-2xs" style={{ color: PRIORITY_CONFIG.critical.color }}>
                <Flag className="w-2.5 h-2.5" /> {criticalCount} critical
              </span>
            )}
            {importantCount > 0 && (
              <span className="flex items-center gap-1 text-2xs" style={{ color: PRIORITY_CONFIG.important.color }}>
                <Flag className="w-2.5 h-2.5" /> {importantCount} important
              </span>
            )}
            <span className="text-text font-medium">{completedCount} / {items.length}</span>
          </div>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-slow ease-out"
            style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
          />
        </div>
      </div>

      {/* First-visit hint */}
      {completedCount === 0 && !isRunning && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-border bg-surface text-2xs text-text-muted leading-relaxed">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />
          <span>
            Each item has a <strong className="text-text">Claude</strong> button that sends a context-aware prompt to the CLI.
            Check items off manually or let Claude auto-complete them after a successful run.
            Right-click the flag icon to set priority.
          </span>
        </div>
      )}

      {/* Floating action bar for select mode (cards layout only) */}
      {layout === 'cards' && selectMode && selected.size > 0 && (
        <BulkActionBar
          selected={selected}
          items={items}
          subModuleId={subModuleId}
          progress={progress}
          accentColor={accentColor}
          onRunPrompt={onRunPrompt}
          isRunning={isRunning}
          onDone={exitSelectMode}
        />
      )}

      {/* Compact layout — consolidated card with checkbox rows */}
      {layout === 'compact' && (
        <CompactChecklist
          items={items}
          subModuleId={subModuleId}
          progress={progress}
          verification={verification}
          metadata={metadata}
          accentColor={accentColor}
          isRunning={isRunning}
          activeItemId={activeItemId ?? null}
          lastCompletedItemId={lastCompletedItemId ?? null}
          batchQueue={batchQueue}
          onRunPrompt={onRunPrompt}
          onBatchRun={onBatchRun}
          onToggleItem={(itemId) => toggleItem(subModuleId as SubModuleId, itemId)}
          onContextMenu={handleContextMenu}
        />
      )}

      {/* Cards layout — existing per-item cards */}
      {layout === 'cards' && (
        <CardsChecklist
          items={items}
          subModuleId={subModuleId}
          progress={progress}
          verification={verification}
          metadata={metadata}
          suggestions={suggestions}
          accentColor={accentColor}
          isRunning={isRunning}
          activeItemId={activeItemId ?? null}
          lastCompletedItemId={lastCompletedItemId ?? null}
          selectMode={selectMode}
          selected={selected}
          hoveredItemId={hoveredItemId}
          priorityDropdown={priorityDropdown}
          expandedNotes={expandedNotes}
          editingNotes={editingNotes}
          onRunPrompt={onRunPrompt}
          toggleItem={toggleItem}
          toggleSelected={toggleSelected}
          setHoveredItemId={setHoveredItemId}
          setPriorityDropdown={setPriorityDropdown}
          handleContextMenu={handleContextMenu}
          toggleNotes={toggleNotes}
          setEditingNotes={setEditingNotes}
          saveMetadata={saveMetadata}
          handleSetPriority={handleSetPriority}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ChecklistContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={items.find((i) => i.id === contextMenu.itemId)!}
          itemIndex={items.findIndex((i) => i.id === contextMenu.itemId)}
          isChecked={!!progress[contextMenu.itemId]}
          verification={verification[contextMenu.itemId]}
          accentColor={accentColor}
          isRunning={isRunning}
          onClose={closeContextMenu}
          onCopyPrompt={(text) => {
            navigator.clipboard.writeText(text);
            closeContextMenu();
          }}
          onRunWithClaude={(itemId, prompt) => {
            onRunPrompt(itemId, prompt);
            closeContextMenu();
          }}
          onMarkAllAbove={handleMarkAllAbove}
          onResetItem={handleResetItem}
          onAddNote={(itemId) => {
            setExpandedNotes((prev) => new Set([...prev, itemId]));
            setEditingNotes(itemId);
            closeContextMenu();
          }}
        />
      )}
    </div>
  );
}
