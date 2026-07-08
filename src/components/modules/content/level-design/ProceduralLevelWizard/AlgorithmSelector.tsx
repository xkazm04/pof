'use client';

import { Zap } from 'lucide-react';
import { OVERLAY_WHITE } from '@/lib/chart-colors';
import { motion } from 'framer-motion';
import { ALGORITHMS } from './constants';
import type { GenAlgorithm } from './types';
import type { useRovingRadioGroup } from './useProceduralLevelWizard';

interface AlgorithmSelectorProps {
  algorithm: GenAlgorithm;
  setAlgorithm: (id: GenAlgorithm) => void;
  algNav: ReturnType<typeof useRovingRadioGroup>;
  algDef: (typeof ALGORITHMS)[number];
}

export function AlgorithmSelector({ algorithm, setAlgorithm, algNav, algDef }: AlgorithmSelectorProps) {
  return (
    <div className="space-y-3 relative z-10">
      <h4 className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-widest">
        <Zap className="w-3 h-3" /> Core Subroutine
      </h4>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Generation algorithm">
        {ALGORITHMS.map((alg, idx) => {
          const isActive = algorithm === alg.id;
          const Icon = alg.icon;
          return (
            <button
              key={alg.id}
              ref={(el) => { algNav.refs.current[idx] = el; }}
              role="radio"
              aria-checked={isActive}
              aria-label={`${alg.label}. ${alg.description}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setAlgorithm(alg.id)}
              onKeyDown={(e) => algNav.onKeyDown(e, idx)}
              className="focus-ring-outline relative flex items-start gap-4 p-4 rounded-xl text-left transition-all group overflow-hidden"
              style={{
                backgroundColor: isActive ? `${alg.color}15` : 'rgba(10,10,25,0.6)',
                border: `1px solid ${isActive ? `${alg.color}60` : 'rgba(139,92,246,0.15)'}`,
                boxShadow: isActive ? `0 0 20px ${alg.color}20, inset 0 0 20px ${alg.color}10` : 'none',
              }}
            >
              {/* Tech background element */}
              <div className="absolute right-0 top-0 w-32 h-32 opacity-[0.03] transition-transform duration-700 group-hover:scale-150 group-hover:rotate-12 pointer-events-none">
                <Icon className="w-full h-full" style={{ color: isActive ? alg.color : OVERLAY_WHITE }} />
              </div>

              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 relative z-10 transition-colors"
                style={{ backgroundColor: isActive ? `${alg.color}20` : 'rgba(139,92,246,0.1)' }}>
                <Icon className="w-5 h-5" style={{ color: isActive ? alg.color : 'rgba(139,92,246,0.6)' }} />
              </div>
              <div className="min-w-0 relative z-10">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider block mb-1 transition-colors"
                  style={{ color: isActive ? alg.color : 'rgba(200,200,240,0.6)' }}
                >
                  {alg.label}
                </span>
                <span className="text-[11px] text-violet-300/60 block leading-relaxed">{alg.description}</span>
              </div>
            </button>
          );
        })}
      </div>
      <motion.p
        key={algorithm}
        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
        className="text-xs px-3 py-2 rounded-lg bg-black/40 border border-violet-900/30 text-violet-300/80 font-mono"
      >
        <span className="text-violet-500 font-bold mr-2">Recommended For:</span>
        {algDef.bestFor.toUpperCase()}
      </motion.p>
    </div>
  );
}
