import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { STATUS_WARNING, withOpacity, OPACITY_12 } from '@/lib/chart-colors';
import { AFFIX_DEFS } from '../../_shared/data';
import type { AffixDef } from '../../_shared/data';
import { CATEGORY_COLORS, REEL_STOP_MS, REEL_CYCLE_MS } from './constants';

export function useAffixRollSimulator() {
  // reelText is what each slot shows: '?' before a spin, a fast-cycling random
  // affix name while spinning, then the resolved pick once that reel lands.
  const [reelText, setReelText] = useState<string[]>(['?', '?', '?']);
  const [spinningSlots, setSpinningSlots] = useState<boolean[]>([false, false, false]);
  const [winSlots, setWinSlots] = useState<boolean[]>([false, false, false]);
  const [affixSpinning, setAffixSpinning] = useState(false);
  const [affixHistory, setAffixHistory] = useState<Record<string, number>>({});
  const [affixRollCount, setAffixRollCount] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedAffixIds, setSelectedAffixIds] = useState<string[]>(AFFIX_DEFS.map(a => a.id));

  const prefersReducedMotion = useReducedMotion();
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Precompute name -> def once so the hot spin render path (slot colors +
  // frequency rows, ~12.5 renders/sec while reeling) does O(1) Map.get instead
  // of a linear AFFIX_DEFS.find per slot/row. AFFIX_DEFS is module-static, so []
  // deps keep this stable for the component's lifetime.
  const affixByName = useMemo(
    () => new Map(AFFIX_DEFS.map(a => [a.name, a] as const)),
    [],
  );

  const clearTimers = useCallback(() => {
    if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null; }
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  // Tear down any in-flight reel timers if the panel unmounts mid-spin.
  useEffect(() => clearTimers, [clearTimers]);

  const colorForAffixName = useCallback((name: string) => {
    const def = affixByName.get(name);
    return def ? CATEGORY_COLORS[def.category] ?? STATUS_WARNING : STATUS_WARNING;
  }, [affixByName]);

  const activePool = useMemo(
    () => AFFIX_DEFS.filter(a => selectedAffixIds.includes(a.id)),
    [selectedAffixIds],
  );

  // Godroll odds, computed from the SAME weighted distribution spinAffixes rolls (not a
  // uniform 1/N): probability that all 3 slots land the rarest (lowest-weight) affix.
  const godrollPct = useMemo(() => {
    if (activePool.length === 0) return 0;
    const total = activePool.reduce((s, a) => s + a.weight, 0);
    if (total <= 0) return 0;
    const minWeight = activePool.reduce((m, a) => Math.min(m, a.weight), Infinity);
    return Math.pow(minWeight / total, 3) * 100;
  }, [activePool]);

  const spinAffixes = useCallback(() => {
    if (activePool.length === 0) return;
    clearTimers();

    // Resolve the outcome up front from the weighted distribution; the reel
    // choreography below is purely cosmetic and simply lands on these picks.
    const totalWeight = activePool.reduce((s, a) => s + a.weight, 0);
    const picks: AffixDef[] = [];
    for (let i = 0; i < 3; i++) {
      let roll = Math.random() * totalWeight;
      let chosen = activePool[0];
      for (const affix of activePool) {
        roll -= affix.weight;
        if (roll <= 0) { chosen = affix; break; }
      }
      picks.push(chosen);
    }
    const names = picks.map(p => p.name);

    const commit = () => {
      setAffixSpinning(false);
      setAffixRollCount((c) => c + 1);
      setAffixHistory((prev) => {
        const next = { ...prev };
        for (const n of names) next[n] = (next[n] ?? 0) + 1;
        return next;
      });
    };

    // Reduced motion: skip the reels entirely and reveal the result instantly.
    if (prefersReducedMotion) {
      setReelText(names);
      setSpinningSlots([false, false, false]);
      setWinSlots(picks.map(p => p.tier === 3));
      commit();
      return;
    }

    setAffixSpinning(true);
    setSpinningSlots([true, true, true]);
    setWinSlots([false, false, false]);

    // Cycle a random affix name through every slot that is still in motion.
    const stillSpinning = [true, true, true];
    const randomName = () => activePool[Math.floor(Math.random() * activePool.length)].name;
    cycleRef.current = setInterval(() => {
      setReelText((prev) => prev.map((t, i) => (stillSpinning[i] ? randomName() : t)));
    }, REEL_CYCLE_MS);

    // Stagger the stops left-to-right; each reel settles onto its pick, and a
    // tier-3 (godroll) landing flags the slot for the scale-pop + glow win cue.
    REEL_STOP_MS.forEach((ms, i) => {
      const handle = setTimeout(() => {
        stillSpinning[i] = false;
        setReelText((prev) => { const n = [...prev]; n[i] = names[i]; return n; });
        setSpinningSlots((prev) => { const n = [...prev]; n[i] = false; return n; });
        if (picks[i].tier === 3) {
          setWinSlots((prev) => { const n = [...prev]; n[i] = true; return n; });
        }
        if (i === REEL_STOP_MS.length - 1) {
          if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null; }
          commit();
        }
      }, ms);
      timeoutsRef.current.push(handle);
    });
  }, [activePool, prefersReducedMotion, clearTimers]);

  // Sorted frequency rows, each pre-resolved to its category color via the
  // O(1) Map. Memoized so the spin-driven re-renders don't re-sort + re-scan.
  const frequencyRows = useMemo(
    () =>
      Object.entries(affixHistory)
        .sort((a, b) => b[1] - a[1])
        .map(([affix, count]) => {
          const def = affixByName.get(affix);
          const catColor = def ? CATEGORY_COLORS[def.category] ?? STATUS_WARNING : STATUS_WARNING;
          return { affix, count, catColor };
        }),
    [affixHistory, affixByName],
  );

  const renderAffixItem = useCallback((item: AffixDef, selected: boolean) => {
    const catColor = CATEGORY_COLORS[item.category] ?? STATUS_WARNING;
    return (
      <div className="px-2 py-1.5 rounded text-left transition-all"
        style={{
          backgroundColor: selected ? withOpacity(catColor, OPACITY_12) : 'transparent',
          outline: selected ? `1px solid ${catColor}` : 'none',
        }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold" style={{ color: catColor }}>{item.name}</span>
          <span className="text-2xs font-mono text-text-muted ml-auto">T{item.tier}</span>
        </div>
        <div className="text-2xs text-text-muted mt-0.5">{item.description}</div>
      </div>
    );
  }, []);

  return {
    reelText,
    spinningSlots,
    winSlots,
    affixSpinning,
    affixHistory,
    affixRollCount,
    selectorOpen,
    setSelectorOpen,
    selectedAffixIds,
    setSelectedAffixIds,
    prefersReducedMotion,
    colorForAffixName,
    activePool,
    godrollPct,
    spinAffixes,
    frequencyRows,
    renderAffixItem,
  };
}
