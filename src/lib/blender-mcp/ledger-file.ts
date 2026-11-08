import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/lib/logger';

/**
 * Local-file persistence for the Blender-MCP generation ledger. Pure fs helpers: tolerant
 * load (anything unreadable is "no file"), atomic temp-then-rename save, and a microtask
 * coalescer so a burst of ledger mutations in one tick costs one write. Every failure
 * degrades to the in-memory-only behaviour, with one warning per failure streak.
 */
export interface LedgerSnapshot<E> {
  epoch: string;
  entries: E[];
}

let writes = 0;
/** Files whose last write failed: one warn per failure streak, cleared by the next success. */
const failing = new Set<string>();

/** Number of file writes performed so far (observability for tests). */
export function ledgerFileWriteCount(): number {
  return writes;
}

/** Default location: `.pof/blender-mcp-ledger.json` (already git-ignored local state). */
export function defaultLedgerPath(): string {
  return path.join(process.cwd(), '.pof', 'blender-mcp-ledger.json');
}

/** Read the snapshot; null when missing, unreadable, corrupt or the wrong shape. Never throws. */
export function loadLedgerFile<E>(file: string): LedgerSnapshot<E> | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    const { epoch, entries } = parsed as { epoch?: unknown; entries?: unknown };
    if (typeof epoch !== 'string' || !epoch || !Array.isArray(entries)) return null;
    return { epoch, entries: entries as E[] };
  } catch {
    return null;
  }
}

/** Write atomically (temp file, then rename). Returns false instead of throwing. */
export function saveLedgerFile<E>(file: string, snapshot: LedgerSnapshot<E>): boolean {
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(snapshot));
    fs.renameSync(tmp, file);
    writes++;
    failing.delete(file);
    return true;
  } catch (e) {
    if (!failing.has(file)) {
      failing.add(file);
      logger.warn(
        `[BlenderMCP] ledger write failed for ${file}: ${e instanceof Error ? e.message : String(e)}; paid jobs will not survive a restart until it recovers`,
      );
    }
    try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
    return false;
  }
}

export function removeLedgerFile(file: string): void {
  try { fs.rmSync(file, { force: true }); } catch { /* ignore */ }
}

/** Coalescing writer: `schedule()` many times in a tick, one `run()` on the microtask. */
export function createCoalescer(run: () => void): { schedule(): void; flush(): void } {
  let pending = false;
  const flush = () => {
    if (!pending) return;
    pending = false;
    run();
  };
  return {
    schedule() {
      if (pending) return;
      pending = true;
      queueMicrotask(flush);
    },
    flush,
  };
}
