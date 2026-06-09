'use client';

import { Pencil, Wand2 } from 'lucide-react';
import { PROMPT_CHIP_GROUPS } from '@/lib/visual-gen/prompt-chips';
import type { GenerationMode } from '@/lib/visual-gen/providers';

interface PromptBuilderProps {
  mode: GenerationMode;
  subject: string;
  onSubjectChange: (value: string) => void;
  selectedChipIds: string[];
  onToggleChip: (id: string) => void;
  advanced: boolean;
  onToggleAdvanced: () => void;
  rawPrompt: string;
  onRawPromptChange: (value: string) => void;
  composedPrompt: string;
  onSubmit: () => void;
}

/**
 * No-jargon prompt builder: a subject line plus clickable Material / Mood /
 * Game-style chips that compose the real generation prompt under the hood.
 * Controlled — all state lives in the parent GenerationPanel.
 */
export function PromptBuilder({
  mode,
  subject,
  onSubjectChange,
  selectedChipIds,
  onToggleChip,
  advanced,
  onToggleAdvanced,
  rawPrompt,
  onRawPromptChange,
  composedPrompt,
  onSubmit,
}: PromptBuilderProps) {
  const selected = new Set(selectedChipIds);
  const submitOnCtrlEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit();
  };

  const subjectLabel =
    mode === 'text-to-3d' ? 'What is it? (in plain words)' : 'Add style direction (optional)';
  const subjectPlaceholder =
    mode === 'text-to-3d' ? 'a medieval sword with an ornate handle' : 'leave blank to match the image';

  return (
    <div className="space-y-3">
      {/* Subject line */}
      <div>
        <label className="text-xs text-text-muted mb-1.5 block">{subjectLabel}</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          onKeyDown={submitOnCtrlEnter}
          placeholder={subjectPlaceholder}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-[var(--visual-gen)]"
        />
      </div>

      {/* Chip groups */}
      {!advanced &&
        PROMPT_CHIP_GROUPS.map((group) => (
          <div key={group.id}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-xs font-medium text-text">{group.label}</span>
              <span className="text-2xs text-text-muted">{group.hint}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.chips.map((chip) => {
                const active = selected.has(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onToggleChip(chip.id)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      active
                        ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/15 text-[var(--visual-gen)]'
                        : 'border-border text-text-muted hover:text-text hover:border-text-muted'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

      {/* Composed prompt preview / raw override */}
      {advanced ? (
        <div>
          <label className="text-xs text-text-muted mb-1.5 block">Raw prompt (advanced)</label>
          <textarea
            value={rawPrompt}
            onChange={(e) => onRawPromptChange(e.target.value)}
            onKeyDown={submitOnCtrlEnter}
            rows={3}
            placeholder="Type the exact prompt to send..."
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted resize-none focus:outline-none focus:border-[var(--visual-gen)]"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface/60 px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs uppercase tracking-wide text-text-muted">Prompt preview</span>
            <span className="text-2xs text-text-muted">{composedPrompt.length} chars</span>
          </div>
          <p className="text-xs text-text leading-relaxed break-words">
            {composedPrompt || (
              <span className="text-text-muted">
                Pick a few chips or type above — we&apos;ll build the technical prompt for you.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={onToggleAdvanced}
        className="flex items-center gap-1.5 text-2xs text-text-muted hover:text-text transition-colors"
      >
        {advanced ? <Wand2 size={12} /> : <Pencil size={12} />}
        {advanced ? 'Back to chip builder' : 'Edit raw prompt'}
      </button>
    </div>
  );
}
