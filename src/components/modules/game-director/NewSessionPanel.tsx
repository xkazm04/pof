'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords, Compass, MessageSquare, Save, Monitor, Bot,
  Gauge, Eye, FolderOpen, Loader2, Sparkles, Timer, Camera,
  Info,
} from 'lucide-react';
import type { CreateSessionPayload, TestCategory, PlaytestConfig } from '@/types/game-director';
import type { PlaytestSession } from '@/types/game-director';
import { ACCENT_ORANGE, OPACITY_8, OPACITY_15, OPACITY_20 } from '@/lib/chart-colors';

const ACCENT = ACCENT_ORANGE;

const TEST_CATEGORIES: { id: TestCategory; label: string; icon: typeof Swords; description: string }[] = [
  { id: 'combat', label: 'Combat', icon: Swords, description: 'Test combos, hit detection, damage' },
  { id: 'exploration', label: 'Exploration', icon: Compass, description: 'Test zones, navigation, pacing' },
  { id: 'dialogue', label: 'Dialogue', icon: MessageSquare, description: 'Test conversation branches' },
  { id: 'save-load', label: 'Save/Load', icon: Save, description: 'Test state persistence' },
  { id: 'ui-navigation', label: 'UI Navigation', icon: Monitor, description: 'Test menus, HUD, gamepad' },
  { id: 'ai-behavior', label: 'AI Behavior', icon: Bot, description: 'Test NPC pathfinding, reactions' },
  { id: 'performance-stress', label: 'Performance', icon: Gauge, description: 'Stress test FPS, memory' },
  { id: 'visual-quality', label: 'Visual Quality', icon: Eye, description: 'Detect glitches, pop-in, LOD' },
];

function SettingTooltip({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => { clearTimeout(timeout.current); setOpen(true); };
  const hide = () => { timeout.current = setTimeout(() => setOpen(false), 120); };

  return (
    <span
      className="relative inline-flex ml-1 cursor-help"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
      role="button"
      aria-label="Show guidance"
    >
      <Info className="w-3 h-3 text-text-muted hover:text-text transition-colors" />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2.5 rounded-lg bg-surface-overlay border border-border shadow-lg pointer-events-none"
          >
            <ul className="space-y-1">
              {lines.map((line) => (
                <li key={line} className="text-2xs text-text-muted leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-surface-overlay border-r border-b border-border" />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

const PLAYTIME_TIPS = [
  '2–5 min — Quick smoke tests, verify a single fix',
  '6–14 min — Targeted feature tests, one system at a time',
  '15–30 min — Deep exploration, emergent bugs, pacing checks',
];

const SCREENSHOT_TIPS = [
  '5–10s — Visual-heavy tests (glitches, LOD). High storage use',
  '15–30s — Balanced coverage for most test runs',
  '30–60s — Functional / logic tests where visuals matter less',
];

const AGGRESSIVE_TIPS = [
  'Triggers edge-case inputs: wall-clipping attempts, rapid menu toggling, spam-casting abilities',
  'Useful for stress-testing collision, state machines, and input handling',
  'May produce false positives — review findings with context',
];

interface NewSessionPanelProps {
  onCreated: () => void;
  createSession: (payload: CreateSessionPayload) => Promise<PlaytestSession>;
}

export function NewSessionPanel({ onCreated, createSession }: NewSessionPanelProps) {
  const [name, setName] = useState(`Playtest ${new Date().toLocaleDateString()}`);
  const [buildPath, setBuildPath] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<TestCategory>>(
    new Set(['combat', 'exploration', 'visual-quality'])
  );
  const [maxPlaytime, setMaxPlaytime] = useState(10);
  const [screenshotInterval, setScreenshotInterval] = useState(15);
  const [aggressiveMode, setAggressiveMode] = useState(false);
  const [creating, setCreating] = useState(false);

  const toggleCategory = (cat: TestCategory) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedCategories.size === 0) return;
    setCreating(true);
    try {
      const config: PlaytestConfig = {
        testCategories: Array.from(selectedCategories),
        maxPlaytimeMinutes: maxPlaytime,
        screenshotIntervalSeconds: screenshotInterval,
        aggressiveMode,
        prioritySystems: [],
      };
      await createSession({ name: name.trim(), buildPath, config });
      onCreated();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Session name */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
          Session Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pre-alpha combat test"
          className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
        />
      </motion.div>

      {/* Build path */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.05 }}
      >
        <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
          Build Path
          <span className="text-text-muted ml-1 normal-case tracking-normal">(optional — uses project default)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={buildPath}
            onChange={(e) => setBuildPath(e.target.value)}
            placeholder="C:\MyGame\Saved\StagedBuilds\Windows"
            className="flex-1 px-3 py-2.5 bg-surface border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors font-mono"
          />
          <button className="px-3 py-2.5 bg-surface border border-border rounded-lg text-text-muted hover:text-text transition-colors">
            <FolderOpen className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Test categories */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.1 }}
      >
        <label className="text-xs uppercase tracking-wider text-text-muted mb-2 block font-semibold">
          Test Categories
          <span className="text-text-muted ml-1 normal-case tracking-normal">
            ({selectedCategories.size} selected)
          </span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TEST_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategories.has(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className={`
                  flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-center transition-all
                  ${isSelected
                    ? ''
                    : 'border-border bg-surface-deep hover:border-border-bright hover:bg-surface'
                  }
                `}
                style={isSelected ? { borderColor: `${ACCENT}${OPACITY_20}`, backgroundColor: `${ACCENT}${OPACITY_8}` } : undefined}
              >
                <Icon
                  className="w-4 h-4"
                  style={{ color: isSelected ? ACCENT : 'var(--text-muted)' }}
                />
                <span className={`text-xs font-medium ${isSelected ? 'text-text' : 'text-text-muted'}`}>
                  {cat.label}
                </span>
                <span className="text-2xs text-text-muted leading-tight">{cat.description}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Settings row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.15 }}
        className="grid grid-cols-3 gap-4"
      >
        {/* Max playtime */}
        <div>
          <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1 font-semibold">
            <Timer className="w-3 h-3" />
            Playtime
            <SettingTooltip lines={PLAYTIME_TIPS} />
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={2}
              max={30}
              value={maxPlaytime}
              onChange={(e) => setMaxPlaytime(Number(e.target.value))}
              className="flex-1" style={{ accentColor: ACCENT }}
            />
            <span className="text-xs text-text-muted-hover w-8 text-right">{maxPlaytime}m</span>
          </div>
        </div>

        {/* Screenshot interval */}
        <div>
          <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1 font-semibold">
            <Camera className="w-3 h-3" />
            Screenshots
            <SettingTooltip lines={SCREENSHOT_TIPS} />
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={screenshotInterval}
              onChange={(e) => setScreenshotInterval(Number(e.target.value))}
              className="flex-1" style={{ accentColor: ACCENT }}
            />
            <span className="text-xs text-text-muted-hover w-8 text-right">{screenshotInterval}s</span>
          </div>
        </div>

        {/* Aggressive mode */}
        <div>
          <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1 font-semibold">
            <Sparkles className="w-3 h-3" />
            Aggressive
            <SettingTooltip lines={AGGRESSIVE_TIPS} />
          </label>
          <button
            onClick={() => setAggressiveMode(!aggressiveMode)}
            className={`
              w-full px-3 py-2 rounded-lg text-xs font-medium transition-all border
              ${aggressiveMode
                ? ''
                : 'bg-surface-deep border-border text-text-muted'
              }
            `}
            style={aggressiveMode ? { backgroundColor: `${ACCENT}${OPACITY_15}`, borderColor: `${ACCENT}${OPACITY_20}`, color: ACCENT } : undefined}
          >
            {aggressiveMode ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </motion.div>

      {/* Create button */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.2 }}
        className="pt-2"
      >
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim() || selectedCategories.size === 0}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${ACCENT}18`,
            color: ACCENT,
            border: `1px solid ${ACCENT}35`,
          }}
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {creating ? 'Creating Session...' : 'Create Playtest Session'}
        </button>
      </motion.div>
    </div>
  );
}
