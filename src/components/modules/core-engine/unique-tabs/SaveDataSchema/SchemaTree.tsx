'use client';

import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BlueprintPanel } from './design';
import { SCHEMA_GROUPS, TYPE_COLORS, ACCENT, type FieldType } from './data';

interface SchemaTreeProps {
  expandedGroups: Set<string>;
  toggleGroup: (id: string) => void;
}

export function SchemaTree({ expandedGroups, toggleGroup }: SchemaTreeProps) {
  const treeRef = useRef<HTMLDivElement>(null);

  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const tree = treeRef.current;
    if (!tree) return;
    const focusable = Array.from(tree.querySelectorAll<HTMLElement>('[role="treeitem"]'));
    const current = document.activeElement as HTMLElement;
    const idx = focusable.indexOf(current);
    if (idx === -1) return;

    let next: HTMLElement | undefined;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        next = focusable[idx + 1];
        break;
      case 'ArrowUp':
        e.preventDefault();
        next = focusable[idx - 1];
        break;
      case 'ArrowRight': {
        e.preventDefault();
        const groupId = current.dataset.groupId;
        if (groupId && !expandedGroups.has(groupId)) {
          toggleGroup(groupId);
        } else {
          next = focusable[idx + 1];
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const groupId = current.dataset.groupId;
        if (groupId && expandedGroups.has(groupId)) {
          toggleGroup(groupId);
        } else if (!groupId) {
          for (let i = idx - 1; i >= 0; i--) {
            if (focusable[i].dataset.groupId) { next = focusable[i]; break; }
          }
        }
        break;
      }
      case 'Home':
        e.preventDefault();
        next = focusable[0];
        break;
      case 'End':
        e.preventDefault();
        next = focusable[focusable.length - 1];
        break;
      default:
        return;
    }
    next?.focus();
  }, [expandedGroups, toggleGroup]);

  return (
    <BlueprintPanel color={ACCENT} className="p-0 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">DATA_STRUCTURE.h</span>
        <span className="flex gap-1.5 items-center">
          <span className="w-2 h-2 rounded-full bg-red-500/50" />
          <span className="w-2 h-2 rounded-full bg-amber-500/50" />
          <span className="w-2 h-2 rounded-full bg-green-500/50" />
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-1.5 border-b border-border/10 text-xs font-mono" style={{ backgroundColor: `${ACCENT}06` }}>
        {(Object.entries(TYPE_COLORS) as [FieldType, string][]).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span style={{ color }} className="uppercase">{type}</span>
          </span>
        ))}
      </div>

      <div className="p-4 space-y-1 font-mono text-xs leading-relaxed overflow-y-auto custom-scrollbar relative">
        <div className="absolute left-0 top-0 bottom-0 w-8 border-r border-border/10 z-0 select-none flex flex-col pt-4 items-center text-xs font-mono" style={{ backgroundColor: `${ACCENT}06`, color: `${ACCENT}25` }}>
          {[...Array(20)].map((_, i) => <div key={i} className="h-6 flex items-center">{i + 1}</div>)}
        </div>

        <div className="relative z-10 pl-6" style={{ color: `${ACCENT}cc` }} ref={treeRef} role="tree" aria-label="Save data schema tree" onKeyDown={handleTreeKeyDown}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
            <span className="text-purple-400">struct</span> <span className="text-emerald-400">USaveDataSchema</span> {'{'}
          </motion.div>

          <div className="pl-4 mt-1 border-l border-border/10">
            {SCHEMA_GROUPS.map((group, gi) => {
              const isOpen = expandedGroups.has(group.id);
              return (
                <motion.div key={group.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * gi }} className="mb-1">
                  <button
                    role="treeitem" aria-expanded={isOpen} aria-label={`${group.label} group, ${group.fields.length} fields`}
                    data-group-id={group.id} tabIndex={gi === 0 ? 0 : -1}
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center gap-2 hover:bg-white/5 px-2 py-0.5 rounded transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
                  >
                    <span className="text-text-muted">{isOpen ? '\u25BC' : '\u25B6'}</span>
                    <span style={{ color: group.color, textShadow: `0 0 5px ${group.color}40` }}>{group.label}</span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div role="group" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-6">
                        {group.fields.map((field) => (
                          <div key={field.name} role="treeitem" tabIndex={-1} aria-label={`${field.name}, type ${field.type}`}
                            className="flex gap-4 py-0.5 hover:bg-white/5 pr-2 group transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded">
                            <span className="w-[80px] shrink-0 font-medium" style={{ color: TYPE_COLORS[field.type] }}>{field.type}</span>
                            <span className="text-cyan-100">{field.name};</span>
                            <span className="text-text-muted ml-auto hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">// {field.details}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-1" style={{ color: `${ACCENT}cc` }}>{'};'}</div>
        </div>
        <div className="pl-6 mt-2.5" style={{ color: `${ACCENT}40` }}>&gt; EOF</div>
      </div>
    </BlueprintPanel>
  );
}
