'use client';

import { Check, Play, Loader2 } from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import type { ChecklistItem } from '@/types/modules';

const EMPTY_PROGRESS: Record<string, boolean> = {};

interface RoadmapChecklistProps {
  items: ChecklistItem[];
  subModuleId: string;
  onRunPrompt: (itemId: string, prompt: string) => void;
  accentColor: string;
  isRunning: boolean;
  /** The checklist item currently being executed by CLI */
  activeItemId?: string | null;
  /** The item that was just auto-completed (for visual flash) */
  lastCompletedItemId?: string | null;
}

export function RoadmapChecklist({
  items, subModuleId, onRunPrompt, accentColor, isRunning,
  activeItemId, lastCompletedItemId,
}: RoadmapChecklistProps) {
  const progress = useModuleStore((s) => s.checklistProgress[subModuleId] ?? EMPTY_PROGRESS);
  const toggleItem = useModuleStore((s) => s.toggleChecklistItem);

  const completedCount = items.filter((item) => progress[item.id]).length;
  const progressPercent = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#6b7294]">Progress</span>
          <span className="text-[#e0e4f0] font-medium">{completedCount} / {items.length}</span>
        </div>
        <div className="h-1.5 bg-[#1e1e3a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {items.map((item, index) => {
          const checked = !!progress[item.id];
          const isActive = activeItemId === item.id;
          const justCompleted = lastCompletedItemId === item.id;
          return (
            <div
              key={item.id}
              className={`group p-3 rounded-lg border transition-all duration-300 ${
                justCompleted
                  ? 'bg-green-900/20 border-green-500/40'
                  : checked
                    ? 'bg-[#0d1a0d] border-[#1a3a1a]'
                    : isActive
                      ? 'bg-[#111130] border-[#2e2e6a]'
                      : 'bg-[#111128] border-[#1e1e3a] hover:border-[#2e2e5a]'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => toggleItem(subModuleId, item.id)}
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    checked
                      ? 'border-green-500 bg-green-500/20'
                      : 'border-[#3e3e6a] hover:border-[#5e5e8a]'
                  }`}
                >
                  {checked && <Check className="w-3 h-3 text-green-400" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#6b7294] font-mono">{index + 1}.</span>
                    <span className={`text-xs font-medium ${checked ? 'text-[#6b7294] line-through' : 'text-[#e0e4f0]'}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-[#00ff88]/10 text-[#00ff88]">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        running
                      </span>
                    )}
                    {justCompleted && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 animate-pulse">
                        done
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] mt-1 leading-relaxed ${checked ? 'text-[#4a4e6a]' : 'text-[#6b7294]'}`}>
                    {item.description}
                  </p>
                </div>

                {/* Do it with Claude button */}
                {!checked && !isActive && (
                  <button
                    onClick={() => onRunPrompt(item.id, item.prompt)}
                    disabled={isRunning}
                    className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    style={{
                      backgroundColor: `${accentColor}15`,
                      color: accentColor,
                      border: `1px solid ${accentColor}30`,
                    }}
                  >
                    <Play className="w-3 h-3" />
                    Claude
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
