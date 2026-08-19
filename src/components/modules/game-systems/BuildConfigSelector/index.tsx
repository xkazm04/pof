'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { RefreshCw, Wrench, Rocket } from 'lucide-react';
import {
  type BuildProfile, type PlatformId,
  SUPPORTED_PLATFORMS, createDefaultProfile,
} from '@/lib/packaging/build-profiles';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';
import { generateUATCommand } from '@/lib/packaging/uat-command-generator';
import { PlatformProfileCard } from '../PlatformProfileCard';
import { CookProgress } from '../CookProgress';
import { PreflightPanel, type PreflightStatusSummary } from '../PreflightPanel';
import { SmokeTest, type SmokeTestRequest } from '../SmokeTest';
import { NightlyBuildScheduler } from '../NightlyBuildScheduler';
import { GateNotifySettings } from '../GateNotifySettings';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { PLATFORM_ICONS } from './constants';
import { ProfileEditor } from './ProfileEditor';
import { AddPlatformButtons } from './AddPlatformButtons';
import { PreflightGateBlock } from './PreflightGateBlock';

// ---------- Main component ----------

export function BuildConfigSelector() {
  const [profiles, setProfiles] = useState<BuildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Partial<BuildProfile> | null>(null);

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  // UAT commands are a pure, deterministic function of (profile, projectPath,
  // projectName, ueVersion) — the same generator the server used to run per
  // profile over a chatty POST loop. Computed client-side; identical output.
  const uatCommands = useMemo(() => {
    const cmds: Record<string, string> = {};
    for (const p of profiles) {
      try {
        cmds[p.id] = generateUATCommand(p, projectPath, projectName, ueVersion);
      } catch { /* skip command generation failures */ }
    }
    return cmds;
  }, [profiles, projectPath, projectName, ueVersion]);

  const [cookRequest, setCookRequest] = useState<{
    profileId: string; projectPath: string; projectName: string; ueVersion: string;
  } | null>(null);

  // Pre-flight gate: a failing check blocks the cook until the operator fixes
  // it or explicitly overrides. Catches the build-config defect class before a
  // long cook starts rather than 20 minutes in.
  const [preflight, setPreflight] = useState<PreflightStatusSummary>({ canCook: true, overall: 'idle' });
  const [gateBlock, setGateBlock] = useState<BuildProfile | null>(null);

  // After a successful Win64 cook, auto-run the runnable-exe smoke-test.
  const [smokeRequest, setSmokeRequest] = useState<SmokeTestRequest | null>(null);

  // Fetch profiles
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ profiles: BuildProfile[] }>('/api/packaging/profiles');
      setProfiles(data.profiles ?? []);
    } catch (e) {
      console.error('Failed to fetch profiles:', e);
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (cookRequest !== null) return;
    if (!preflight.canCook) {
      setGateBlock(profile);
      return;
    }
    setGateBlock(null);
    setCookRequest({
      profileId: profile.id,
      projectPath,
      projectName,
      ueVersion,
    });
  }, [cookRequest, preflight.canCook, projectPath, projectName, ueVersion]);

  // Override the pre-flight gate and cook anyway (operator's explicit choice).
  const handleOverridePackage = useCallback(() => {
    if (cookRequest !== null || !gateBlock) return;
    const profile = gateBlock;
    setGateBlock(null);
    setCookRequest({ profileId: profile.id, projectPath, projectName, ueVersion });
  }, [cookRequest, gateBlock, projectPath, projectName, ueVersion]);

  const handleCookComplete = useCallback((result: { status: 'success' | 'failed'; exePath?: string }) => {
    const profileId = cookRequest?.profileId;
    setCookRequest(null);
    if (result.status !== 'success') return;
    fetchProfiles();

    // Kick off the post-cook smoke-test for runnable (Win64) builds.
    const profile = profiles.find((p) => p.id === profileId);
    if (result.exePath && profile && profile.platform === 'Win64') {
      setSmokeRequest({
        exePath: result.exePath,
        projectName,
        platform: profile.platform,
        config: profile.config,
        // The project MUST travel: without it the server chooses the build to record
        // the verdict against with an unscoped query, and it lands on whichever
        // unattributed legacy row is newest rather than on the build just cooked.
        projectPath,
      });
    }
  }, [cookRequest, profiles, projectName, projectPath, fetchProfiles]);

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
          <Rocket className="w-4 h-4" style={{ color: MODULE_COLORS.systems }} />
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
      <AddPlatformButtons
        unusedPlatforms={unusedPlatforms}
        profiles={profiles}
        grouped={grouped}
        onNewProfile={handleNewProfile}
      />

      {/* Pre-flight gate */}
      {projectPath && projectName && (
        <PreflightPanel
          projectPath={projectPath}
          projectName={projectName}
          ueVersion={ueVersion}
          onStatusChange={setPreflight}
        />
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
                  data-testid={`pof-module-packaging-add-platform-${p.id.toLowerCase()}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border-bright text-xs text-text-muted hover:border-[var(--systems)]/50 hover:bg-surface-hover transition-colors"
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

      {/* Pre-flight gate block notice */}
      <PreflightGateBlock
        visible={!!gateBlock}
        onCancel={() => setGateBlock(null)}
        onOverride={handleOverridePackage}
      />

      {/* Cook progress */}
      <CookProgress request={cookRequest} onComplete={handleCookComplete} />

      {/* Post-cook runnable-exe smoke-test */}
      <SmokeTest key={smokeRequest?.exePath ?? 'idle'} request={smokeRequest} />

      {/* Unattended nightly builds (preflight → cook → smoke → size-budget, skip-if-unchanged) */}
      <NightlyBuildScheduler profiles={profiles} />

      {/* Opt-in webhook ping when a test-gate verdict changes during a drain */}
      <GateNotifySettings />

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
