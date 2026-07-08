'use client';

import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { MOTION } from '@/lib/constants';

export function DimensionBar({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
      <span className="text-xs text-text-muted w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: MOTION.slow, ease: MOTION.ease }}
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold w-7 text-right" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
