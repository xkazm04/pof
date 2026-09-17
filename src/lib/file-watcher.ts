/**
 * Server-side UE5 Source/ directory watcher.
 *
 * Uses Node.js fs.watch (recursive) to detect .h/.cpp file changes,
 * extracts UCLASS/USTRUCT/UENUM declarations from modified headers,
 * and notifies subscribers via a simple event emitter pattern.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { clearSelfWrites, consumeSelfWrite } from './self-write-ledger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted';
  /** Relative path from Source/ */
  relativePath: string;
  /** Absolute path on disk */
  absolutePath: string;
  /** For .h files: extracted UE declarations */
  declarations: ScannedDeclaration[];
  timestamp: string;
}

export interface ScannedDeclaration {
  name: string;
  kind: 'UCLASS' | 'USTRUCT' | 'UENUM';
  prefix: 'A' | 'U' | 'F' | 'E' | '';
}

export interface WatcherState {
  projectPath: string;
  watching: boolean;
  lastEvent: string | null;
  subscriberCount: number;
}

type Subscriber = (events: FileChangeEvent[]) => void;

// ─── Header Parser ───────────────────────────────────────────────────────────

const DECORATOR_REGEX = /U(CLASS|STRUCT|ENUM)\s*\([^)]*\)\s*(?:class|struct|enum)\s+(?:class\s+)?(?:\w+_API\s+)?(\w+)/g;

/** Read a file, or null when it is unreadable or gone. */
async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await fsPromises.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** Extract UE declarations from header text already in hand. */
export function parseDeclarations(content: string): ScannedDeclaration[] {
  const results: ScannedDeclaration[] = [];
  let match;

  DECORATOR_REGEX.lastIndex = 0;
  while ((match = DECORATOR_REGEX.exec(content)) !== null) {
    const kind = `U${match[1]}` as ScannedDeclaration['kind'];
    const name = match[2];
    const prefix = (name[0] === 'A' || name[0] === 'U' || name[0] === 'F' || name[0] === 'E')
      ? name[0] as 'A' | 'U' | 'F' | 'E'
      : '' as const;
    results.push({ name, kind, prefix });
  }
  return results;
}

export async function parseHeaderDeclarations(filePath: string): Promise<ScannedDeclaration[]> {
  const content = await readIfExists(filePath);
  return content === null ? [] : parseDeclarations(content);
}

// ─── Watcher Singleton ───────────────────────────────────────────────────────

let activeWatcher: fs.FSWatcher | null = null;
let activeProjectPath: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingChanges = new Map<string, 'created' | 'modified' | 'deleted'>();
const subscribers = new Set<Subscriber>();

const DEBOUNCE_MS = 500;

function isSourceFile(filename: string): boolean {
  return filename.endsWith('.h') || filename.endsWith('.cpp');
}

async function flushChanges() {
  if (pendingChanges.size === 0 || !activeProjectPath) return;

  const sourceRoot = path.join(activeProjectPath, 'Source');
  const changes = new Map(pendingChanges);
  pendingChanges.clear();

  const events: FileChangeEvent[] = [];
  const now = new Date().toISOString();

  for (const [relativePath, changeType] of changes) {
    const absolutePath = path.join(sourceRoot, relativePath);

    // Our own writes land in the tree we watch, under names indistinguishable
    // from hand-authored ones, and every event we emit is counted downstream as
    // evidence that the user's project grew (a checklist item goes green, a
    // re-scan fires). So the write door claims its bytes before writing and the
    // echo is dropped here — matched on content, consumed once, expiring. A
    // foreign edit to the same path, before or after, is still an event.
    const content = changeType === 'deleted' ? null : await readIfExists(absolutePath);
    if (changeType !== 'deleted' && consumeSelfWrite(absolutePath, content)) continue;

    let declarations: ScannedDeclaration[] = [];
    if (changeType !== 'deleted' && relativePath.endsWith('.h') && content !== null) {
      declarations = parseDeclarations(content);
    }

    events.push({
      type: changeType,
      relativePath,
      absolutePath,
      declarations,
      timestamp: now,
    });
  }

  if (events.length > 0) {
    for (const sub of subscribers) {
      try { sub(events); } catch { /* ignore broken subscribers */ }
    }
  }
}

async function detectChangeType(absolutePath: string): Promise<'created' | 'modified' | 'deleted'> {
  try {
    await fsPromises.access(absolutePath);
    // File exists — could be new or modified, we'll call it 'modified'
    // (fs.watch doesn't distinguish create vs modify)
    return 'modified';
  } catch {
    return 'deleted';
  }
}

export function startWatching(projectPath: string): boolean {
  // Already watching the same path
  if (activeWatcher && activeProjectPath === projectPath) return true;

  // Stop existing watcher if watching a different path
  stopWatching();

  const sourceDir = path.join(projectPath, 'Source');
  try {
    fs.accessSync(sourceDir);
  } catch {
    return false; // Source/ doesn't exist
  }

  try {
    activeWatcher = fs.watch(sourceDir, { recursive: true }, (eventType, filename) => {
      if (!filename || !isSourceFile(filename)) return;

      const normalizedPath = filename.replace(/\\/g, '/');
      const absolutePath = path.join(sourceDir, filename);

      // Determine change type asynchronously
      detectChangeType(absolutePath).then((changeType) => {
        pendingChanges.set(normalizedPath, changeType);

        // Debounce: batch rapid changes (e.g., Claude writing multiple files)
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(flushChanges, DEBOUNCE_MS);
      });
    });

    activeProjectPath = projectPath;
    return true;
  } catch {
    return false;
  }
}

export function stopWatching(): void {
  if (activeWatcher) {
    activeWatcher.close();
    activeWatcher = null;
  }
  activeProjectPath = null;
  pendingChanges.clear();
  // Claims are per-watched-tree: a claim nobody will ever match again must not
  // survive into the next project's watch.
  clearSelfWrites();
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

export function subscribe(callback: Subscriber): () => void {
  subscribers.add(callback);
  return () => { subscribers.delete(callback); };
}

export function getWatcherState(): WatcherState {
  return {
    projectPath: activeProjectPath ?? '',
    watching: activeWatcher !== null,
    lastEvent: null,
    subscriberCount: subscribers.size,
  };
}
