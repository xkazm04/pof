'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CharacterGenome } from '@/types/character-genome';
import { GENOME_PALETTE, HEX_REGEX } from './field-data';

/* ── Color Picker Popover ──────────────────────────────────────────────── */

function GenomeColorPicker({ currentColor, onSelect, onClose }: {
  currentColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hex, setHex] = useState(currentColor);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const applyHex = () => {
    const v = hex.startsWith('#') ? hex : `#${hex}`;
    if (HEX_REGEX.test(v)) { onSelect(v); onClose(); }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="absolute top-full left-0 mt-1.5 z-50 p-2 rounded-lg border border-border/60 bg-surface shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {GENOME_PALETTE.map((color) => (
          <button
            key={color}
            onClick={() => { onSelect(color); onClose(); }}
            className="w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 focus:outline-none"
            style={{
              backgroundColor: color,
              borderColor: currentColor === color ? '#fff' : 'transparent',
              boxShadow: currentColor === color ? `0 0 6px ${color}` : 'none',
            }}
            title={color}
          />
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyHex()}
          placeholder="#ff0000"
          className="flex-1 w-0 min-w-0 text-[10px] font-mono bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-text focus:outline-none focus:border-blue-500/50"
          maxLength={7}
        />
        <button
          onClick={applyHex}
          className="px-1.5 py-0.5 text-[10px] font-bold rounded border border-border/40 bg-surface-deep text-text-muted hover:text-text transition-colors"
        >
          OK
        </button>
      </div>
    </motion.div>
  );
}

/* ── Genome Pill (selector) ────────────────────────────────────────────── */

export function GenomePill({ genome, isActive, onSelect, onColorChange }: {
  genome: CharacterGenome;
  isActive: boolean;
  onSelect: () => void;
  onColorChange: (color: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [animateKey, setAnimateKey] = useState(0);

  const handleDotClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPickerOpen((v) => !v);
  }, []);

  const handleColorSelect = useCallback((color: string) => {
    onColorChange(color);
    setAnimateKey((k) => k + 1);
  }, [onColorChange]);

  return (
    <button
      onClick={onSelect}
      className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 focus:outline-none whitespace-nowrap"
      style={{
        backgroundColor: isActive ? `${genome.color}20` : 'transparent',
        color: isActive ? genome.color : 'var(--text-muted)',
        border: `1px solid ${isActive ? `${genome.color}50` : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isActive ? `0 0 10px ${genome.color}15` : 'none',
      }}
    >
      <span className="relative w-2 h-2 flex-shrink-0">
        <motion.span
          key={animateKey}
          className="absolute inset-0 rounded-full cursor-pointer"
          style={{ backgroundColor: genome.color }}
          onClick={handleDotClick}
          initial={animateKey > 0 ? { scale: 1.8 } : false}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        />
        {isActive && (
          <motion.span
            layoutId="genome-active-pill"
            className="absolute -inset-0.5 rounded-full border-2"
            style={{ borderColor: genome.color }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          />
        )}
        <AnimatePresence>
          {pickerOpen && (
            <GenomeColorPicker
              currentColor={genome.color}
              onSelect={handleColorSelect}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </AnimatePresence>
      </span>
      {genome.name}
    </button>
  );
}
