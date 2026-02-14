import { getDb } from '@/lib/db';
import type { BuildProfile, PlatformId } from './build-profiles';

// Re-export everything from the client-safe module so existing server imports still work
export * from './build-profiles';

// ---------- Storage (via settings table) ----------

const PROFILES_KEY = 'build_profiles';

function loadProfiles(): BuildProfile[] {
  const raw = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(PROFILES_KEY) as { value: string } | undefined;
  if (!raw) return [];
  try {
    return JSON.parse(raw.value);
  } catch {
    return [];
  }
}

function saveProfiles(profiles: BuildProfile[]): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(PROFILES_KEY, JSON.stringify(profiles));
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

export function upsertProfile(profile: Omit<BuildProfile, 'createdAt' | 'updatedAt'> & { id?: string }): BuildProfile {
  const profiles = loadProfiles();
  const now = new Date().toISOString();
  const id = profile.id || `profile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const existing = profiles.findIndex((p) => p.id === id);
  const record: BuildProfile = {
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

  saveProfiles(profiles);
  return record;
}

export function deleteProfile(id: string): boolean {
  const profiles = loadProfiles();
  const filtered = profiles.filter((p) => p.id !== id);
  if (filtered.length === profiles.length) return false;
  saveProfiles(filtered);
  return true;
}
