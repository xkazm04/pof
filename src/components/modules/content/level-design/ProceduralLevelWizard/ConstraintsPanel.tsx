'use client';

import { Castle } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { CONSTRAINTS } from './constants';
import type { GameplayConstraints } from './types';

interface ConstraintsPanelProps {
  constraints: GameplayConstraints;
  toggleConstraint: (key: keyof GameplayConstraints) => void;
}

export function ConstraintsPanel({ constraints, toggleConstraint }: ConstraintsPanelProps) {
  return (
    <div className="space-y-3 relative z-10">
      <h4 className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-widest border-b border-violet-900/30 pb-2">
        <Castle className="w-3 h-3" /> Environmental Logic
      </h4>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {CONSTRAINTS.map((c) => {
          const isActive = constraints[c.key];
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              aria-pressed={isActive}
              aria-label={`${c.label}. ${c.description}`}
              onClick={() => toggleConstraint(c.key)}
              className="focus-ring-outline flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border group relative overflow-hidden"
              style={{
                backgroundColor: isActive ? `${MODULE_COLORS.content}15` : 'rgba(0,0,0,0.4)',
                borderColor: isActive ? `${MODULE_COLORS.content}50` : 'rgba(139,92,246,0.15)',
              }}
            >
              {/* Active Glow */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/10 to-transparent animate-pulse pointer-events-none" />
              )}

              <div
                className="w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 relative z-10"
                style={{
                  borderColor: isActive ? MODULE_COLORS.content : 'rgba(139,92,246,0.3)',
                  backgroundColor: isActive ? MODULE_COLORS.content : 'transparent',
                  boxShadow: isActive ? `0 0 10px ${MODULE_COLORS.content}80` : 'none',
                }}
              >
                {isActive && <div className="w-1.5 h-1.5 bg-white rounded-sm shadow-sm" />}
              </div>
              <Icon
                className="w-4 h-4 flex-shrink-0 relative z-10 transition-colors"
                style={{ color: isActive ? MODULE_COLORS.content : 'rgba(139,92,246,0.5)' }}
              />
              <div className="min-w-0 relative z-10 flex-1">
                <span
                  className="text-xs font-bold uppercase tracking-wider block truncate"
                  style={{ color: isActive ? MODULE_COLORS.content : 'rgba(200,200,240,0.7)' }}
                >
                  {c.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
