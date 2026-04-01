'use client';

import {
  FlaskConical, ChevronDown, ChevronRight, Dices, RefreshCw, Target,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_PURPLE, OPACITY_15,
} from '@/lib/chart-colors';
import { BlueprintPanel } from '../_design';
import { CURRENCIES, CRAFTING_ACTIONS } from './constants';
import type { CurrencyId, CraftingActionId, CraftLogEntry, CraftingActionDef } from './types';
import type { CraftedAffix } from './data';
import { CraftLogSection } from './CraftLogSection';

interface CraftingStationProps {
  showCraftPanel: boolean;
  onToggleCraftPanel: () => void;
  prefixLocked: boolean;
  suffixLocked: boolean;
  craftCount: number;
  wallet: Record<CurrencyId, number>;
  craftedAffixes: CraftedAffix[];
  maxAffixes: number;
  craftFlash: string | null;
  craftLog: CraftLogEntry[];
  avgCraftCost: Partial<Record<CurrencyId, number>> | null;
  onExecuteCraft: (actionId: CraftingActionId) => void;
  onResetWallet: () => void;
  canAfford: (action: CraftingActionDef) => boolean;
}

export function CraftingStation({
  showCraftPanel, onToggleCraftPanel, prefixLocked, suffixLocked,
  craftCount, wallet, craftedAffixes, maxAffixes, craftFlash,
  craftLog, avgCraftCost, onExecuteCraft, onResetWallet, canAfford,
}: CraftingStationProps) {
  return (
    <BlueprintPanel color={ACCENT_PURPLE} className="p-3 space-y-3 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <button onClick={onToggleCraftPanel} className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5" style={{ color: ACCENT_PURPLE }} />
          <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text">
            Crafting Station
          </span>
          {prefixLocked && (
            <span className="text-xs px-1.5 py-0.5 rounded font-bold font-mono"
              style={{ backgroundColor: `${ACCENT_PURPLE}${OPACITY_15}`, color: ACCENT_PURPLE, border: `1px solid ${ACCENT_PURPLE}30` }}>
              PRE LOCKED
            </span>
          )}
          {suffixLocked && (
            <span className="text-xs px-1.5 py-0.5 rounded font-bold font-mono"
              style={{ backgroundColor: `${ACCENT_PURPLE}${OPACITY_15}`, color: ACCENT_PURPLE, border: `1px solid ${ACCENT_PURPLE}30` }}>
              SUF LOCKED
            </span>
          )}
          {showCraftPanel ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        </button>
        <div className="flex items-center gap-1.5 text-xs font-mono text-text-muted">
          <Dices className="w-3 h-3" /> {craftCount} crafts
        </div>
      </div>

      {showCraftPanel && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
          {/* Currency Wallet */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {CURRENCIES.map(c => (
              <div key={c.id}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all"
                style={{
                  border: `1px solid ${wallet[c.id] === 0 ? `${STATUS_ERROR}40` : `${c.color}20`}`,
                  backgroundColor: wallet[c.id] === 0 ? `${STATUS_ERROR}08` : `${c.color}05`,
                }}
                title={`${c.name}: ${c.description}`}>
                <span className="text-xs">{c.icon}</span>
                <span className="text-xs font-mono font-bold"
                  style={{ color: wallet[c.id] === 0 ? STATUS_ERROR : c.color, textShadow: `0 0 12px ${c.color}40` }}>
                  {wallet[c.id]}
                </span>
                <span className="text-[9px] text-text-muted truncate w-full text-center font-mono">{c.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>

          {/* Wallet reset */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-text-muted">Forging Potential acts as item durability</span>
            <button onClick={onResetWallet}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono text-text-muted hover:text-text transition-colors"
              style={{ border: `1px solid ${ACCENT_PURPLE}25` }}>
              <RefreshCw className="w-2.5 h-2.5" /> Reset
            </button>
          </div>

          {/* Crafting actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CRAFTING_ACTIONS.map(action => {
              const affordable = canAfford(action);
              const hasAffixes = craftedAffixes.some(a => !a.locked) || !action.requiresAffixes;
              const hasSpace = craftedAffixes.length < maxAffixes || !action.requiresSpace;
              const enabled = affordable && hasAffixes && hasSpace;
              const isFlashing = craftFlash === action.id;

              return (
                <motion.button key={action.id}
                  onClick={() => onExecuteCraft(action.id)}
                  disabled={!enabled}
                  className="text-left px-2.5 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                  style={{
                    border: `1px solid ${isFlashing ? `${action.color}80` : enabled ? `${action.color}30` : `${action.color}18`}`,
                    backgroundColor: isFlashing ? `${action.color}20` : enabled ? `${action.color}05` : 'transparent',
                    boxShadow: isFlashing ? `0 0 12px ${action.color}30` : 'none',
                  }}
                  animate={isFlashing ? { scale: [1, 1.03, 1] } : {}}
                  transition={{ duration: 0.2 }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: action.color }} />
                    <span className="text-xs font-mono font-bold uppercase tracking-[0.15em]"
                      style={{ color: enabled ? action.color : 'var(--text-muted)', textShadow: enabled ? `0 0 12px ${action.color}40` : 'none' }}>
                      {action.name}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-snug mb-1.5 line-clamp-2">{action.description}</p>

                  <div className="flex flex-wrap gap-1">
                    {Object.entries(action.costs).map(([cid, amount]) => {
                      const cur = CURRENCIES.find(c => c.id === cid);
                      if (!cur || !amount) return null;
                      const hasEnough = (wallet[cid as CurrencyId] ?? 0) >= amount;
                      return (
                        <span key={cid} className="text-xs font-mono px-1 py-0.5 rounded"
                          style={{ backgroundColor: hasEnough ? `${cur.color}10` : `${STATUS_ERROR}15`, color: hasEnough ? cur.color : STATUS_ERROR }}>
                          {amount} {cur.icon}
                        </span>
                      );
                    })}
                  </div>

                  {action.successChance < 1.0 && (
                    <div className="mt-1 flex items-center gap-1 text-xs font-mono"
                      style={{ color: action.successChance >= 0.8 ? STATUS_SUCCESS : STATUS_WARNING }}>
                      <Target className="w-2.5 h-2.5" /> {(action.successChance * 100).toFixed(0)}%
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Craft log + cost tracker */}
          {craftLog.length > 0 && (
            <CraftLogSection craftLog={craftLog} avgCraftCost={avgCraftCost} craftCount={craftCount} />
          )}
        </motion.div>
      )}
    </BlueprintPanel>
  );
}

