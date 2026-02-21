'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  CalendarDays, Target, AlertTriangle, ChevronLeft, ChevronRight,
  GripHorizontal, X, Check,
} from 'lucide-react';
import { useProjectHealthStore } from '@/stores/projectHealthStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import type { Milestone } from '@/types/project-health';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_INFO } from '@/lib/chart-colors';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const WEEK_PX = 56;          // Pixels per week column
const ROW_HEIGHT = 52;       // Height per milestone bar row
const HEADER_HEIGHT = 48;    // Month/week header
const LEFT_GUTTER = 200;     // Label column width
const BAR_HEIGHT = 28;       // Gantt bar height
const BAR_Y_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const TODAY_COLOR = MODULE_COLORS.setup;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay()); // Sunday
  return copy;
}

function addWeeks(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n * 7);
  return copy;
}

function weeksBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (7 * 24 * 60 * 60 * 1000);
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateInput(d: Date): string {
  return d.toISOString().split('T')[0];
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DeadlineMap {
  [milestoneId: string]: { targetDate: string; label: string };
}

interface DragState {
  milestoneId: string;
  startX: number;
  originalDate: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CalendarRoadmapView() {
  const milestones = useProjectHealthStore((s) => s.milestones);
  const summary = useProjectHealthStore((s) => s.summary);
  const fetchHealth = useProjectHealthStore((s) => s.fetchHealth);
  const checklistProgress = useModuleStore((s) => s.checklistProgress);
  const scanHistory = useEvaluatorStore((s) => s.scanHistory);
  const lastScan = useEvaluatorStore((s) => s.lastScan);

  const [deadlines, setDeadlines] = useState<DeadlineMap>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);
  const dragRef = useRef<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch project health on mount
  useEffect(() => {
    if (!summary) {
      fetchHealth(checklistProgress, scanHistory, lastScan);
    }
  }, [summary, fetchHealth, checklistProgress, scanHistory, lastScan]);

  // Fetch deadlines from API
  useEffect(() => {
    fetch('/api/milestone-deadlines')
      .then((r) => r.json())
      .then((j) => { if (j.success) setDeadlines(j.data); })
      .catch(() => {});
  }, []);

  // Save a deadline
  const saveDeadline = useCallback(async (milestoneId: string, targetDate: string | null) => {
    setDeadlines((prev) => {
      if (!targetDate) {
        const next = { ...prev };
        delete next[milestoneId];
        return next;
      }
      return { ...prev, [milestoneId]: { targetDate, label: '' } };
    });
    await fetch('/api/milestone-deadlines', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneId, targetDate }),
    }).catch(() => {});
  }, []);

  // Timeline range computation
  const { timelineStart, totalWeeks, weeks } = useMemo(() => {
    const now = new Date();
    const start = addWeeks(startOfWeek(now), scrollOffset - 4); // 4 weeks before "now"

    // Find the furthest date needed
    let maxDate = addWeeks(now, 20);
    for (const ms of milestones) {
      if (ms.predictedDate) {
        const d = new Date(ms.predictedDate);
        if (d > maxDate) maxDate = d;
      }
    }
    for (const dl of Object.values(deadlines)) {
      const d = new Date(dl.targetDate);
      if (d > maxDate) maxDate = d;
    }

    const total = Math.max(24, Math.ceil(weeksBetween(start, maxDate)) + 6);
    const wks: Date[] = [];
    for (let i = 0; i < total; i++) wks.push(addWeeks(start, i));

    return { timelineStart: start, totalWeeks: total, weeks: wks };
  }, [milestones, deadlines, scrollOffset]);

  const svgWidth = LEFT_GUTTER + totalWeeks * WEEK_PX;
  const svgHeight = HEADER_HEIGHT + milestones.length * ROW_HEIGHT + 16;

  // Position helpers
  const dateToX = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    const wks = weeksBetween(timelineStart, d);
    return LEFT_GUTTER + wks * WEEK_PX;
  }, [timelineStart]);

  const xToDate = useCallback((x: number) => {
    const wks = (x - LEFT_GUTTER) / WEEK_PX;
    return addWeeks(timelineStart, wks);
  }, [timelineStart]);

  // Today X position
  const todayX = dateToX(new Date().toISOString());

  // Month boundaries for header
  const monthHeaders = useMemo(() => {
    const months: { label: string; x: number; width: number }[] = [];
    let currentMonth = -1;
    let start = 0;

    weeks.forEach((w, i) => {
      const m = w.getMonth();
      if (m !== currentMonth) {
        if (months.length > 0) {
          months[months.length - 1].width = LEFT_GUTTER + i * WEEK_PX - months[months.length - 1].x;
        }
        currentMonth = m;
        start = LEFT_GUTTER + i * WEEK_PX;
        months.push({ label: formatMonth(w), x: start, width: 0 });
      }
    });
    if (months.length > 0) {
      months[months.length - 1].width = svgWidth - months[months.length - 1].x;
    }
    return months;
  }, [weeks, svgWidth]);

  // Drag handlers for deadline markers
  const handleDragStart = useCallback((e: React.MouseEvent, milestoneId: string) => {
    e.preventDefault();
    const dl = deadlines[milestoneId];
    if (!dl) return;
    dragRef.current = { milestoneId, startX: e.clientX, originalDate: dl.targetDate };

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = me.clientX - rect.left + svgRef.current.parentElement!.scrollLeft;
      const newDate = xToDate(svgX);
      setDeadlines((prev) => ({
        ...prev,
        [dragRef.current!.milestoneId]: {
          ...prev[dragRef.current!.milestoneId],
          targetDate: newDate.toISOString(),
        },
      }));
    };

    const onUp = () => {
      if (dragRef.current) {
        const dl2 = deadlines[dragRef.current.milestoneId];
        if (dl2) saveDeadline(dragRef.current.milestoneId, dl2.targetDate);
        dragRef.current = null;
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [deadlines, xToDate, saveDeadline]);

  // Compute variance for each milestone
  const getVariance = useCallback((ms: Milestone) => {
    const dl = deadlines[ms.id];
    if (!dl || !ms.predictedDate) return null;
    const predicted = new Date(ms.predictedDate);
    const target = new Date(dl.targetDate);
    const diffDays = Math.round((target.getTime() - predicted.getTime()) / (86400000));
    return diffDays;
  }, [deadlines]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-[#60a5fa]" />
          <h2 className="text-base font-semibold text-text">Calendar Roadmap</h2>
          {summary && (
            <span className="text-xs text-text-muted">
              {summary.overallCompletion}% complete
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScrollOffset((p) => p - 4)}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScrollOffset(0)}
            className="px-2 py-1 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setScrollOffset((p) => p + 4)}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-8 h-2 rounded-full bg-gradient-to-r from-[#34d399]/60 to-[#34d399]" />
          Predicted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2 border-dashed border-amber-400" />
          Target Deadline
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-3 rounded-full" style={{ backgroundColor: TODAY_COLOR }} />
          Today
        </span>
      </div>

      {/* Milestone cards — set deadlines */}
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

              <div className="flex items-center justify-between text-[10px]">
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
                      if (editDate) saveDeadline(ms.id, new Date(editDate + 'T00:00:00').toISOString());
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
                    className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text transition-colors"
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
                <div className={`flex items-center gap-1 text-[10px] ${
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

      {/* SVG Gantt Timeline */}
      <div
        className="rounded-lg border border-border bg-surface/30 overflow-x-auto"
        style={{ maxHeight: svgHeight + 20 }}
      >
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          className="select-none"
        >
          {/* Background grid */}
          {weeks.map((w, i) => {
            const x = LEFT_GUTTER + i * WEEK_PX;
            const isWeekend = false; // simplified
            return (
              <g key={i}>
                <line
                  x1={x} y1={HEADER_HEIGHT} x2={x} y2={svgHeight}
                  stroke="var(--color-border, #2a2a2e)"
                  strokeWidth={0.5}
                  opacity={0.5}
                />
                {/* Week label */}
                <text
                  x={x + WEEK_PX / 2}
                  y={HEADER_HEIGHT - 4}
                  textAnchor="middle"
                  fill="var(--color-text-muted, #888)"
                  fontSize={9}
                  opacity={isWeekend ? 0.4 : 0.7}
                >
                  {formatWeekLabel(w)}
                </text>
              </g>
            );
          })}

          {/* Month header bands */}
          {monthHeaders.map((m, i) => (
            <g key={`month-${i}`}>
              <rect
                x={m.x} y={0} width={m.width} height={20}
                fill={i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)'}
              />
              <text
                x={m.x + 8} y={14}
                fill="var(--color-text-muted, #888)"
                fontSize={10}
                fontWeight={600}
              >
                {m.label}
              </text>
            </g>
          ))}

          {/* Row backgrounds */}
          {milestones.map((_, i) => (
            <rect
              key={`row-${i}`}
              x={0}
              y={HEADER_HEIGHT + i * ROW_HEIGHT}
              width={svgWidth}
              height={ROW_HEIGHT}
              fill={i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
            />
          ))}

          {/* Row labels (left gutter) */}
          {milestones.map((ms, i) => {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            return (
              <g key={`label-${ms.id}`}>
                <circle cx={16} cy={y} r={4} fill={ms.color} />
                <text
                  x={28} y={y + 1}
                  dominantBaseline="middle"
                  fill="var(--color-text, #eee)"
                  fontSize={11}
                  fontWeight={500}
                >
                  {ms.name}
                </text>
                <text
                  x={LEFT_GUTTER - 8} y={y + 1}
                  dominantBaseline="middle"
                  textAnchor="end"
                  fill="var(--color-text-muted, #888)"
                  fontSize={10}
                >
                  {ms.currentProgress}%
                </text>
              </g>
            );
          })}

          {/* Predicted bars (progress filled portion + remaining portion) */}
          {milestones.map((ms, i) => {
            if (!ms.predictedDate) return null;
            const y = HEADER_HEIGHT + i * ROW_HEIGHT + BAR_Y_OFFSET;
            const nowX = todayX;
            const endX = dateToX(ms.predictedDate);

            // Bar starts at the earlier of today or LEFT_GUTTER
            const barStart = Math.max(LEFT_GUTTER, nowX - (nowX - LEFT_GUTTER) * (ms.currentProgress / 100));
            const filledEnd = barStart + (endX - barStart) * (ms.currentProgress / 100);

            return (
              <g key={`bar-${ms.id}`}>
                {/* Full predicted range (dim) */}
                <rect
                  x={Math.max(LEFT_GUTTER, barStart)}
                  y={y}
                  width={Math.max(0, endX - Math.max(LEFT_GUTTER, barStart))}
                  height={BAR_HEIGHT}
                  rx={6}
                  fill={ms.color}
                  opacity={0.15}
                />
                {/* Completed portion (bright) */}
                <rect
                  x={Math.max(LEFT_GUTTER, barStart)}
                  y={y}
                  width={Math.max(0, filledEnd - Math.max(LEFT_GUTTER, barStart))}
                  height={BAR_HEIGHT}
                  rx={6}
                  fill={ms.color}
                  opacity={0.5}
                />
                {/* End date label */}
                <text
                  x={endX + 6} y={y + BAR_HEIGHT / 2 + 1}
                  dominantBaseline="middle"
                  fill={ms.color}
                  fontSize={9}
                  opacity={0.8}
                >
                  {new Date(ms.predictedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </text>
              </g>
            );
          })}

          {/* Deadline markers (draggable diamonds) */}
          {milestones.map((ms, i) => {
            const dl = deadlines[ms.id];
            if (!dl) return null;
            const y = HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            const x = dateToX(dl.targetDate);
            const variance = getVariance(ms);
            const isOverdue = variance !== null && variance < 0;

            return (
              <g
                key={`deadline-${ms.id}`}
                style={{ cursor: 'ew-resize' }}
                onMouseDown={(e) => handleDragStart(e, ms.id)}
              >
                {/* Dashed line from deadline to bar */}
                <line
                  x1={x} y1={HEADER_HEIGHT + i * ROW_HEIGHT + 2}
                  x2={x} y2={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT - 2}
                  stroke={isOverdue ? MODULE_COLORS.content : STATUS_INFO}
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  opacity={0.7}
                />
                {/* Diamond marker */}
                <polygon
                  points={`${x},${y - 7} ${x + 7},${y} ${x},${y + 7} ${x - 7},${y}`}
                  fill={isOverdue ? MODULE_COLORS.content : STATUS_INFO}
                  stroke={isOverdue ? MODULE_COLORS.content : STATUS_INFO}
                  strokeWidth={1}
                  opacity={0.9}
                />
                {/* Grip icon area */}
                <GripHorizontal
                  x={x - 5} y={y - 5}
                  width={10} height={10}
                  className="text-white"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Variance label */}
                {variance !== null && (
                  <text
                    x={x} y={HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT - 4}
                    textAnchor="middle"
                    fill={isOverdue ? MODULE_COLORS.content : STATUS_SUCCESS}
                    fontSize={9}
                    fontWeight={500}
                  >
                    {variance >= 0 ? `+${variance}d` : `${variance}d`}
                  </text>
                )}
              </g>
            );
          })}

          {/* Today marker */}
          <line
            x1={todayX} y1={0} x2={todayX} y2={svgHeight}
            stroke={TODAY_COLOR}
            strokeWidth={1.5}
            opacity={0.6}
          />
          <rect
            x={todayX - 16} y={0} width={32} height={14} rx={3}
            fill={TODAY_COLOR}
            opacity={0.9}
          />
          <text
            x={todayX} y={10}
            textAnchor="middle"
            fill="#000"
            fontSize={8}
            fontWeight={700}
          >
            TODAY
          </text>
        </svg>
      </div>
    </div>
  );
}
