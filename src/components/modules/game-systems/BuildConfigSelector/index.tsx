'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import type { CookCompletion } from '@/components/modules/game-systems/CookProgress/types';
import { PreflightPanel, type PreflightStatusSummary } from '../PreflightPanel';
import { SmokeTest, type SmokeTestRequest } from '../SmokeTest';
import { NightlyBuildScheduler } from '../NightlyBuildScheduler';
import { GateNotifySettings } from '../GateNotifySettings';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { PLATFORM_ICONS } from './constants';
import { ProfileEditor } from './ProfileEditor';
import { AddPlatformButtons } from './AddPlatformButtons';
import { PreflightGateBlock } from './PreflightGateBlock';
import { packageFlow, INITIAL_PACKAGE_FLOW, type PackageFlowEvent, type PackageFlowState } from '@/lib/packaging/package-flow';

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

  // Pre-flight gate: Package is a flow (`package-flow.ts`), not a boolean. A press
  // measures the PRESSED profile's maps with the fast pre-flight before its cook can
  // start; a failing or unmeasurable gate blocks until the operator runs the checks,
  // overrides, or cancels. The summary starts unmeasured (mapsKey null), so an early
  // press waits for the gate instead of cooking on zero checks.
  const [preflight, setPreflight] = useState<PreflightStatusSummary>({
    canCook: true, overall: 'idle', fullyCovered: false,
    notRunLabels: [], notRunKinds: [], coverage: { ran: 0, total: 0 },
    mapsKey: null, failing: [], failingKinds: [], running: [],
  });
  const [flow, setFlow] = useState<PackageFlowState>(INITIAL_PACKAGE_FLOW);
  const flowRef = useRef<PackageFlowState>(INITIAL_PACKAGE_FLOW);

  // The pre-flight panel measures the maps a cook will actually ship: the pressed
  // profile's while a Package flow is live, else the default profile's (else the
  // first). The panel names which profile it took them from.
  const defaultProfile = useMemo(
    () => profiles.find((p) => p.isDefault) ?? profiles[0] ?? null,
    [profiles],
  );
  const flowProfile = flow.phase === 'idle' ? null : profiles.find((p) => p.id === flow.profileId) ?? null;
  const gateProfile = flowProfile ?? defaultProfile;
  const gateMaps = flow.phase === 'idle' ? defaultProfile?.cookSettings.mapsToInclude ?? [] : flow.maps;
  const requestedChecks = useMemo(
    () => (flow.phase === 'measuring' ? { token: flow.seq, kinds: flow.kinds } : null),
    [flow],
  );

  // After a successful Win64 cook, auto-run the runnable-exe smoke-test — against the
  // build row the cook RECORDED, by id. No recorded row means nothing to smoke or
  // condemn, and the panel says so instead of guessing a build.
  const [smokeRequest, setSmokeRequest] = useState<SmokeTestRequest | null>(null);
  const [smokeSkipped, setSmokeSkipped] = useState<string | null>(null);

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

  // Advance the Package flow. The cook request is issued only on the transition
  // INTO `cook`, capturing the project at that moment.
  const step = useCallback((event: PackageFlowEvent) => {
    const prev = flowRef.current;
    const next = packageFlow(prev, event);
    if (next === prev) return;
    flowRef.current = next;
    setFlow(next);
    if (next.phase === 'cook' && prev.phase !== 'cook') {
      setCookRequest({ profileId: next.profileId, projectPath, projectName, ueVersion });
    }
  }, [projectPath, projectName, ueVersion]);

  const handlePreflightStatus = useCallback((summary: PreflightStatusSummary) => {
    setPreflight(summary);
    step({ type: 'summary', summary });
  }, [step]);

  // Package: a press never cooks on its own; the flow decides from THIS profile's gate.
  const handlePackage = useCallback((profile: BuildProfile) => {
    if (cookRequest !== null) return;
    step({ type: 'press', profileId: profile.id, maps: profile.cookSettings.mapsToInclude ?? [], summary: preflight });
  }, [cookRequest, preflight, step]);

  // Also called for a cook this panel did not start: the console reattaches to the
  // project's server cook job after a reload, or to a running nightly. A refused start
  // (409: the project is busy) settles here too, and clearing the request lets the
  // console attach to the job that holds the project.
  const handleCookComplete = useCallback((result: CookCompletion) => {
    const profileId = result.profileId ?? cookRequest?.profileId;
    setCookRequest(null);
    step({ type: 'settled' });
    if (result.status !== 'success') return;
    fetchProfiles();
    // The nightly chain runs (and records) its own smoke-test.
    if (result.kind === 'nightly') return;

    // Kick off the post-cook smoke-test for runnable (Win64) builds, naming the
    // recorded build: the server launches, watches and condemns exactly that row.
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile || profile.platform !== 'Win64') return;
    if (result.buildId != null) {
      setSmokeSkipped(null);
      setSmokeRequest({ buildId: result.buildId });
    } else {
      setSmokeRequest(null);
      setSmokeSkipped(
        `the cook finished but its build was not recorded (${result.recordError ?? 'no build id'}), `
        + 'so there is no build to smoke-test or condemn.',
      );
    }
  }, [cookRequest, profiles, fetchProfiles, step]);

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
          cookMaps={gateMaps}
          cookProfileName={gateProfile?.name}
          requestedChecks={requestedChecks}
          onStatusChange={handlePreflightStatus}
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

      {/* Package flow notice: measuring / blocked (run missing, override, cancel) / cook disclosure */}
      <PreflightGateBlock
        flow={flow}
        profileName={flowProfile?.name}
        onCancel={() => step({ type: 'cancel' })}
        onOverride={() => step({ type: 'override' })}
        onMeasureMissing={() => step({ type: 'measure-missing' })}
      />

      {/* Cook progress */}
      <CookProgress request={cookRequest} projectPath={projectPath} onComplete={handleCookComplete} />

      {/* Post-cook runnable-exe smoke-test */}
      <SmokeTest key={smokeRequest?.buildId ?? 'idle'} request={smokeRequest} skippedReason={smokeSkipped} />

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
