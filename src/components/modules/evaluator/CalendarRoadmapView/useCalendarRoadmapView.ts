'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useProjectHealthStore } from '@/stores/projectHealthStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import type { Milestone } from '@/types/project-health';
import { toLocalNoon } from '@/lib/roadmap-dates';
import {
  WEEK_PX, ROW_HEIGHT, HEADER_HEIGHT, LEFT_GUTTER,
} from './constants';
import { startOfWeek, addWeeks, weeksBetween, formatMonth } from './helpers';
import type { DeadlineMap, DragState } from './types';

export function useCalendarRoadmapView() {
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
  const dragAbortRef = useRef<AbortController | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Tear down any in-flight drag listeners if we unmount mid-drag, so they
  // can't fire setState on an unmounted component or leak on window.
  useEffect(() => () => dragAbortRef.current?.abort(), []);

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

  // Drag handlers for deadline markers. Listeners are scoped to a per-drag
  // AbortController so they tear down reliably — on mouseup, when a new drag
  // starts, and (via the unmount effect above) if the component goes away
  // mid-drag rather than leaking on window.
  const handleDragStart = useCallback((e: React.MouseEvent, milestoneId: string) => {
    e.preventDefault();
    const dl = deadlines[milestoneId];
    if (!dl) return;

    dragAbortRef.current?.abort(); // tear down any drag still in flight
    const controller = new AbortController();
    dragAbortRef.current = controller;
    dragRef.current = {
      milestoneId,
      startX: e.clientX,
      originalDate: dl.targetDate,
      currentDate: dl.targetDate,
    };

    const onMove = (me: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = me.clientX - rect.left + svgRef.current.parentElement!.scrollLeft;
      const newDate = toLocalNoon(xToDate(svgX)).toISOString();
      drag.currentDate = newDate;
      setDeadlines((prev) => ({
        ...prev,
        [drag.milestoneId]: { ...prev[drag.milestoneId], targetDate: newDate },
      }));
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (drag) {
        // Persist the dragged-to date, not the stale value captured at start.
        saveDeadline(drag.milestoneId, drag.currentDate);
        dragRef.current = null;
      }
      controller.abort(); // removes both listeners via the shared signal
      dragAbortRef.current = null;
    };

    window.addEventListener('mousemove', onMove, { signal: controller.signal });
    window.addEventListener('mouseup', onUp, { signal: controller.signal });
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

  return {
    milestones,
    summary,
    deadlines,
    editingId,
    setEditingId,
    editDate,
    setEditDate,
    setScrollOffset,
    svgRef,
    svgWidth,
    svgHeight,
    weeks,
    dateToX,
    todayX,
    monthHeaders,
    saveDeadline,
    handleDragStart,
    getVariance,
  };
}
