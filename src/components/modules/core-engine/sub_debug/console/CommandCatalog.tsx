'use client';

import { useMemo, useState, useCallback } from 'react';
import { Search, Play } from 'lucide-react';
import {
  ACCENT_EMERALD, OPACITY_10, OPACITY_20, OPACITY_30,
  withOpacity, OPACITY_12, OPACITY_37, OPACITY_5, OPACITY_80,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { CopyButton } from '../system/CircularGauge';
import {
  ACCENT, CONSOLE_COMMANDS, COMMAND_CATEGORIES, CATEGORY_COLORS,
  type CommandCategory,
} from '../_shared/data';

/** `<x>` is required, `[x]` optional (the catalog's own params notation). */
const needsArg = (params?: string) => !!params && params.includes('<');

interface Props {
  onExecute: (command: string) => void;
  onPopulate: (syntax: string) => void;
  isExecuting: boolean;
}

export function CommandCatalog({ onExecute, onPopulate, isExecuting }: Props) {
  const [cmdSearch, setCmdSearch] = useState('');
  const [cmdCategoryFilter, setCmdCategoryFilter] = useState<CommandCategory | 'All'>('All');

  const filteredCommands = useMemo(() => {
    return CONSOLE_COMMANDS.filter(cmd => {
      const matchesSearch = !cmdSearch
        || cmd.syntax.toLowerCase().includes(cmdSearch.toLowerCase())
        || cmd.description.toLowerCase().includes(cmdSearch.toLowerCase());
      const matchesCat = cmdCategoryFilter === 'All' || cmd.category === cmdCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [cmdSearch, cmdCategoryFilter]);

  return (
    <div className="mt-3">
      <SectionHeader label="COMMAND CATALOG" color={ACCENT} icon={Search} />
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: `${withOpacity(ACCENT, OPACITY_30)}` }} />
            <input type="text" placeholder="Search commands..." value={cmdSearch} onChange={(e) => setCmdSearch(e.target.value)}
              className="w-full text-xs font-mono bg-surface-deep border rounded pl-7 pr-2 py-1.5 text-text-primary placeholder:text-text-muted focus:outline-none uppercase tracking-[0.15em]"
              style={{ borderColor: `${withOpacity(ACCENT, OPACITY_12)}` }}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setCmdCategoryFilter('All')}
              className="text-xs font-mono uppercase tracking-[0.15em] px-2 py-1 rounded border transition-colors"
              style={{
                backgroundColor: cmdCategoryFilter === 'All' ? `${ACCENT}${OPACITY_20}` : 'transparent',
                color: cmdCategoryFilter === 'All' ? ACCENT : `${withOpacity(ACCENT, OPACITY_37)}`,
                borderColor: cmdCategoryFilter === 'All' ? `${ACCENT}${OPACITY_30}` : `${withOpacity(ACCENT, OPACITY_10)}`,
              }}>ALL</button>
            {COMMAND_CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setCmdCategoryFilter(cat)}
                className="text-xs font-mono uppercase tracking-[0.15em] px-2 py-1 rounded border transition-colors"
                style={{
                  backgroundColor: cmdCategoryFilter === cat ? `${CATEGORY_COLORS[cat]}${OPACITY_20}` : 'transparent',
                  color: cmdCategoryFilter === cat ? CATEGORY_COLORS[cat] : `${withOpacity(CATEGORY_COLORS[cat], OPACITY_37)}`,
                  borderColor: cmdCategoryFilter === cat ? `${CATEGORY_COLORS[cat]}${OPACITY_30}` : `${withOpacity(CATEGORY_COLORS[cat], OPACITY_12)}`,
                }}>{cat}</button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
          {filteredCommands.map((cmd) => (
            <div key={cmd.syntax}
              className="flex items-start gap-3 p-2 border rounded transition-colors group"
              style={{ borderColor: `${withOpacity(ACCENT, OPACITY_10)}`, backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
              <button type="button" onClick={() => onPopulate(cmd.syntax)} aria-label={`Fill console with ${cmd.syntax}`}
                className="focus-ring flex flex-1 min-w-0 items-start gap-3 text-left cursor-pointer rounded">
              <span className="text-xs font-mono uppercase tracking-[0.15em] px-1.5 py-[1px] rounded border flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${CATEGORY_COLORS[cmd.category]}${OPACITY_10}`, color: CATEGORY_COLORS[cmd.category], borderColor: `${CATEGORY_COLORS[cmd.category]}${OPACITY_30}` }}>
                {cmd.category}
              </span>
              <span className="block flex-1 min-w-0">
                <span className="block text-xs font-mono font-bold" style={{ color: `${withOpacity(ACCENT, OPACITY_80)}` }}>
                  &gt; {cmd.syntax}{cmd.params ? <span className="text-text-muted"> {cmd.params}</span> : null}
                </span>
                <span className="block text-xs font-mono text-text-muted uppercase mt-0.5">{cmd.description}</span>
              </span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // A required <param> cannot be guessed: fill the input, never send it bare.
                    if (needsArg(cmd.params)) onPopulate(`${cmd.syntax} `);
                    else onExecute(cmd.syntax);
                  }}
                  disabled={isExecuting}
                  title={needsArg(cmd.params) ? `Needs ${cmd.params}: fills the console input` : undefined}
                  className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em] px-2 py-1 rounded border transition-all focus-ring opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
                  style={{ backgroundColor: `${ACCENT_EMERALD}${OPACITY_10}`, color: ACCENT_EMERALD, borderColor: `${ACCENT_EMERALD}${OPACITY_30}` }}>
                  <Play className="w-3 h-3" /> {needsArg(cmd.params) ? 'FILL' : 'RUN'}
                </button>
                <CopyButton text={cmd.syntax} />
              </div>
            </div>
          ))}
          {filteredCommands.length === 0 && (
            <div className="text-xs font-mono text-text-muted text-center py-4 uppercase tracking-[0.15em]">NO COMMANDS MATCH FILTER</div>
          )}
        </div>
      </BlueprintPanel>
    </div>
  );
}
