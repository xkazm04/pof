'use client';

import { useCalendarRoadmapView } from './useCalendarRoadmapView';
import { RoadmapHeader } from './RoadmapHeader';
import { RoadmapLegend } from './RoadmapLegend';
import { MilestoneCards } from './MilestoneCards';
import { GanttTimeline } from './GanttTimeline';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CalendarRoadmapView() {
  const {
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
  } = useCalendarRoadmapView();

  return (
    <div className="space-y-4">
      {/* Header */}
      <RoadmapHeader summary={summary} setScrollOffset={setScrollOffset} />

      {/* Legend */}
      <RoadmapLegend />

      {/* Milestone cards — set deadlines */}
      <MilestoneCards
        milestones={milestones}
        deadlines={deadlines}
        getVariance={getVariance}
        editingId={editingId}
        setEditingId={setEditingId}
        editDate={editDate}
        setEditDate={setEditDate}
        saveDeadline={saveDeadline}
      />

      {/* SVG Gantt Timeline */}
      <GanttTimeline
        svgRef={svgRef}
        svgWidth={svgWidth}
        svgHeight={svgHeight}
        weeks={weeks}
        monthHeaders={monthHeaders}
        milestones={milestones}
        deadlines={deadlines}
        todayX={todayX}
        dateToX={dateToX}
        getVariance={getVariance}
        handleDragStart={handleDragStart}
      />
    </div>
  );
}
