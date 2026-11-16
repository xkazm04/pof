import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';

const dbHolder = vi.hoisted(() => ({ current: null as Database.Database | null }));

vi.mock('@/lib/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db')>()),
  getDb: () => dbHolder.current,
}));

import { getAudioDb } from '@/lib/audio-db-conn';

function hasTable(db: Database.Database, name: string): boolean {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
}

/** Every lazy-schema *-db module keys its DDL guard on the live handle so a swapped
 *  connection re-runs the DDL; audio-db-conn used a process-wide boolean. */
describe('getAudioDb ensures the audio schema per connection', () => {
  it('a swapped connection gets the audio tables too', () => {
    const a = new Database(':memory:');
    const b = new Database(':memory:');
    dbHolder.current = a;
    expect(getAudioDb()).toBe(a);
    expect(hasTable(a, 'audio_sets')).toBe(true);
    dbHolder.current = b;
    expect(getAudioDb()).toBe(b);
    expect(hasTable(b, 'audio_sets')).toBe(true);
    expect(hasTable(b, 'audio_import_runs')).toBe(true);
    a.close();
    b.close();
  });
});
