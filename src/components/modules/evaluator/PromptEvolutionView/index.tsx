'use client';

import { Dna } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PromptVersionTimeline } from '@/components/modules/evaluator/PromptVersionTimeline';
import type { SubModuleId } from '@/types/modules';
import { toast } from 'sonner';
import { ACCENT, MODULE_OPTIONS } from './constants';
import { usePromptEvolution } from './usePromptEvolution';
import { ModeToggle } from './ModeToggle';
import { SuggestionsBar } from './SuggestionsBar';
import { VariantsPanel } from './VariantsPanel';
import { TestsPanel } from './TestsPanel';
import { ClustersPanel } from './ClustersPanel';
import { OptimizerPanel } from './OptimizerPanel';
import { StatsPanel } from './StatsPanel';

// ── Main Component ──────────────────────────────────────────────────────────

export function PromptEvolutionView() {
  const {
    variants, abTests, clusters, suggestions, stats, promptFitness, selectedModuleId,
    isLoading, isMutating, isClustering, error, activeSubTab,
    lastOptimization, isOptimizing,
    setActiveSubTab, mutateVariant, clusterPrompts, concludeTestAction,
    optimizePromptAction, getBestVariant, restoreVariant,
    newPrompt, setNewPrompt, newChecklistItemId, setNewChecklistItemId,
    showCreateForm, setShowCreateForm, selectedMutation, setSelectedMutation,
    expandedVariantId, setExpandedVariantId, expandedTestId, setExpandedTestId,
    formErrors, setFormErrors, mode,
    handleSelectModule, moduleChecklistItems, handleCreateVariant, handleMutate, handleSaveChallenger,
    handleCluster, handleStartTest, variantsByItem, historyItemOptions,
    visibleTabs, handleSetMode,
  } = usePromptEvolution();

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Dna className="w-5 h-5" style={{ color: ACCENT }} />
          <h2 className="text-base font-semibold text-text">Prompt Evolution Engine</h2>
          <Badge variant="default" className="text-xs">
            {stats.totalVariants} variants
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Simple / Advanced mode toggle */}
          <ModeToggle mode={mode} onChange={handleSetMode} />

          {/* Module picker */}
          <select
            value={selectedModuleId ?? ''}
            onChange={(e) => handleSelectModule((e.target.value || null) as SubModuleId | null)}
            className="px-3 py-1.5 text-xs rounded-md bg-surface border border-border text-text"
          >
            <option value="">Select module...</option>
            {MODULE_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Suggestions bar — actionable cards */}
      {suggestions.length > 0 && (
        <SuggestionsBar
          suggestions={suggestions}
          onMutate={mutateVariant}
          onCluster={clusterPrompts}
          onAdoptWinner={async (moduleId, itemId) => {
            const best = await getBestVariant(moduleId, itemId);
            if (!best) {
              toast.error('No best variant available for this item yet.');
              return;
            }
            // Adopt = make the winner the active variant. The dispatch path reads
            // this flag, so the next real run of this checklist item sends the
            // winning prompt (not just a clipboard copy).
            const adopted = await restoreVariant(best.id);
            if (!adopted) {
              toast.error('Failed to adopt the winning variant.');
              return;
            }
            toast.success(`Adopted “${best.label}” — the next run will use it`);
          }}
          onNavigateVariants={(variantId) => {
            setActiveSubTab('variants');
            if (variantId) setExpandedVariantId(variantId);
          }}
          onNavigateClusters={() => setActiveSubTab('clusters')}
        />
      )}

      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ${
              activeSubTab === tab.id ? 'text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
            {activeSubTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ backgroundColor: ACCENT }} />
            )}
          </button>
        ))}
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg border border-status-red-strong bg-status-red-subtle text-xs text-red-400">{error}</div>
      )}

      {!isLoading && !error && (
        <>
          {activeSubTab === 'optimizer' && (
            <OptimizerPanel
              selectedModuleId={selectedModuleId}
              lastOptimization={lastOptimization}
              isOptimizing={isOptimizing}
              onOptimize={optimizePromptAction}
              checklistItems={moduleChecklistItems}
              onSaveChallenger={handleSaveChallenger}
            />
          )}

          {activeSubTab === 'variants' && (
            <VariantsPanel
              variantsByItem={variantsByItem}
              selectedModuleId={selectedModuleId}
              checklistItems={moduleChecklistItems}
              showCreateForm={showCreateForm}
              setShowCreateForm={setShowCreateForm}
              newPrompt={newPrompt}
              setNewPrompt={setNewPrompt}
              newChecklistItemId={newChecklistItemId}
              setNewChecklistItemId={setNewChecklistItemId}
              formErrors={formErrors}
              clearFormError={(field) => setFormErrors((prev) => ({ ...prev, [field]: undefined }))}
              handleCreateVariant={handleCreateVariant}
              isMutating={isMutating}
              selectedMutation={selectedMutation}
              setSelectedMutation={setSelectedMutation}
              handleMutate={handleMutate}
              expandedVariantId={expandedVariantId}
              setExpandedVariantId={setExpandedVariantId}
              handleStartTest={handleStartTest}
            />
          )}

          {activeSubTab === 'history' && (
            <PromptVersionTimeline
              key={selectedModuleId ?? 'none'}
              selectedModuleId={selectedModuleId}
              itemOptions={historyItemOptions}
            />
          )}

          {activeSubTab === 'tests' && (
            <TestsPanel
              abTests={abTests}
              variants={variants}
              expandedTestId={expandedTestId}
              setExpandedTestId={setExpandedTestId}
              concludeTest={concludeTestAction}
              mode={mode}
            />
          )}

          {activeSubTab === 'clusters' && (
            <ClustersPanel
              clusters={clusters}
              selectedModuleId={selectedModuleId}
              isClustering={isClustering}
              handleCluster={handleCluster}
            />
          )}

          {activeSubTab === 'stats' && (
            <StatsPanel stats={stats} promptFitness={promptFitness} mode={mode} />
          )}
        </>
      )}
    </div>
  );
}
