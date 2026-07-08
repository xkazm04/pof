'use client';

import { Dispatch, SetStateAction } from 'react';
import { Target, AlertTriangle, X, Check } from 'lucide-react';
import type { Milestone } from '@/types/project-health';
import { parseDateInput, formatDateInput } from '@/lib/roadmap-dates';
import type { DeadlineMap } from './types';

interface MilestoneCardsProps {
  milestones: Milestone[];
  deadlines: DeadlineMap;
  getVariance: (ms: Milestone) => number | null;
  editingId: string | null;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  editDate: string;
  setEditDate: Dispatch<SetStateAction<string>>;
  saveDeadline: (milestoneId: string, targetDate: string | null) => Promise<void>;
}

export function MilestoneCards({
  milestones,
  deadlines,
  getVariance,
  editingId,
  setEditingId,
  editDate,
  setEditDate,
  saveDeadline,
}: MilestoneCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {milestones.map((ms) => {
        const dl = deadlines[ms.id];
        const variance = getVariance(ms);
        const isEditing = editingId === ms.id;

        return (
          <div
            key={ms.id}
            className="rounded-lg border border-border bg-surface/50 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: ms.color }}
              />
              <span className="text-xs font-medium text-text truncate">{ms.name}</span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${ms.currentProgress}%`,
                  backgroundColor: ms.color,
                  opacity: 0.8,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">
                {ms.predictedDate
                  ? `Predicted: ${new Date(ms.predictedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}`
                  : 'No velocity data'}
              </span>
              <span className="text-text-muted">{ms.currentProgress}%</span>
            </div>

            {/* Deadline */}
            {isEditing ? (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="flex-1 px-2 py-1 rounded text-xs bg-surface border border-border text-text"
                />
                <button
                  onClick={() => {
                    if (editDate) saveDeadline(ms.id, parseDateInput(editDate).toISOString());
                    setEditingId(null);
                  }}
                  className="p-1 text-green-400 hover:bg-surface-hover rounded"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1 text-text-muted hover:bg-surface-hover rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setEditingId(ms.id);
                    setEditDate(dl ? formatDateInput(new Date(dl.targetDate)) : ms.predictedDate ? formatDateInput(new Date(ms.predictedDate)) : formatDateInput(new Date()));
                  }}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors"
                >
                  <Target className="w-3 h-3" />
                  {dl
                    ? new Date(dl.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                    : 'Set deadline'}
                </button>
                {dl && (
                  <button
                    onClick={() => saveDeadline(ms.id, null)}
                    className="p-0.5 text-text-muted hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Variance chip */}
            {variance !== null && (
              <div className={`flex items-center gap-1 text-xs ${
                variance >= 0 ? 'text-green-400' : 'text-amber-400'
              }`}>
                {variance < 0 && <AlertTriangle className="w-3 h-3" />}
                {variance >= 0
                  ? `${Math.abs(variance)}d buffer`
                  : `${Math.abs(variance)}d overdue`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
