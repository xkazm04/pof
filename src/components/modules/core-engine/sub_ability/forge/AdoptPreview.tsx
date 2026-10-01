'use client';

import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { STATUS_WARNING } from '@/lib/chart-colors';
import type { AdoptPreview as AdoptPreviewData, SliceDiff } from '@/lib/ability/adopt-preview';

function plural(n: number, one: string): string {
  return `${n} ${one}${n === 1 ? '' : 's'}`;
}

function replaced(d: SliceDiff, noun: string, named: boolean): string | null {
  const gone = [...d.removed, ...d.changed];
  if (gone.length === 0) return null;
  return named ? `${plural(gone.length, noun)} (${gone.join(', ')})` : plural(gone.length, noun);
}

/**
 * The consequence sentences of one adopt, in reading order. Shared by the
 * inline preview line and the confirmation dialog so both say the same thing.
 */
export function adoptPreviewLines(p: AdoptPreviewData, targetName: string, readError?: string | null): string[] {
  if (p.status === 'unloaded') {
    const why = readError ? `could not be read (${readError})` : 'is still loading';
    return [`${targetName}'s stored spec ${why} — adopting may overwrite effects and tag rules you cannot see here.`];
  }
  const lines: string[] = [];
  const parts = [replaced(p.effects, 'effect', true), replaced(p.tagRules, 'tag rule', false)].filter(Boolean);
  if (parts.length) lines.push(`Replaces ${parts.join(', ')} on ${targetName}.`);
  else lines.push(`Adds ${plural(p.effects.added.length, 'effect')} and ${plural(p.tagRules.added.length, 'tag rule')} to ${targetName}.`);
  if (p.supersedes) lines.push(`Supersedes the earlier forge ${p.supersedes.className} (${p.supersedes.displayName}).`);
  if (p.codegenAtRisk) lines.push('UE code is confirmed for the current spec — re-run Generate in UE after adopting.');
  if (p.keeps.length) lines.push(`Keeps the authored ${p.keeps.join(', ')}.`);
  return lines;
}

interface Props {
  preview: AdoptPreviewData;
  targetName: string;
  readError?: string | null;
}

/** One-line "what this adopt replaces" readout under the Adopt bar. */
export function AdoptPreview({ preview, targetName, readError }: Props) {
  const loading = preview.status === 'unloaded' && !readError;
  const warn = preview.status === 'replaces' || !!readError;
  const Icon = loading ? Loader2 : warn ? AlertTriangle : Info;
  return (
    <p
      className="flex items-start gap-1.5 text-2xs font-mono leading-relaxed text-text-muted"
      style={warn ? { color: STATUS_WARNING } : undefined}
      aria-live="polite"
      data-testid="adopt-preview"
    >
      <Icon className={`w-3 h-3 mt-0.5 shrink-0${loading ? ' animate-spin' : ''}`} />
      <span>{adoptPreviewLines(preview, targetName, readError).join(' ')}</span>
    </p>
  );
}
