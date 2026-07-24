'use client';

import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, Sparkles, Timer, Camera,
  FolderOpen,
} from 'lucide-react';
import type { CreateSessionPayload, TestCategory, PlaytestConfig } from '@/types/game-director';
import type { PlaytestSession } from '@/types/game-director';
import { OPACITY_8, OPACITY_15, OPACITY_20 } from '@/lib/chart-colors';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { SettingTooltip } from './SettingTooltip';
import {
  ACCENT,
  TEST_CATEGORIES,
  PLAYTIME_TIPS,
  SCREENSHOT_TIPS,
  AGGRESSIVE_TIPS,
} from './constants';

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
  const [createError, setCreateError] = useState<string | null>(null);

  // Ids tie every visible label to the control it names (click-to-focus + a
  // screen-reader accessible name), and the submit button to its blocking reason.
  const uid = useId();
  const nameId = `${uid}-name`;
  const buildPathId = `${uid}-build-path`;
  const categoriesLabelId = `${uid}-categories`;
  const playtimeId = `${uid}-playtime`;
  const screenshotId = `${uid}-screenshot`;
  const aggressiveLabelId = `${uid}-aggressive`;
  const blockedHintId = `${uid}-blocked`;

  // Why the Create button is disabled, stated instead of left for the user to guess.
  const blockedReason = !name.trim()
    ? 'Name the session before creating it.'
    : selectedCategories.size === 0
      ? 'Select at least one test category before creating the session.'
      : null;

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
    setCreateError(null);
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
    } catch (err) {
      // A failed create used to leave the form silently unchanged — surface the
      // reason with a Retry instead (the form still holds everything it needs).
      setCreateError(err instanceof Error ? err.message : 'Failed to create the playtest session.');
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
        <label htmlFor={nameId} className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
          Session Name
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pre-alpha combat test"
          className="focus-ring-inset w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
        />
      </motion.div>

      {/* Build path */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.05 }}
      >
        <label htmlFor={buildPathId} className="text-xs uppercase tracking-wider text-text-muted mb-1.5 block font-semibold">
          Build Path
          <span className="text-text-muted ml-1 normal-case tracking-normal">(optional — uses project default)</span>
        </label>
        <div className="flex gap-2">
          <input
            id={buildPathId}
            type="text"
            value={buildPath}
            onChange={(e) => setBuildPath(e.target.value)}
            placeholder="C:\MyGame\Saved\StagedBuilds\Windows"
            className="focus-ring-inset flex-1 px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors font-mono"
          />
          {/* Browsing is not wired yet — the control reads as unavailable rather
              than looking clickable and doing nothing. */}
          <button
            type="button"
            disabled
            aria-label="Browse for build folder (unavailable — paste the folder path instead)"
            title="Folder browsing isn't available here — paste the build folder path instead."
            className="focus-ring px-3 py-2.5 bg-surface border border-border rounded-lg text-text-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
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
        <span id={categoriesLabelId} className="text-xs uppercase tracking-wider text-text-muted mb-2 block font-semibold">
          Test Categories
          <span className="text-text-muted ml-1 normal-case tracking-normal">
            ({selectedCategories.size} selected)
          </span>
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-labelledby={categoriesLabelId}>
          {TEST_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategories.has(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                aria-pressed={isSelected}
                className={`
                  focus-ring flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-center transition-all
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
                <span className={`text-sm font-medium ${isSelected ? 'text-text' : 'text-text-muted'}`}>
                  {cat.label}
                </span>
                <span className="text-xs text-text-muted leading-tight">{cat.description}</span>
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
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {/* Max playtime */}
        <div>
          <div className="text-xs uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1 font-semibold">
            <Timer className="w-3 h-3" />
            <label htmlFor={playtimeId}>Playtime</label>
            <SettingTooltip lines={PLAYTIME_TIPS} />
          </div>
          <div className="flex items-center gap-2">
            <RangeSlider
              id={playtimeId}
              value={maxPlaytime}
              min={2}
              max={30}
              accent={ACCENT}
              onChange={setMaxPlaytime}
              ariaLabel="Maximum playtime in minutes"
              formatValue={(v) => `${v}m`}
              className="flex-1"
            />
            <span className="text-xs text-text-muted-hover w-8 text-right">{maxPlaytime}m</span>
          </div>
        </div>

        {/* Screenshot interval */}
        <div>
          <div className="text-xs uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1 font-semibold">
            <Camera className="w-3 h-3" />
            <label htmlFor={screenshotId}>Screenshots</label>
            <SettingTooltip lines={SCREENSHOT_TIPS} />
          </div>
          <div className="flex items-center gap-2">
            <RangeSlider
              id={screenshotId}
              value={screenshotInterval}
              min={5}
              max={60}
              step={5}
              accent={ACCENT}
              onChange={setScreenshotInterval}
              ariaLabel="Seconds between screenshots"
              formatValue={(v) => `${v}s`}
              className="flex-1"
            />
            <span className="text-xs text-text-muted-hover w-8 text-right">{screenshotInterval}s</span>
          </div>
        </div>

        {/* Aggressive mode */}
        <div>
          <div className="text-xs uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1 font-semibold">
            <Sparkles className="w-3 h-3" />
            <span id={aggressiveLabelId}>Aggressive</span>
            <SettingTooltip lines={AGGRESSIVE_TIPS} />
          </div>
          <button
            type="button"
            onClick={() => setAggressiveMode(!aggressiveMode)}
            aria-pressed={aggressiveMode}
            aria-label="Aggressive mode"
            aria-describedby={aggressiveLabelId}
            className={`
              focus-ring w-full px-3 py-2 rounded-lg text-sm font-medium transition-all border
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
        className="pt-2 space-y-2"
      >
        {createError && (
          <InlineErrorRetry
            message={createError}
            onRetry={() => { void handleCreate(); }}
            onDismiss={() => setCreateError(null)}
          />
        )}
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || blockedReason !== null}
          aria-describedby={blockedReason ? blockedHintId : undefined}
          className="focus-ring flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: `${ACCENT}18`,
            color: ACCENT,
            border: `1px solid ${ACCENT}35`,
          }}
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          )}
          {creating ? 'Creating session…' : 'Create Playtest Session'}
        </button>
        {blockedReason && (
          <p id={blockedHintId} className="text-2xs text-text-muted text-center">
            {blockedReason}
          </p>
        )}
      </motion.div>
    </div>
  );
}
