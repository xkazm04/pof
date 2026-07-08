'use client';

import { RefObject } from 'react';
import { GripHorizontal } from 'lucide-react';
import type { Milestone } from '@/types/project-health';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_INFO,
  OVERLAY_WHITE, OVERLAY_BLACK, OPACITY_5,
} from '@/lib/chart-colors';
import {
  WEEK_PX, ROW_HEIGHT, HEADER_HEIGHT, LEFT_GUTTER,
  BAR_HEIGHT, BAR_Y_OFFSET, TODAY_COLOR,
} from './constants';
import { formatWeekLabel } from './helpers';
import type { DeadlineMap } from './types';

interface GanttTimelineProps {
  svgRef: RefObject<SVGSVGElement | null>;
  svgWidth: number;
  svgHeight: number;
  weeks: Date[];
  monthHeaders: { label: string; x: number; width: number }[];
  milestones: Milestone[];
  deadlines: DeadlineMap;
  todayX: number;
  dateToX: (dateStr: string) => number;
  getVariance: (ms: Milestone) => number | null;
  handleDragStart: (e: React.MouseEvent, milestoneId: string) => void;
}

export function GanttTimeline({
  svgRef,
  svgWidth,
  svgHeight,
  weeks,
  monthHeaders,
  milestones,
  deadlines,
  todayX,
  dateToX,
  getVariance,
  handleDragStart,
}: GanttTimelineProps) {
  return (
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
              fill={i % 2 === 0 ? 'transparent' : `${OVERLAY_WHITE}${OPACITY_5}`}
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
            fill={i % 2 === 0 ? 'transparent' : `${OVERLAY_WHITE}${OPACITY_5}`}
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
              data-testid={`deadline-marker-${ms.id}`}
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
          fill={OVERLAY_BLACK}
          fontSize={8}
          fontWeight={700}
        >
          TODAY
        </text>
      </svg>
    </div>
  );
}
