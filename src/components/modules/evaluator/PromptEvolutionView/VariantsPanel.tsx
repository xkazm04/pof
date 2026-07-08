import { Plus, GitBranch, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { PromptVariant, MutationType } from '@/types/prompt-evolution';
import type { ChecklistItem } from '@/types/modules';
import { ACCENT } from './constants';
import { VariantCard } from './VariantCard';
import { EmptyState } from './EmptyState';

// ── Variants Panel ──────────────────────────────────────────────────────────

export function VariantsPanel({
  variantsByItem,
  selectedModuleId,
  showCreateForm,
  setShowCreateForm,
  newPrompt,
  setNewPrompt,
  newChecklistItemId,
  setNewChecklistItemId,
  checklistItems,
  formErrors,
  clearFormError,
  handleCreateVariant,
  isMutating,
  selectedMutation,
  setSelectedMutation,
  handleMutate,
  expandedVariantId,
  setExpandedVariantId,
  handleStartTest,
}: {
  variantsByItem: Map<string, PromptVariant[]>;
  selectedModuleId: string | null;
  showCreateForm: boolean;
  setShowCreateForm: (v: boolean) => void;
  newPrompt: string;
  setNewPrompt: (v: string) => void;
  newChecklistItemId: string;
  setNewChecklistItemId: (v: string) => void;
  checklistItems: ChecklistItem[];
  formErrors: { checklistItemId?: string; prompt?: string };
  clearFormError: (field: 'checklistItemId' | 'prompt') => void;
  handleCreateVariant: () => void;
  isMutating: boolean;
  selectedMutation: MutationType;
  setSelectedMutation: (v: MutationType) => void;
  handleMutate: (id: string) => void;
  expandedVariantId: string | null;
  setExpandedVariantId: (id: string | null) => void;
  handleStartTest: (a: string, b: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Create variant button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-surface transition-colors"
        >
          <Plus className="w-3 h-3" />
          New Variant
        </button>
        {!selectedModuleId && (
          <span className="text-xs text-text-muted">Select a module first</span>
        )}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreateForm && selectedModuleId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <SurfaceCard level={2} className="p-4 space-y-3">
              {/* Checklist item picker */}
              <div className="space-y-1">
                <label htmlFor="pe-checklist-picker" className="text-xs font-medium text-text">
                  Checklist item
                </label>
                {checklistItems.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    This module has no checklist items — pick a different module.
                  </p>
                ) : (
                  <select
                    id="pe-checklist-picker"
                    value={newChecklistItemId}
                    onChange={(e) => {
                      setNewChecklistItemId(e.target.value);
                      clearFormError('checklistItemId');
                    }}
                    aria-invalid={Boolean(formErrors.checklistItemId)}
                    aria-describedby={formErrors.checklistItemId ? 'pe-checklist-error' : undefined}
                    className={`w-full px-3 py-1.5 text-xs rounded-md bg-surface border text-text ${
                      formErrors.checklistItemId ? 'border-status-red-strong' : 'border-border'
                    }`}
                  >
                    <option value="">Select a checklist item…</option>
                    {checklistItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id} — {item.label}
                      </option>
                    ))}
                  </select>
                )}
                {formErrors.checklistItemId && (
                  <p id="pe-checklist-error" role="alert" className="text-xs text-red-400">
                    {formErrors.checklistItemId}
                  </p>
                )}
              </div>

              {/* Prompt textarea */}
              <div className="space-y-1">
                <label htmlFor="pe-prompt-input" className="text-xs font-medium text-text">
                  Prompt
                </label>
                <textarea
                  id="pe-prompt-input"
                  value={newPrompt}
                  onChange={(e) => {
                    setNewPrompt(e.target.value);
                    clearFormError('prompt');
                  }}
                  placeholder="Enter the prompt variant text..."
                  rows={5}
                  aria-invalid={Boolean(formErrors.prompt)}
                  aria-describedby={formErrors.prompt ? 'pe-prompt-error' : undefined}
                  className={`w-full px-3 py-2 text-xs rounded-md bg-surface border text-text placeholder:text-text-muted resize-none font-mono ${
                    formErrors.prompt ? 'border-status-red-strong' : 'border-border'
                  }`}
                />
                {formErrors.prompt && (
                  <p id="pe-prompt-error" role="alert" className="text-xs text-red-400">
                    {formErrors.prompt}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateVariant}
                  disabled={isMutating || checklistItems.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Plus className="w-3 h-3" />
                  Create
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors"
                >
                  Cancel
                </button>
              </div>
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Variant groups */}
      {variantsByItem.size === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No variants yet"
          description={selectedModuleId
            ? 'Create a variant from a checklist prompt to start evolving it'
            : 'Select a module to view and manage prompt variants'
          }
        />
      ) : (
        <div className="space-y-3">
          {Array.from(variantsByItem.entries()).map(([itemId, itemVariants]) => (
            <SurfaceCard key={itemId} level={2} className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs font-medium text-text">{itemId}</span>
                <Badge variant="default" className="text-xs">
                  {itemVariants.length} variant{itemVariants.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="space-y-2">
                <AnimatePresence>
                  {itemVariants.map((v, idx) => (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <VariantCard
                        variant={v}
                        isExpanded={expandedVariantId === v.id}
                        onToggle={() => setExpandedVariantId(expandedVariantId === v.id ? null : v.id)}
                        selectedMutation={selectedMutation}
                        setSelectedMutation={setSelectedMutation}
                        onMutate={() => handleMutate(v.id)}
                        isMutating={isMutating}
                        siblings={itemVariants}
                        onStartTest={handleStartTest}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}
