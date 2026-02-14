'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Settings, Monitor, Terminal as TerminalIcon, Laptop, Smartphone, Tablet,
  Play, Save, X, RefreshCw, Wrench, Rocket, ChevronDown,
} from 'lucide-react';
import {
  type BuildProfile, type PlatformId, type BuildConfig,
  SUPPORTED_PLATFORMS, createDefaultProfile,
  DEFAULT_COOK_SETTINGS, DEFAULT_PLATFORM_SETTINGS,
} from '@/lib/packaging/build-profiles';
import { generatePackagePrompt } from '@/lib/packaging/uat-command-generator';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { PlatformProfileCard } from './PlatformProfileCard';
import { CookSettingsPanel } from './CookSettingsPanel';

const PLATFORM_ICONS: Record<PlatformId, typeof Monitor> = {
  Win64: Monitor,
  Linux: TerminalIcon,
  Mac: Laptop,
  Android: Smartphone,
  IOS: Tablet,
};

const CONFIG_OPTIONS: Array<{ value: BuildConfig; label: string; description: string }> = [
  { value: 'Development', label: 'Development', description: 'Debug features enabled, no optimizations' },
  { value: 'DebugGame', label: 'DebugGame', description: 'Game debugging with engine optimizations' },
  { value: 'Shipping', label: 'Shipping', description: 'Final build, all optimizations, no debug' },
  { value: 'Test', label: 'Test', description: 'Shipping-like with test features enabled' },
];

// ---------- Main component ----------

export function BuildConfigSelector() {
  const [profiles, setProfiles] = useState<BuildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Partial<BuildProfile> | null>(null);
  const [uatCommands, setUatCommands] = useState<Record<string, string>>({});

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const { sendPrompt, isRunning } = useModuleCLI({
    moduleId: 'packaging',
    sessionKey: 'package-build',
    label: 'Package Build',
    accentColor: '#8b5cf6',
  });

  // Fetch profiles
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ profiles: BuildProfile[] }>('/api/packaging/profiles');
      setProfiles(data.profiles ?? []);

      // Generate commands for each profile
      const cmds: Record<string, string> = {};
      for (const p of data.profiles ?? []) {
        try {
          const cmdData = await apiFetch<{ command: string }>('/api/packaging/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate-command', profile: p, projectPath, projectName, ueVersion }),
          });
          if (cmdData.command) cmds[p.id] = cmdData.command;
        } catch { /* skip command generation failures */ }
      }
      setUatCommands(cmds);
    } catch (e) {
      console.error('Failed to fetch profiles:', e);
    } finally {
      setLoading(false);
    }
  }, [projectPath, projectName, ueVersion]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // Save profile
  const handleSave = useCallback(async (profile: Partial<BuildProfile>) => {
    try {
      await apiFetch('/api/packaging/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', profile }),
      });
      setShowEditor(false);
      setEditingProfile(null);
      fetchProfiles();
    } catch (e) {
      console.error('Failed to save profile:', e);
    }
  }, [fetchProfiles]);

  // Delete profile
  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/packaging/profiles?id=${id}`, { method: 'DELETE' });
      fetchProfiles();
    } catch (e) {
      console.error('Failed to delete profile:', e);
    }
  }, [fetchProfiles]);

  // Set default
  const handleSetDefault = useCallback(async (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    await handleSave({ ...profile, isDefault: true });
  }, [profiles, handleSave]);

  // Package
  const handlePackage = useCallback((profile: BuildProfile) => {
    if (isRunning) return;
    const prompt = generatePackagePrompt(profile, projectPath, projectName, ueVersion);
    sendPrompt(prompt);
  }, [isRunning, projectPath, projectName, ueVersion, sendPrompt]);

  // New profile
  const handleNewProfile = useCallback((platform: PlatformId) => {
    const defaults = createDefaultProfile(platform);
    setEditingProfile(defaults);
    setShowEditor(true);
  }, []);

  // Edit profile
  const handleEdit = useCallback((profile: BuildProfile) => {
    setEditingProfile({ ...profile });
    setShowEditor(true);
  }, []);

  // Group profiles by platform
  const grouped = useMemo(() => {
    const map = new Map<PlatformId, BuildProfile[]>();
    for (const p of profiles) {
      if (!map.has(p.platform)) map.set(p.platform, []);
      map.get(p.platform)!.push(p);
    }
    return map;
  }, [profiles]);

  // Platforms with no profiles
  const unusedPlatforms = SUPPORTED_PLATFORMS.filter((p) => !grouped.has(p.id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-[#8b5cf6]" />
          <span className="text-sm font-semibold text-text">Build Pipeline</span>
          <span className="text-xs text-text-muted font-mono">
            {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchProfiles}
            disabled={loading}
            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Add platform buttons */}
      {unusedPlatforms.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xs text-text-muted uppercase tracking-wider font-medium">Add:</span>
          {unusedPlatforms.map((p) => {
            const Icon = PLATFORM_ICONS[p.id] ?? Monitor;
            return (
              <button
                key={p.id}
                onClick={() => handleNewProfile(p.id)}
                className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-border-bright text-xs text-text-muted hover:text-text hover:border-[#8b5cf6]/50 transition-colors"
              >
                <Icon className="w-3 h-3" />
                {p.label}
              </button>
            );
          })}
          {profiles.length > 0 && (
            <button
              onClick={() => {
                const firstPlatform = SUPPORTED_PLATFORMS[0].id;
                handleNewProfile(grouped.has(firstPlatform) ? (unusedPlatforms[0]?.id ?? firstPlatform) : firstPlatform);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-border-bright text-xs text-[#8b5cf6] hover:border-[#8b5cf6]/50 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Custom
            </button>
          )}
        </div>
      )}

      {/* Profile cards */}
      {profiles.length === 0 && !loading ? (
        <div className="text-center py-8 space-y-3">
          <Wrench className="w-6 h-6 text-text-muted mx-auto" />
          <div className="text-xs text-text-muted">No build profiles yet</div>
          <div className="flex items-center gap-2 justify-center">
            {SUPPORTED_PLATFORMS.slice(0, 3).map((p) => {
              const Icon = PLATFORM_ICONS[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => handleNewProfile(p.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border-bright text-xs text-[#c8cce0] hover:border-[#8b5cf6]/50 hover:bg-surface-hover transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {profiles.map((p) => (
            <PlatformProfileCard
              key={p.id}
              profile={p}
              uatCommand={uatCommands[p.id]}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
              onPackage={handlePackage}
            />
          ))}
        </div>
      )}

      {/* Profile editor modal */}
      <AnimatePresence>
        {showEditor && editingProfile && (
          <ProfileEditor
            profile={editingProfile}
            onSave={handleSave}
            onClose={() => { setShowEditor(false); setEditingProfile(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Profile editor ----------

function ProfileEditor({ profile, onSave, onClose }: {
  profile: Partial<BuildProfile>;
  onSave: (p: Partial<BuildProfile>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<BuildProfile>>({
    ...profile,
    cookSettings: { ...DEFAULT_COOK_SETTINGS, ...profile.cookSettings },
    platformSettings: { ...DEFAULT_PLATFORM_SETTINGS, ...profile.platformSettings },
  });

  const update = <K extends keyof BuildProfile>(key: K, value: BuildProfile[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectClass = 'bg-background border border-border-bright rounded px-2 py-1 text-xs text-[#c8cce0] outline-none focus:border-[#8b5cf6]/50 w-full';
  const inputClass = 'bg-background border border-border-bright rounded px-2 py-1 text-xs text-[#c8cce0] font-mono outline-none focus:border-[#8b5cf6]/50 w-full';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-surface-deep border border-border-bright rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#8b5cf6]" />
            <span className="text-sm font-semibold text-text">
              {profile.id ? 'Edit Profile' : 'New Profile'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-4">
          {/* Basic settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs text-text-muted font-medium uppercase tracking-wider">Profile Name</label>
              <input
                value={form.name ?? ''}
                onChange={(e) => update('name', e.target.value)}
                placeholder="My Build"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-2xs text-text-muted font-medium uppercase tracking-wider">Platform</label>
              <select
                value={form.platform ?? 'Win64'}
                onChange={(e) => update('platform', e.target.value as PlatformId)}
                className={selectClass}
              >
                {SUPPORTED_PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label} ({p.id})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Build config */}
          <div>
            <label className="text-2xs text-text-muted font-medium uppercase tracking-wider">Configuration</label>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {CONFIG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update('config', opt.value)}
                  className={`px-2 py-1.5 rounded border text-xs font-medium text-center transition-colors ${
                    form.config === opt.value
                      ? 'border-[#8b5cf6] bg-[#8b5cf6]/15 text-text'
                      : 'border-border-bright text-text-muted hover:border-[#8b5cf6]/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Output settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs text-text-muted font-medium uppercase tracking-wider">Output Directory</label>
              <input
                value={form.outputDir ?? ''}
                onChange={(e) => update('outputDir', e.target.value)}
                placeholder="Default staging directory"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-2xs text-text-muted font-medium uppercase tracking-wider">Archive Directory</label>
              <input
                value={form.archiveDir ?? ''}
                onChange={(e) => update('archiveDir', e.target.value)}
                placeholder="Archive output path"
                className={inputClass}
              />
            </div>
          </div>

          {/* Toggles row */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-[#c8cce0] cursor-pointer">
              <input
                type="checkbox"
                checked={form.stage ?? true}
                onChange={(e) => update('stage', e.target.checked)}
                className="accent-[#8b5cf6]"
              />
              Stage
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#c8cce0] cursor-pointer">
              <input
                type="checkbox"
                checked={form.archive ?? false}
                onChange={(e) => update('archive', e.target.checked)}
                className="accent-[#8b5cf6]"
              />
              Archive
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#c8cce0] cursor-pointer">
              <input
                type="checkbox"
                checked={form.runAfterPackage ?? false}
                onChange={(e) => update('runAfterPackage', e.target.checked)}
                className="accent-[#8b5cf6]"
              />
              Run After Build
            </label>
          </div>

          {/* Custom flags */}
          <div>
            <label className="text-2xs text-text-muted font-medium uppercase tracking-wider">Custom UAT Flags</label>
            <input
              value={form.platformSettings?.customFlags?.join(' ') ?? ''}
              onChange={(e) => update('platformSettings', {
                ...(form.platformSettings ?? DEFAULT_PLATFORM_SETTINGS),
                customFlags: e.target.value.split(' ').filter((f) => f.trim()),
              })}
              placeholder="-nocompile -nop4"
              className={`${inputClass} mt-1`}
            />
          </div>

          {/* Cook settings */}
          <CookSettingsPanel
            settings={form.cookSettings ?? DEFAULT_COOK_SETTINGS}
            onChange={(cs) => update('cookSettings', cs)}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-white bg-[#8b5cf6] hover:bg-[#7c3aed] transition-colors"
          >
            <Save className="w-3 h-3" />
            Save Profile
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
