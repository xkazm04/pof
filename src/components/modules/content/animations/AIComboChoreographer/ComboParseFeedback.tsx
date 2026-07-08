'use client';

import { Info } from 'lucide-react';
import { STATUS_INFO, ACCENT_CYAN } from '@/lib/chart-colors';
import type { ComboParse } from './types';

/**
 * Honest feedback on how the free-text description was interpreted: a non-blocking
 * STATUS_INFO note when no hit types were recognized (and a default combo was used),
 * plus chips for the keywords that actually matched.
 */
export function ComboParseFeedback({ parse }: { parse: ComboParse }) {
  if (parse.typesRecognized && parse.matchedKeywords.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {!parse.typesRecognized && (
        <div
          role="status"
          className="flex items-start gap-2 px-3 py-2 rounded-lg text-2xs"
          style={{ backgroundColor: `${STATUS_INFO}12`, border: `1px solid ${STATUS_INFO}30`, color: STATUS_INFO }}
        >
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          <span>
            No hit types recognized in your description — generated a default {parse.count}-hit combo.
            Try words like <span className="font-mono font-semibold">sweep</span>,{' '}
            <span className="font-mono font-semibold">thrust</span>,{' '}
            <span className="font-mono font-semibold">slam</span>.
          </span>
        </div>
      )}
      {parse.matchedKeywords.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-2xs text-text-muted">Matched keywords:</span>
          {parse.matchedKeywords.map((m) => (
            <span
              key={m.word}
              className="text-2xs px-2 py-0.5 rounded-full font-mono"
              style={{ backgroundColor: `${ACCENT_CYAN}15`, color: ACCENT_CYAN, border: `1px solid ${ACCENT_CYAN}30` }}
              title={`recognized as "${m.type}"`}
            >
              {m.word}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
