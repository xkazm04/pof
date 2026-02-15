'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Swords, Compass, MessageSquare, Save, Monitor, Bot,
  Gauge, Eye, FolderOpen, Loader2, Sparkles, Timer, Camera,
} from 'lucide-react';
import type { CreateSessionPayload, TestCategory, PlaytestConfig } from '@/types/game-director';
import type { PlaytestSession } from '@/types/game-director';

const ACCENT = '#f97316';

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
                    ? 'border-[#f9731640] bg-[#f9731608]'
                    : 'border-border bg-surface-deep hover:border-border-bright hover:bg-surface'
                  }
                `}
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
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={2}
              max={30}
              value={maxPlaytime}
              onChange={(e) => setMaxPlaytime(Number(e.target.value))}
              className="flex-1 accent-[#f97316]"
            />
            <span className="text-xs text-text-muted-hover w-8 text-right">{maxPlaytime}m</span>
          </div>
        </div>

        {/* Screenshot interval */}
        <div>
          <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1 font-semibold">
            <Camera className="w-3 h-3" />
            Screenshots
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={screenshotInterval}
              onChange={(e) => setScreenshotInterval(Number(e.target.value))}
              className="flex-1 accent-[#f97316]"
            />
            <span className="text-xs text-text-muted-hover w-8 text-right">{screenshotInterval}s</span>
          </div>
        </div>

        {/* Aggressive mode */}
        <div>
          <label className="text-xs uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1 font-semibold">
            <Sparkles className="w-3 h-3" />
            Aggressive
          </label>
          <button
            onClick={() => setAggressiveMode(!aggressiveMode)}
            className={`
              w-full px-3 py-2 rounded-lg text-xs font-medium transition-all border
              ${aggressiveMode
                ? 'bg-[#f9731615] border-[#f9731640] text-[#f97316]'
                : 'bg-surface-deep border-border text-text-muted'
              }
            `}
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
