'use client';

import { useState, useCallback } from 'react';
import { Code, Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_10, OPACITY_20 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from './design';
import { ACCENT, STATUS_SUCCESS, STATUS_WARNING } from './constants';
import type { ItemConcept } from './constants';

export function CodePanel({ code, concept }: { code: string; concept: ItemConcept }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <BlueprintPanel color={ACCENT} className="p-2 space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader icon={Code} label={`UE5 Code: ${concept.displayName}`} color={ACCENT} />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em] px-2 py-0.5 rounded transition-colors"
            style={{
              backgroundColor: copied ? `${STATUS_SUCCESS}${OPACITY_20}` : `${ACCENT}${OPACITY_10}`,
              color: copied ? STATUS_SUCCESS : ACCENT,
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="bg-surface-deep rounded-lg p-3 text-xs font-mono text-text overflow-x-auto custom-scrollbar whitespace-pre leading-relaxed border border-border/40 max-h-[500px] overflow-y-auto">
          {code}
        </pre>
      </BlueprintPanel>

      <BlueprintPanel color={STATUS_WARNING} className="p-2 space-y-3">
        <SectionHeader icon={Settings2} label="Integration Steps" color={STATUS_WARNING} />
        <div className="space-y-1 text-xs text-text-muted">
          <IntegrationStep num={1} text="Create a UARPGItemDefinition Data Asset from the generated code" />
          <IntegrationStep num={2} text="Add rows to DT_AffixPool DataTable using the weight values above" />
          <IntegrationStep num={3} text="Create the GE_OnEquip GameplayEffect with SetByCaller modifiers" />
          <IntegrationStep num={4} text="Assign the AffixPool reference to the ItemDefinition" />
          <IntegrationStep num={5} text="Test with UARPGAffixRoller::RollAffixes to verify distributions match" />
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}

function IntegrationStep({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT }}
      >
        {num}
      </span>
      <span>{text}</span>
    </div>
  );
}
