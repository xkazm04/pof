import {
  expectArray, readSettingsBlob, updateSettingsBlob,
  type SettingsBlobRead, type SettingsBlobSpec,
} from '@/lib/settings/settings-blob';
import type { BuildProfile, PlatformId } from './build-profiles';

// Re-export everything from the client-safe module so existing server imports still work
export * from './build-profiles';

// ---------- Storage (via settings table) ----------

const PROFILES_KEY = 'build_profiles';

/**
 * Every profile the user owns lives as one JSON array in a single `settings`
 * row — 5,134 bytes / 9 profiles on the machine this was written on.
 *
 * `loadProfiles` used to answer an unparseable row with `[]`, and `upsertProfile`
 * then pushed one record onto that empty list and saved: every other profile
 * destroyed by an operation the user experiences as "I added a profile". The
 * corrupt default is still `[]` (nothing truer exists to hand a reader), but it
 * is now logged, flagged, and — decisively — it cannot authorise a write.
 */
const PROFILES_SPEC: SettingsBlobSpec<BuildProfile[]> = {
  key: PROFILES_KEY,
  absent: () => [],
  corrupt: () => [],
  hydrate: (parsed) => expectArray(parsed, 'build profiles') as BuildProfile[],
};

function loadProfiles(): BuildProfile[] {
  return readSettingsBlob(PROFILES_SPEC).value;
}

/**
 * The full read, for a caller that wants to REPORT an unreadable profile list
 * rather than render it as "you have no profiles". `corrupt` and `reason` are
 * safe to surface verbatim.
 */
export function readProfiles(): SettingsBlobRead<BuildProfile[]> {
  return readSettingsBlob(PROFILES_SPEC);
}

export function getProfiles(): BuildProfile[] {
  return loadProfiles();
}

export function getProfile(id: string): BuildProfile | null {
  return loadProfiles().find((p) => p.id === id) ?? null;
}

export function getDefaultProfile(platform: PlatformId): BuildProfile | null {
  return loadProfiles().find((p) => p.platform === platform && p.isDefault) ?? null;
}

/**
 * Throws `SettingsBlobCorruptError` when the stored list cannot be read — the
 * original bytes are preserved under a quarantine key first, and the message
 * names it. Both API routes wrap this in `withRoute`/try-catch, so the reason
 * reaches the client instead of the profiles reaching the bin.
 */
export function upsertProfile(profile: Omit<BuildProfile, 'createdAt' | 'updatedAt'> & { id?: string }): BuildProfile {
  const now = new Date().toISOString();
  const id = profile.id || `profile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let record!: BuildProfile;

  updateSettingsBlob(PROFILES_SPEC, (profiles) => {
    const existing = profiles.findIndex((p) => p.id === id);
    record = {
      ...profile,
      id,
      createdAt: existing >= 0 ? profiles[existing].createdAt : now,
      updatedAt: now,
    };

    // If setting as default, unset other defaults for same platform
    if (record.isDefault) {
      for (const p of profiles) {
        if (p.platform === record.platform && p.id !== id) {
          p.isDefault = false;
        }
      }
    }

    if (existing >= 0) {
      profiles[existing] = record;
    } else {
      profiles.push(record);
    }
    return profiles;
  });

  return record;
}

/** Throws `SettingsBlobCorruptError` on an unreadable list — see {@link upsertProfile}. */
export function deleteProfile(id: string): boolean {
  const read = readSettingsBlob(PROFILES_SPEC);
  // A readable list with no such profile is a no-op, and stays a no-op: no write.
  // An UNREADABLE list falls through to the guarded write, which refuses.
  if (!read.corrupt && !read.value.some((p) => p.id === id)) return false;

  let deleted = false;
  updateSettingsBlob(PROFILES_SPEC, (profiles) => {
    const filtered = profiles.filter((p) => p.id !== id);
    deleted = filtered.length !== profiles.length;
    return filtered;
  });
  return deleted;
}
