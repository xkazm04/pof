'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import type {
  PatternCategory,
  PatternAuthorInput,
} from '@/types/pattern-library';
import type { SubModuleId } from '@/types/modules';
import { CATEGORY_LABELS } from './constants';

// ── Author Pattern Modal ────────────────────────────────────────────────────

export function AuthorPatternModal({
  open,
  onClose,
  moduleIds,
}: {
  open: boolean;
  onClose: () => void;
  moduleIds: SubModuleId[];
}) {
  const authorPattern = usePatternLibraryStore((s) => s.authorPattern);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<PatternAuthorInput>(() => ({
    title: '',
    moduleId: (moduleIds[0] ?? 'arpg-character') as SubModuleId,
    category: 'general',
    description: '',
    approach: '',
    tags: [],
    pitfalls: [],
    involvedClasses: [],
  }));
  const [tagsText, setTagsText] = useState('');
  const [pitfallsText, setPitfallsText] = useState('');
  const [classesText, setClassesText] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Reset form when the modal re-opens
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing
    setForm({
      title: '',
      moduleId: (moduleIds[0] ?? 'arpg-character') as SubModuleId,
      category: 'general',
      description: '',
      approach: '',
      tags: [],
      pitfalls: [],
      involvedClasses: [],
    });
    setTagsText('');
    setPitfallsText('');
    setClassesText('');
  }, [open, moduleIds]);

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    const input: PatternAuthorInput = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      approach: form.approach.trim() || 'general',
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      pitfalls: pitfallsText.split('\n').map((t) => t.trim()).filter(Boolean),
      involvedClasses: classesText.split(',').map((t) => t.trim()).filter(Boolean),
    };
    const created = await authorPattern(input);
    setSubmitting(false);
    if (created) onClose();
  }, [form, tagsText, pitfallsText, classesText, authorPattern, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Author a Pattern"
      icon={<Plus className="w-4 h-4 text-emerald-400" />}
      initialFocusRef={titleInputRef}
    >
        <p className="text-2xs text-text-muted mb-3 leading-relaxed">
          Hand-authored patterns are saved as <strong>verified</strong> and outrank mined entries in dispatch suggestions.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Title</label>
            <input
              ref={titleInputRef}
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              placeholder="e.g. GAS Combo via Montage Sections"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs text-text-muted font-medium mb-1 block">Module</label>
              <select
                value={form.moduleId}
                onChange={(e) => setForm((f) => ({ ...f, moduleId: e.target.value as SubModuleId }))}
                className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              >
                {moduleIds.length === 0 && <option value={form.moduleId}>{form.moduleId}</option>}
                {moduleIds.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-2xs text-text-muted font-medium mb-1 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as PatternCategory }))}
                className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              >
                {(Object.keys(CATEGORY_LABELS) as PatternCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Approach</label>
            <input
              type="text"
              value={form.approach}
              onChange={(e) => setForm((f) => ({ ...f, approach: e.target.value }))}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              placeholder="composition | inheritance | data-driven | event-driven | ..."
            />
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40 resize-y"
              placeholder="Describe the pattern: when to use it, why it works, what to avoid…"
            />
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              placeholder="gas, montage, combo"
            />
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Involved Classes (comma-separated)</label>
            <input
              type="text"
              value={classesText}
              onChange={(e) => setClassesText(e.target.value)}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40 font-mono"
              placeholder="UGameplayAbility, UAnimMontage, AVCharacter"
            />
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Pitfalls (one per line)</label>
            <textarea
              value={pitfallsText}
              onChange={(e) => setPitfallsText(e.target.value)}
              rows={3}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40 resize-y"
              placeholder="Don't replicate animation state directly&#10;Watch out for montage section ordering"
            />
          </div>

          <div>
            <label className="text-2xs text-text-muted font-medium mb-1 block">Authored By (optional)</label>
            <input
              type="text"
              value={form.authoredBy ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, authoredBy: e.target.value }))}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-emerald-500/40"
              placeholder="your name or handle"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !form.title.trim() || !form.description.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {submitting ? 'Saving…' : 'Save Pattern'}
          </button>
        </div>
    </Modal>
  );
}
