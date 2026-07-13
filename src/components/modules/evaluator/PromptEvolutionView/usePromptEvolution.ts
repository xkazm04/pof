'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  GitBranch, BarChart3, FlaskConical, Layers, Wand2, History,
} from 'lucide-react';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type { PromptVariant, MutationType } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';
import { toast } from 'sonner';
import { getModuleChecklist } from '@/lib/module-registry';
import type { ViewMode } from './constants';

export function usePromptEvolution() {
  const variants = usePromptEvolutionStore((s) => s.variants);
  const abTests = usePromptEvolutionStore((s) => s.abTests);
  const clusters = usePromptEvolutionStore((s) => s.clusters);
  const suggestions = usePromptEvolutionStore((s) => s.suggestions);
  const stats = usePromptEvolutionStore((s) => s.stats);
  const selectedModuleId = usePromptEvolutionStore((s) => s.selectedModuleId);
  const isLoading = usePromptEvolutionStore((s) => s.isLoading);
  const isMutating = usePromptEvolutionStore((s) => s.isMutating);
  const isClustering = usePromptEvolutionStore((s) => s.isClustering);
  const error = usePromptEvolutionStore((s) => s.error);
  const activeSubTab = usePromptEvolutionStore((s) => s.activeSubTab);

  const lastOptimization = usePromptEvolutionStore((s) => s.lastOptimization);
  const isOptimizing = usePromptEvolutionStore((s) => s.isOptimizing);

  const init = usePromptEvolutionStore((s) => s.init);
  const setSelectedModule = usePromptEvolutionStore((s) => s.setSelectedModule);
  const setActiveSubTab = usePromptEvolutionStore((s) => s.setActiveSubTab);
  const loadVariants = usePromptEvolutionStore((s) => s.loadVariants);
  const createVariant = usePromptEvolutionStore((s) => s.createVariant);
  const mutateVariant = usePromptEvolutionStore((s) => s.mutateVariant);
  const startABTest = usePromptEvolutionStore((s) => s.startABTest);
  const concludeTestAction = usePromptEvolutionStore((s) => s.concludeTest);
  const clusterPrompts = usePromptEvolutionStore((s) => s.clusterPrompts);
  const loadSuggestions = usePromptEvolutionStore((s) => s.loadSuggestions);
  const optimizePromptAction = usePromptEvolutionStore((s) => s.optimizePrompt);
  const getBestVariant = usePromptEvolutionStore((s) => s.getBestVariant);
  const restoreVariant = usePromptEvolutionStore((s) => s.restoreVariant);

  const [newPrompt, setNewPrompt] = useState('');
  const [newChecklistItemId, setNewChecklistItemId] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMutation, setSelectedMutation] = useState<MutationType>('imperative-rewrite');
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{ checklistItemId?: string; prompt?: string }>({});

  // Simple Mode hides the math-heavy internals (Clusters/Stats) and relabels
  // results in plain language. Default ON to keep the screen approachable for
  // non-technical users; "Advanced" reveals the full statistical detail.
  const [mode, setMode] = useState<ViewMode>('simple');

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (selectedModuleId) {
      loadVariants(selectedModuleId);
      loadSuggestions(selectedModuleId);
    }
  }, [selectedModuleId, loadVariants, loadSuggestions]);

  // Module changes invalidate the picker selection (item ids are module-scoped).
  // Handled at the onChange site to avoid set-state-in-effect.
  const handleSelectModule = useCallback((next: SubModuleId | null) => {
    setSelectedModule(next);
    setNewChecklistItemId('');
    setFormErrors({});
  }, [setSelectedModule]);

  // Checklist items for the currently selected module — drives the picker below.
  const moduleChecklistItems = useMemo(
    () => (selectedModuleId ? getModuleChecklist(selectedModuleId) : []),
    [selectedModuleId],
  );

  const handleCreateVariant = useCallback(async () => {
    const errors: { checklistItemId?: string; prompt?: string } = {};
    if (!selectedModuleId) {
      errors.checklistItemId = 'Select a module before creating a variant.';
    } else if (!newChecklistItemId) {
      errors.checklistItemId = 'Pick a checklist item to attach this variant to.';
    } else if (!moduleChecklistItems.some((c) => c.id === newChecklistItemId)) {
      errors.checklistItemId = `“${newChecklistItemId}” is not a checklist item in this module.`;
    }
    if (!newPrompt.trim()) {
      errors.prompt = 'Variant prompt cannot be empty.';
    } else if (newPrompt.trim().length < 16) {
      errors.prompt = 'Variant prompt is too short — provide at least 16 characters.';
    }
    if (errors.checklistItemId || errors.prompt) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    const created = await createVariant(selectedModuleId!, newChecklistItemId, newPrompt.trim());
    if (!created) {
      // Surface the store error in the form (in addition to the global banner).
      const storeError = usePromptEvolutionStore.getState().error;
      setFormErrors({ prompt: storeError ?? 'Failed to create variant.' });
      return;
    }
    toast.success(`Created variant “${created.label}”`);
    setNewPrompt('');
    setShowCreateForm(false);
  }, [selectedModuleId, newChecklistItemId, newPrompt, moduleChecklistItems, createVariant]);

  const handleMutate = useCallback(async (variantId: string) => {
    await mutateVariant(variantId, selectedMutation);
  }, [mutateVariant, selectedMutation]);

  const handleCluster = useCallback(async () => {
    if (!selectedModuleId) return;
    await clusterPrompts(selectedModuleId);
  }, [selectedModuleId, clusterPrompts]);

  const handleStartTest = useCallback(async (variantAId: string, variantBId: string) => {
    if (!selectedModuleId) return;
    const varA = variants.find((v) => v.id === variantAId);
    if (!varA) return;
    await startABTest(selectedModuleId, varA.checklistItemId, variantAId, variantBId);
  }, [selectedModuleId, variants, startABTest]);

  // Group variants by checklist item
  const variantsByItem = useMemo(() => {
    const map = new Map<string, PromptVariant[]>();
    for (const v of variants) {
      const list = map.get(v.checklistItemId) ?? [];
      list.push(v);
      map.set(v.checklistItemId, list);
    }
    return map;
  }, [variants]);

  // Checklist items that actually have variants — drives the History picker.
  const historyItemOptions = useMemo(() => {
    const labelById = new Map(moduleChecklistItems.map((c) => [c.id, c.label]));
    return Array.from(variantsByItem.keys()).map((id) => ({
      id,
      label: labelById.has(id) ? `${id} — ${labelById.get(id)}` : id,
    }));
  }, [variantsByItem, moduleChecklistItems]);

  const SUB_TABS = [
    { id: 'optimizer' as const, label: 'Optimizer', icon: Wand2 },
    { id: 'variants' as const, label: 'Variants', icon: GitBranch },
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'tests' as const, label: 'A/B Tests', icon: FlaskConical },
    { id: 'clusters' as const, label: 'Clusters', icon: Layers, advancedOnly: true },
    { id: 'stats' as const, label: 'Stats', icon: BarChart3, advancedOnly: true },
  ];

  // Simple Mode tucks the math-heavy Clusters/Stats tabs away.
  const visibleTabs = mode === 'advanced' ? SUB_TABS : SUB_TABS.filter((t) => !t.advancedOnly);

  // Switch modes; if Simple Mode hides the current tab, fall back to A/B Tests.
  // Done at the click site to avoid set-state-in-effect.
  const handleSetMode = useCallback((next: ViewMode) => {
    setMode(next);
    if (next === 'simple' && (activeSubTab === 'clusters' || activeSubTab === 'stats')) {
      setActiveSubTab('tests');
    }
  }, [activeSubTab, setActiveSubTab]);

  return {
    // store state
    variants, abTests, clusters, suggestions, stats, selectedModuleId,
    isLoading, isMutating, isClustering, error, activeSubTab,
    lastOptimization, isOptimizing,
    // store actions
    setActiveSubTab, mutateVariant, clusterPrompts, concludeTestAction,
    optimizePromptAction, getBestVariant, restoreVariant,
    // local form state
    newPrompt, setNewPrompt, newChecklistItemId, setNewChecklistItemId,
    showCreateForm, setShowCreateForm, selectedMutation, setSelectedMutation,
    expandedVariantId, setExpandedVariantId, expandedTestId, setExpandedTestId,
    formErrors, setFormErrors, mode,
    // derived + handlers
    handleSelectModule, moduleChecklistItems, handleCreateVariant, handleMutate,
    handleCluster, handleStartTest, variantsByItem, historyItemOptions,
    visibleTabs, handleSetMode,
  };
}
