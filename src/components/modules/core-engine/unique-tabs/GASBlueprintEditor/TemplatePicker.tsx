'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { LayoutTemplate, X, Check } from 'lucide-react';
import { STATUS_ERROR } from '@/lib/chart-colors';
import type { GASTemplate } from './templates';
import { ACCENT } from './data';

export function TemplatePicker({
  templates, activeTemplateName, onSelect, onClose,
}: {
  templates: GASTemplate[];
  activeTemplateName: string | null;
  onSelect: (tpl: GASTemplate) => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.2 }}
          className="w-full max-w-3xl max-h-[80vh] overflow-y-auto custom-scrollbar rounded-xl border border-border/40 bg-surface shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border/40 bg-surface/95 backdrop-blur-sm">
            <div>
              <div className="text-sm font-bold text-text flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4" style={{ color: ACCENT }} />
                Archetype Templates
              </div>
              <div className="text-2xs text-text-muted mt-0.5">
                Pre-built GAS configurations for common ARPG ability archetypes
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-deep transition-colors text-text-muted hover:text-text">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            {templates.map((tpl, i) => {
              const isActive = activeTemplateName === tpl.name;
              return (
                <motion.button key={tpl.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }} onClick={() => onSelect(tpl)}
                  className="relative text-left p-3.5 rounded-lg border transition-all group overflow-hidden"
                  style={{ borderColor: isActive ? tpl.color : `${tpl.color}25`, backgroundColor: isActive ? `${tpl.color}10` : 'transparent' }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 50% 0%, ${tpl.color}12 0%, transparent 70%)` }} />
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: tpl.color }}>
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-lg">{tpl.icon}</span>
                      <span className="text-sm font-bold" style={{ color: tpl.color }}>{tpl.name}</span>
                    </div>
                    <p className="text-2xs text-text-muted leading-relaxed mb-2.5 line-clamp-2">{tpl.description}</p>
                    <div className="flex items-center gap-3 text-xs font-mono text-text-muted">
                      <span>{tpl.attributes.length} attrs</span>
                      <span>{tpl.effects.length} effects</span>
                      <span>{tpl.tagRules.length} rules</span>
                      <span>{tpl.loadout.length} slots</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tpl.tags.map((tag) => (
                        <span key={tag} className="text-xs font-mono px-1.5 py-0 rounded"
                          style={{ backgroundColor: `${tpl.color}10`, color: `${tpl.color}cc`, border: `1px solid ${tpl.color}20` }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2.5 rounded overflow-hidden" style={{ backgroundColor: `${tpl.color}06` }}>
                      <svg width="100%" height={36} viewBox="0 0 280 36" preserveAspectRatio="xMinYMin" className="overflow-visible">
                        {tpl.attributes.filter(a => a.category === 'combat' || a.category === 'vital').slice(0, 4).map((attr, ai) => (
                          <g key={attr.id}>
                            <circle cx={20 + ai * 18} cy={12} r={3.5} fill={`${tpl.color}40`} stroke={`${tpl.color}80`} strokeWidth={0.5} />
                            <line x1={20 + ai * 18} y1={16} x2={120 + (ai % tpl.effects.length) * 22} y2={20} stroke={`${tpl.color}25`} strokeWidth={0.5} />
                          </g>
                        ))}
                        {tpl.effects.slice(0, 5).map((eff, ei) => (
                          <g key={eff.id}>
                            <rect x={108 + ei * 22} y={18} width={18} height={10} rx={2} fill={`${eff.color}30`} stroke={`${eff.color}60`} strokeWidth={0.5} />
                            {ei < tpl.tagRules.length - 2 && <line x1={126 + ei * 22} y1={23} x2={230 + (ei % 3) * 16} y2={12} stroke={`${tpl.color}20`} strokeWidth={0.5} />}
                          </g>
                        ))}
                        {tpl.tagRules.slice(0, 4).map((_, ti) => (
                          <circle key={ti} cx={235 + ti * 14} cy={12} r={3} fill={`${STATUS_ERROR}30`} stroke={`${STATUS_ERROR}60`} strokeWidth={0.5} />
                        ))}
                      </svg>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
