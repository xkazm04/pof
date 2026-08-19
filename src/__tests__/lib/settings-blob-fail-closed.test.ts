// Contract for the four subsystems that keep their ENTIRE configuration as one
// JSON string in a single `settings` row.
//
// Before this contract, all four treated an unparseable value as "nothing is
// configured" and the next write serialised the reconstructed defaults over the
// original bytes. The live `build_profiles` row on this machine is 5,134 bytes /
// 9 profiles, all of which one "I added a profile" click destroyed.
//
// This file deliberately imports ONLY the four stores (never the shared helper),
// so it loads and runs against the pre-change implementations and fails on
// assertions rather than on module resolution.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
testDb.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db');
  return {
    getDb: () => testDb,
    getSetting: (key: string) => {
      const row = testDb.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },
    setSetting: (key: string, value: string) => {
      testDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    },
    __esModule: true,
    default: actual,
  };
});

const loggedErrors: string[] = [];
vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => { loggedErrors.push(args.map(String).join(' ')); },
    warn: () => {},
    info: () => {},
    debug: () => {},
  },
}));

import { getProfiles, upsertProfile, deleteProfile } from '@/lib/packaging/build-profiles-db';
import { getBudgetConfig, setBudgetConfig, getDefaultBudgets } from '@/lib/packaging/size-budgets';
import { getSchedule, setSchedule, getScheduleState, setScheduleState } from '@/lib/packaging/build-schedule-store';
import {
  getGateNotifyConfig, setGateNotifyConfig, getGateNotifyState, setGateNotifyState,
} from '@/lib/notify/gate-notify-store';

// ── helpers ──────────────────────────────────────────────────────────────────

const CORRUPT = '{"profiles":[{"id":"a",'; // truncated write / half-flushed row

function put(key: string, value: string) {
  testDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}
function read(key: string): string | null {
  const row = testDb.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
/** Any key that preserved the unreadable original of `key` — discovered by SQL, not by importing the helper. */
function preserved(key: string): { key: string; value: string }[] {
  return testDb
    .prepare('SELECT key, value FROM settings WHERE key <> ? AND instr(key, ?) = 1 ORDER BY key DESC')
    .all(key, key) as { key: string; value: string }[];
}
/** The 9-profile shape of the live row. */
function nineProfiles(): string {
  return JSON.stringify(
    Array.from({ length: 9 }, (_, i) => ({
      id: `profile-${i}`,
      name: `Profile ${i}`,
      platform: 'Win64',
      configuration: 'Shipping',
      isDefault: i === 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })),
  );
}

beforeEach(() => {
  testDb.exec('DELETE FROM settings');
  loggedErrors.length = 0;
});

// ── build_profiles: the sharpest case ────────────────────────────────────────

describe('build_profiles — a corrupt read must not authorise a write', () => {
  it('refuses the upsert instead of destroying every other profile', () => {
    put('build_profiles', CORRUPT);

    expect(() => upsertProfile({ name: 'New', platform: 'Win64', configuration: 'Shipping' } as never)).toThrow();

    // The original bytes are untouched: nothing was serialised over them.
    expect(read('build_profiles')).toBe(CORRUPT);
  });

  it('preserves the unreadable original under a quarantine key, recoverably', () => {
    const original = nineProfiles();
    put('build_profiles', `${original}TRAILING-GARBAGE`);

    expect(() => upsertProfile({ name: 'New', platform: 'Win64', configuration: 'Shipping' } as never)).toThrow();

    const copies = preserved('build_profiles');
    expect(copies.length).toBe(1);
    expect(copies[0].value).toBe(`${original}TRAILING-GARBAGE`);

    // Repair the row from the preserved copy — the 9 original profiles come back.
    put('build_profiles', copies[0].value.replace('TRAILING-GARBAGE', ''));
    expect(getProfiles().map((p) => p.id)).toEqual(
      Array.from({ length: 9 }, (_, i) => `profile-${i}`),
    );
  });

  it('names the quarantine key in the error it throws', () => {
    put('build_profiles', CORRUPT);
    let message = '';
    try {
      upsertProfile({ name: 'New', platform: 'Win64', configuration: 'Shipping' } as never);
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    const copies = preserved('build_profiles');
    expect(copies.length).toBe(1);
    expect(message).toContain(copies[0].key);
  });

  it('refuses a delete on top of an unreadable value too', () => {
    put('build_profiles', CORRUPT);
    expect(() => deleteProfile('profile-0')).toThrow();
    expect(read('build_profiles')).toBe(CORRUPT);
  });

  it('logs the parse failure instead of silently reporting "no profiles"', () => {
    put('build_profiles', CORRUPT);
    getProfiles();
    expect(loggedErrors.join('\n')).toContain('build_profiles');
  });

  it('rejects a value that parses but is not a list of profiles', () => {
    put('build_profiles', '{"not":"a list"}');
    expect(getProfiles()).toEqual([]);
    expect(() => upsertProfile({ name: 'New', platform: 'Win64', configuration: 'Shipping' } as never)).toThrow();
    expect(read('build_profiles')).toBe('{"not":"a list"}');
  });
});

// ── build_size_budgets: the gate must not quietly switch off ─────────────────

describe('build_size_budgets — a corrupt read is fail-CLOSED', () => {
  it('keeps the regression gate armed when the config cannot be read', () => {
    put('build_size_budgets', '{"budgets":');
    expect(getBudgetConfig().failOnRegression).toBe(true);
  });

  it('distinguishes a deliberately disabled gate from an unreadable one', () => {
    setBudgetConfig({ budgets: getDefaultBudgets(), failOnRegression: false });
    expect(getBudgetConfig().failOnRegression).toBe(false);

    put('build_size_budgets', '{"budgets":');
    expect(getBudgetConfig().failOnRegression).toBe(true);
  });

  it('preserves the unreadable original when the config is replaced outright', () => {
    put('build_size_budgets', '{"budgets":');
    setBudgetConfig({ budgets: getDefaultBudgets(), failOnRegression: true });
    expect(preserved('build_size_budgets').map((c) => c.value)).toEqual(['{"budgets":']);
  });
});

// ── build_schedule: nightly builds must not quietly stop ─────────────────────

describe('build_schedule — a corrupt read must not authorise a write', () => {
  it('refuses to serialise reconstructed defaults over the stored schedule', () => {
    const original = '{"enabled":true,"time":"02:00","days":[1,2,3]';
    put('build_schedule', original);

    expect(() => setSchedule({ enabled: false })).toThrow();
    expect(read('build_schedule')).toBe(original);
    expect(preserved('build_schedule').map((c) => c.value)).toEqual([original]);
  });

  it('reports an unreadable schedule as disabled AND logs it', () => {
    put('build_schedule', '{"enabled":true');
    expect(getSchedule().enabled).toBe(false);
    expect(loggedErrors.join('\n')).toContain('build_schedule');
  });

  it('lets a background cook record its outcome, preserving the unreadable state first', () => {
    put('build_schedule_state', 'not json at all');
    const next = setScheduleState({ lastOutcome: 'success', lastRunAt: '2026-08-19T02:00:00.000Z' });
    expect(next.lastOutcome).toBe('success');
    expect(preserved('build_schedule_state').map((c) => c.value)).toEqual(['not json at all']);
    // A state that could not be read must not claim a build baseline.
    expect(getScheduleState().lastCommit).toBeNull();
  });
});

// ── gate_notify: the webhook URL must not be erased ──────────────────────────

describe('gate_notify — a corrupt read must not erase the webhook', () => {
  it('refuses the patch instead of overwriting the stored URL with an empty string', () => {
    const original = '{"enabled":true,"webhookUrl":"https://hooks.example/abc","target":"slack"';
    put('gate_notify', original);

    expect(() => setGateNotifyConfig({ mode: 'all' })).toThrow();
    expect(read('gate_notify')).toBe(original);
    expect(preserved('gate_notify').map((c) => c.value)).toEqual([original]);
  });

  it('reports an unreadable config as disabled AND logs it', () => {
    put('gate_notify', '{{{');
    expect(getGateNotifyConfig().enabled).toBe(false);
    expect(loggedErrors.join('\n')).toContain('gate_notify');
  });

  it('lets the notifier record a send outcome, preserving the unreadable state first', () => {
    put('gate_notify_state', '[oops]');
    const next = setGateNotifyState({ lastStatus: 'sent', sentCount: 1 });
    expect(next.lastStatus).toBe('sent');
    expect(preserved('gate_notify_state').map((c) => c.value)).toEqual(['[oops]']);
  });
});

// ── the happy path must be byte-identical ────────────────────────────────────

describe('happy path is unchanged', () => {
  it('round-trips profiles and stores exactly the array', () => {
    const created = upsertProfile({ name: 'Ship', platform: 'Win64', configuration: 'Shipping' } as never);
    expect(getProfiles().map((p) => p.id)).toEqual([created.id]);
    expect(read('build_profiles')).toBe(JSON.stringify([created]));
    expect(loggedErrors).toEqual([]);
  });

  it('merges schedule patches over defaults exactly as before', () => {
    setSchedule({ enabled: true, time: '03:30', profileId: 'p-1' });
    const s = getSchedule();
    expect(s.enabled).toBe(true);
    expect(s.time).toBe('03:30');
    expect(s.skipIfUnchanged).toBe(true);
    expect(s.days).toEqual([]);
    expect(read('build_schedule')).toBe(JSON.stringify(s));
  });

  it('merges gate-notify patches over defaults exactly as before', () => {
    setGateNotifyConfig({ enabled: true, webhookUrl: 'https://hooks.example/abc' });
    const c = getGateNotifyConfig();
    expect(c.enabled).toBe(true);
    expect(c.webhookUrl).toBe('https://hooks.example/abc');
    expect(c.target).toBe('slack');
    expect(c.mode).toBe('failures');
    expect(read('gate_notify')).toBe(JSON.stringify(c));
  });

  it('leaves an absent budget config fail-open exactly as before (unconfigured ≠ corrupt)', () => {
    expect(getBudgetConfig()).toEqual({ budgets: getDefaultBudgets(), failOnRegression: false });
    expect(loggedErrors).toEqual([]);
  });

  it('round-trips notify state patches', () => {
    setGateNotifyState({ lastStatus: 'sent', sentCount: 2 });
    setGateNotifyState({ lastDetail: 'ok' });
    const st = getGateNotifyState();
    expect(st.lastStatus).toBe('sent');
    expect(st.sentCount).toBe(2);
    expect(st.lastDetail).toBe('ok');
  });
});
