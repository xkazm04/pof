'use client';

import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import {
  STATUS_WARNING, OPACITY_5, OPACITY_8, OPACITY_15, OPACITY_25, GLOW_MD, withOpacity,
} from '@/lib/chart-colors';
import { MOTION_CONFIG } from '@/lib/motion';
import type { InspectorRow } from '@/lib/character/inspector-fields';

interface Props {
  prop: InspectorRow;
  index: number;
  isHighlighted: boolean;
  catColor: string;
  onChange: (name: string, value: number) => void;
}

/**
 * One property row inside a PropertyColumn: name + slider + value + modified badge.
 * Slider bounds are the FEEL_FIELD_META range `resolveStack` clamps to; rows
 * FeelProfile does not model are read-only and badged "Not applied".
 */
export function PropertyRow({ prop, index, isHighlighted, catColor, onChange }: Props) {
  const isNumeric = typeof prop.current === 'number' && typeof prop.defaultVal === 'number';
  const hasSlider = isNumeric && prop.editable && prop.min !== undefined && prop.max !== undefined;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * MOTION_CONFIG.stagger, ...MOTION_CONFIG.standard }}
      className="flex items-center gap-3 px-2.5 py-1.5 rounded-md text-xs font-mono transition-all group"
      style={{
        backgroundColor: isHighlighted ? withOpacity(STATUS_WARNING, OPACITY_5) : 'transparent',
        boxShadow: isHighlighted
          ? `0 0 12px ${withOpacity(STATUS_WARNING, OPACITY_8)}, inset 0 0 12px ${withOpacity(STATUS_WARNING, OPACITY_5)}`
          : 'none',
      }}
    >
      <span className="text-text-muted w-28 truncate flex-shrink-0 group-hover:text-text transition-colors">
        {prop.name}
      </span>

      {hasSlider ? (
        <div className="w-20 flex-shrink-0">
          <input
            type="range"
            aria-label={prop.name}
            min={prop.min}
            max={prop.max}
            step={prop.step ?? 1}
            value={Number(prop.current)}
            onChange={(e) => onChange(prop.name, Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: isHighlighted ? STATUS_WARNING : catColor }}
          />
        </div>
      ) : (
        <div className="w-20 flex-shrink-0" />
      )}

      <span
        className="font-bold min-w-[48px] tabular-nums"
        style={{
          color: prop.isModified ? STATUS_WARNING : 'var(--text-muted)',
          textShadow: isHighlighted ? `${GLOW_MD} ${withOpacity(STATUS_WARNING, OPACITY_25)}` : 'none',
        }}
      >
        {typeof prop.current === 'number' ? prop.current.toFixed(prop.current % 1 ? 2 : 0) : String(prop.current)}
      </span>

      {!prop.applies ? (
        <span
          className="ml-auto text-xs font-bold text-text-muted opacity-50 uppercase tracking-wider"
          title="Not modelled by the feel profile: never applied to UE"
        >
          Not applied
        </span>
      ) : prop.isModified ? (
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-text-muted opacity-40 flex items-center gap-1">
            <RotateCcw className="w-2.5 h-2.5" />
            <span className="line-through">{String(prop.defaultVal)}</span>
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: `${withOpacity(STATUS_WARNING, OPACITY_8)}`,
              color: STATUS_WARNING,
              border: `1px solid ${withOpacity(STATUS_WARNING, OPACITY_15)}`,
            }}
          >
            Mod
          </span>
        </div>
      ) : (
        <span className="ml-auto text-[9px] font-bold text-text-muted opacity-30 uppercase tracking-wider">
          Default
        </span>
      )}
    </motion.div>
  );
}
