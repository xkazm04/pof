'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { motionSafe } from '@/lib/motion';
import { STATUS_ERROR, ACCENT_CYAN,
  withOpacity, OPACITY_12, OPACITY_25, OPACITY_5, OPACITY_22, OPACITY_30, OPACITY_20, OPACITY_10, OPACITY_0,
} from '@/lib/chart-colors';
import { ENEMY_ARCHETYPES } from '@/lib/combat/definitions';
import type { PlacedEnemy } from '@/lib/combat/choreography-sim';
import {
  GRID_COLS, GRID_ROWS, CELL_SIZE,
  ARCHETYPE_COLORS, ARCHETYPE_ICONS,
  type DragState,
} from './types';

export function SpatialGrid({ enemies, selectedWave, totalWaves, onPlace, onRemove, onMove }: {
  enemies: PlacedEnemy[];
  selectedWave: number;
  totalWaves: number;
  onPlace: (x: number, y: number) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, toX: number, toY: number, toWave?: number) => void;
}) {
  // The next-wave ghost cells loop borderColor + boxShadow — neither is a
  // positional key, so the root MotionConfig leaves them animating forever.
  const prefersReduced = useReducedMotion();
  const dragRef = useRef<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingEnemyId, setDraggingEnemyId] = useState<string | null>(null);

  const waveEnemies = enemies.filter((e) => e.waveIndex === selectedWave);
  const prevWaveEnemies = selectedWave > 0
    ? enemies.filter((e) => e.waveIndex === selectedWave - 1) : [];
  const nextWaveEnemies = selectedWave < totalWaves - 1
    ? enemies.filter((e) => e.waveIndex === selectedWave + 1) : [];

  const handleDragStart = useCallback((e: React.PointerEvent, enemy: PlacedEnemy) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      enemyId: enemy.id, sourceX: enemy.gridX, sourceY: enemy.gridY,
      sourceWave: enemy.waveIndex, shiftHeld: e.shiftKey,
    };
    setIsDragging(true);
    setDraggingEnemyId(enemy.id);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current.shiftHeld = e.shiftKey;
    const gridEl = e.currentTarget as HTMLElement;
    const rect = gridEl.getBoundingClientRect();
    const gap = 2;
    const cellWithGap = CELL_SIZE + gap;
    const cellX = Math.floor((e.clientX - rect.left) / cellWithGap);
    const cellY = Math.floor((e.clientY - rect.top) / cellWithGap);
    if (cellX >= 0 && cellX < GRID_COLS && cellY >= 0 && cellY < GRID_ROWS) {
      setDropTarget({ x: cellX, y: cellY });
    } else {
      setDropTarget(null);
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setIsDragging(false);
    setDraggingEnemyId(null);
    setDropTarget(null);

    const gridEl = e.currentTarget as HTMLElement;
    const rect = gridEl.getBoundingClientRect();
    const gap = 2;
    const cellWithGap = CELL_SIZE + gap;
    const cellX = Math.floor((e.clientX - rect.left) / cellWithGap);
    const cellY = Math.floor((e.clientY - rect.top) / cellWithGap);

    if (cellX < 0 || cellX >= GRID_COLS || cellY < 0 || cellY >= GRID_ROWS) return;
    if (cellX === drag.sourceX && cellY === drag.sourceY && !e.shiftKey) return;

    const destWave = e.shiftKey ? selectedWave : drag.sourceWave;
    const occupied = enemies.some(
      (en) => en.id !== drag.enemyId && en.gridX === cellX && en.gridY === cellY && en.waveIndex === destWave,
    );
    if (occupied) return;
    onMove(drag.enemyId, cellX, cellY, e.shiftKey ? selectedWave : undefined);
  }, [enemies, selectedWave, onMove]);

  const [focusIdx, setFocusIdx] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(false);
  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${focusIdx}"]`)?.focus();
  }, [focusIdx]);

  /** Roving-tabindex cell semantics: arrows move focus, Alt+arrow moves an enemy, Enter/Space acts. */
  const cellProps = (x: number, y: number, enemy: PlacedEnemy | undefined, act: () => void, label: string) => {
    const i = y * GRID_COLS + x;
    return {
      role: 'gridcell' as const, 'data-cell': i, tabIndex: i === focusIdx ? 0 : -1,
      'aria-label': `${label}, column ${x + 1}, row ${y + 1}`,
      onFocus: () => setFocusIdx(i),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); return; }
        const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
        if (!d) return;
        e.preventDefault();
        const nx = x + d[0], ny = y + d[1];
        if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) return;
        if (e.altKey && enemy) {
          if (waveEnemies.some((w) => w.gridX === nx && w.gridY === ny)) return;
          onMove(enemy.id, nx, ny);
        }
        wantFocus.current = true;
        setFocusIdx(ny * GRID_COLS + nx);
      },
    };
  };

  return (
    <div className="inline-block">
      <div
        ref={gridRef} role="grid" aria-label="Encounter placement grid"
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_SIZE}px)`,
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {Array.from({ length: GRID_ROWS }, (_, y) => (
          <div key={y} role="row" className="contents">
        {Array.from({ length: GRID_COLS }, (_, x) => {
          const i = y * GRID_COLS + x;
          const enemy = waveEnemies.find((e) => e.gridX === x && e.gridY === y);
          const prevGhost = !enemy ? prevWaveEnemies.find((e) => e.gridX === x && e.gridY === y) : null;
          const nextGhost = !enemy && !prevGhost ? nextWaveEnemies.find((e) => e.gridX === x && e.gridY === y) : null;
          const isDropTarget = isDragging && dropTarget?.x === x && dropTarget?.y === y && !enemy;

          if (enemy) {
            const color = ARCHETYPE_COLORS[enemy.archetypeId] ?? ACCENT_CYAN;
            const icon = ARCHETYPE_ICONS[enemy.archetypeId] ?? '??';
            const beingDragged = isDragging && draggingEnemyId === enemy.id;
            return (
              <div key={i}
                className="relative flex items-center justify-center rounded-md border-2 cursor-grab group select-none touch-none"
                style={{ width: CELL_SIZE, height: CELL_SIZE, borderColor: color, backgroundColor: `${withOpacity(color, OPACITY_12)}`, opacity: beingDragged ? 0.4 : 1, transition: 'opacity 0.15s' }}
                onPointerDown={(e) => handleDragStart(e, enemy)}
                onClick={() => { if (!isDragging) onRemove(enemy.id); }}
                {...cellProps(x, y, enemy, () => onRemove(enemy.id), `${ENEMY_ARCHETYPES.find((a) => a.id === enemy.archetypeId)?.name ?? enemy.archetypeId} Lv${enemy.level}, Enter removes, Alt+arrow moves`)}
                title={`${ENEMY_ARCHETYPES.find((a) => a.id === enemy.archetypeId)?.name} Lv${enemy.level} — drag to move, click to remove`}
              >
                <span className="text-xs font-mono font-bold" style={{ color }}>{icon}</span>
                <span className="absolute -top-1 -right-1 text-xs font-mono font-bold px-0.5 rounded"
                  style={{ backgroundColor: color, color: 'black' }}>{enemy.level}</span>
                {!isDragging && <Trash2 className="absolute inset-0 m-auto w-3.5 h-3.5 opacity-0 group-hover:opacity-80 transition-opacity" style={{ color: STATUS_ERROR }} />}
              </div>
            );
          }

          if (prevGhost) {
            const color = ARCHETYPE_COLORS[prevGhost.archetypeId] ?? ACCENT_CYAN;
            const icon = ARCHETYPE_ICONS[prevGhost.archetypeId] ?? '??';
            return (
              <div key={i}
                className="relative flex items-center justify-center rounded-md cursor-pointer hover:border-border/50 transition-colors"
                style={{ width: CELL_SIZE, height: CELL_SIZE, border: `1px dashed ${withOpacity(color, OPACITY_25)}`, backgroundColor: `${withOpacity(color, OPACITY_5)}`, opacity: 0.45 }}
                onClick={() => onPlace(x, y)}
                {...cellProps(x, y, undefined, () => onPlace(x, y), 'Previous wave ghost, Enter places')}
                title={`Previous wave: ${ENEMY_ARCHETYPES.find((a) => a.id === prevGhost.archetypeId)?.name ?? prevGhost.archetypeId} Lv${prevGhost.level}`}
              >
                <span className="text-xs font-mono font-bold" style={{ color }}>{icon}</span>
                <span className="absolute bottom-0.5 right-0.5 text-xs font-mono text-text-subtle">prev</span>
              </div>
            );
          }

          if (nextGhost) {
            const color = ARCHETYPE_COLORS[nextGhost.archetypeId] ?? ACCENT_CYAN;
            const icon = ARCHETYPE_ICONS[nextGhost.archetypeId] ?? '??';
            return (
              <motion.div key={i}
                className="relative flex items-center justify-center rounded-md cursor-pointer"
                style={{ width: CELL_SIZE, height: CELL_SIZE, border: `1px dashed ${withOpacity(color, OPACITY_22)}`, backgroundColor: `${withOpacity(color, OPACITY_5)}` }}
                animate={{ borderColor: [`${withOpacity(color, OPACITY_12)}`, `${withOpacity(color, OPACITY_30)}`, `${withOpacity(color, OPACITY_12)}`], boxShadow: [`0 0 0px ${withOpacity(color, OPACITY_0)}`, `0 0 6px ${withOpacity(color, OPACITY_20)}`, `0 0 0px ${withOpacity(color, OPACITY_0)}`] }}
                transition={motionSafe({ duration: 2, repeat: Infinity, ease: 'easeInOut' } as const, prefersReduced)}
                onClick={() => onPlace(x, y)}
                {...cellProps(x, y, undefined, () => onPlace(x, y), 'Next wave ghost, Enter places')}
                title={`Next wave: ${ENEMY_ARCHETYPES.find((a) => a.id === nextGhost.archetypeId)?.name ?? nextGhost.archetypeId} Lv${nextGhost.level}`}
              >
                <span className="text-xs font-mono font-bold" style={{ color, opacity: 0.35 }}>{icon}</span>
                <span className="absolute bottom-0.5 right-0.5 text-xs font-mono text-text-subtle">next</span>
              </motion.div>
            );
          }

          return (
            <div key={i}
              className={`flex items-center justify-center rounded-md border cursor-pointer transition-all ${
                isDropTarget ? 'border-2 border-dashed' : 'border-border/20 bg-surface-deep/30 hover:border-border/50 hover:bg-surface-deep/60'
              }`}
              style={{ width: CELL_SIZE, height: CELL_SIZE, ...(isDropTarget ? { borderColor: ACCENT_CYAN, backgroundColor: `${withOpacity(ACCENT_CYAN, OPACITY_10)}`, boxShadow: `inset 0 0 8px ${withOpacity(ACCENT_CYAN, OPACITY_12)}` } : {}) }}
              onClick={() => { if (!isDragging) onPlace(x, y); }}
              {...cellProps(x, y, undefined, () => onPlace(x, y), 'Empty, Enter places')}
            >
              {isDropTarget
                ? <span className="text-xs font-mono font-bold" style={{ color: ACCENT_CYAN, opacity: 0.7 }}>+</span>
                : <Plus className="w-3 h-3 text-text-muted/30" />}
            </div>
          );
        })}
          </div>
        ))}
      </div>
      {isDragging && (
        <div className="text-xs font-mono text-text-muted/60 mt-1 flex items-center gap-1">
          <span>Drop to reposition</span>
          <span className="px-1 py-0.5 rounded bg-surface-deep border border-border/30 text-xs">Shift</span>
          <span>= move to current wave</span>
        </div>
      )}
    </div>
  );
}
