'use client';

import { useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  type BuildProfile, type PlatformId,
  SUPPORTED_PLATFORMS,
  DEFAULT_COOK_SETTINGS, DEFAULT_PLATFORM_SETTINGS,
} from '@/lib/packaging/build-profiles';
import { CookSettingsPanel } from '../CookSettingsPanel';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { CONFIG_OPTIONS } from './constants';

/**
 * Rendered only while open by BuildConfigSelector (`{showEditor && editingProfile
 * && <ProfileEditor … />}`), so `open` is fixed — the shared Modal restores
 * focus to the trigger on unmount. Modal owns the header, backdrop, Escape,
 * focus trap and focus restore; this file supplies the form only.
 */
export function ProfileEditor({ profile, onSave, onClose }: {
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

  // `.focus-ring` is the shared keyboard focus indicator; the old
  // `focus:border-…/50` only tinted a border, which is not a focus ring.
  const selectClass = 'bg-background border border-border-bright rounded px-2 py-1 text-xs text-text-muted outline-none focus-ring w-full';
  const inputClass = 'bg-background border border-border-bright rounded px-2 py-1 text-xs text-text-muted font-mono outline-none focus-ring w-full';

  return (
    <Modal
      open
      onClose={onClose}
      title={profile.id ? 'Edit Profile' : 'New Profile'}
      icon={<Settings className="w-4 h-4" style={{ color: MODULE_COLORS.systems }} />}
      className="max-w-lg"
    >
      <>
        <div className="py-1 space-y-4">
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
                  data-testid={`pof-module-packaging-config-${opt.value.toLowerCase()}`}
                  className={`px-2 py-1.5 rounded border text-xs font-medium text-center transition-colors ${
                    form.config === opt.value
                      ? 'border-[var(--systems)] bg-[var(--systems)]/15 text-text'
                      : 'border-border-bright text-text-muted hover:border-[var(--systems)]/30'
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
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={form.stage ?? true}
                onChange={(e) => update('stage', e.target.checked)}
                className="accent-[var(--systems)]"
              />
              Stage
            </label>
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={form.archive ?? false}
                onChange={(e) => update('archive', e.target.checked)}
                className="accent-[var(--systems)]"
              />
              Archive
            </label>
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={form.runAfterPackage ?? false}
                onChange={(e) => update('runAfterPackage', e.target.checked)}
                className="accent-[var(--systems)]"
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
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-ring"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-white bg-[var(--systems)]/80 hover:bg-[var(--systems)] transition-colors focus-ring"
          >
            <Save className="w-3 h-3" />
            Save Profile
          </button>
        </div>
      </>
    </Modal>
  );
}
