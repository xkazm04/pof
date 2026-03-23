'use client';

import { motion } from 'framer-motion';
import { WIDGET_Z_COLOR } from './data';
import type { WidgetRectProps } from './data';
import { STATUS_SUBDUED } from '@/lib/chart-colors';

export function WidgetRect({ placement, visible, changed, showZLayer, contextColor }: WidgetRectProps) {
  const zColor = WIDGET_Z_COLOR[placement.id] ?? STATUS_SUBDUED;
  const borderColor = showZLayer ? zColor : contextColor;

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        opacity: visible ? 1 : 0.12,
        scale: visible ? 1 : 0.97,
      }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="absolute rounded-sm border overflow-hidden"
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${placement.w}%`,
        height: `${placement.h}%`,
        borderColor: visible ? `${borderColor}80` : `${borderColor}25`,
        backgroundColor: visible ? `${borderColor}18` : `${borderColor}06`,
        zIndex: placement.zDepth,
      }}
    >
      {/* Z-depth stripe */}
      {showZLayer && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5"
          style={{ backgroundColor: `${zColor}90` }}
        />
      )}

      {/* Label */}
      <div className="flex items-center justify-between h-full px-1">
        <span
          className="text-[9px] font-mono font-bold leading-none truncate select-none"
          style={{
            color: visible ? borderColor : `${borderColor}60`,
            filter: visible ? `drop-shadow(0 0 3px ${borderColor}60)` : 'none',
          }}
        >
          {placement.label}
        </span>
        {showZLayer && (
          <span
            className="text-[8px] font-mono opacity-60 flex-shrink-0 ml-0.5"
            style={{ color: zColor }}
          >
            Z{placement.zDepth}
          </span>
        )}
      </div>

      {/* Changed-widget pulse ring */}
      {changed && visible && (
        <motion.div
          className="absolute inset-0 rounded-sm border-2 pointer-events-none"
          style={{ borderColor: `${contextColor}` }}
          initial={{ opacity: 0.8 }}
          animate={{ opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.div>
  );
}
