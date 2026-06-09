/**
 * Server-only accessor that binds the pure asset-library DB layer to the shared
 * `getDb()` connection and guarantees its schema exists. Routes call
 * `getLibraryDb()`; the pure functions in `asset-library-db.ts` stay free of any
 * `@/lib/db` import so they remain trivially unit-testable against `:memory:`.
 */

import { getDb } from '@/lib/db';
import { createAssetLibraryDb } from '@/lib/visual-gen/asset-library-db';

let ready = false;

export function getLibraryDb() {
  const db = getDb();
  if (!ready) {
    createAssetLibraryDb(db);
    ready = true;
  }
  return db;
}
