'use client';

import { Copy, Code } from 'lucide-react';
import type { EliteModifier } from '../_shared/data';
import { generateModifierGE } from '../_shared/data';
import { Modal } from '@/components/ui/Modal';

import { withOpacity, OPACITY_10, OPACITY_25 } from '@/lib/chart-colors';
interface CodegenModalProps {
  mod: EliteModifier | null;
  onClose: () => void;
}

/**
 * Held mounted by the bestiary shell with `mod` toggling null/non-null, so the
 * shared Modal sees a real open → closed transition and restores focus to the
 * row that opened it. The tier badge and Copy action moved out of the header
 * (Modal owns that) into a toolbar above the generated code.
 */
export function CodegenModal({ mod, onClose }: CodegenModalProps) {
  const codeText = mod ? generateModifierGE(mod) : '';
  return (
    <Modal
      open={mod !== null}
      onClose={onClose}
      title={mod ? `UE5 GameplayEffect — ${mod.name}` : 'UE5 GameplayEffect'}
      icon={<Code className="w-4 h-4" style={{ color: mod?.color }} />}
      className="max-w-2xl"
    >
      {mod && (
        <>
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/40">
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-full border"
              style={{
                backgroundColor: `${withOpacity(mod.color, OPACITY_10)}`,
                borderColor: `${withOpacity(mod.color, OPACITY_25)}`,
                color: mod.color,
              }}
            >
              {mod.icon} {mod.tier}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(codeText)}
              className="text-xs font-bold px-2 py-1 rounded border border-border/40 bg-surface-deep hover:bg-surface-hover transition-colors text-text-muted hover:text-text flex items-center gap-1 cursor-pointer focus-ring"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <div className="pt-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <pre className="text-xs font-mono text-text-muted leading-relaxed whitespace-pre-wrap">
              {codeText}
            </pre>
          </div>
        </>
      )}
    </Modal>
  );
}
