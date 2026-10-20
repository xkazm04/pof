import type { GenerationProvider, ImportedObject } from '@/lib/blender-mcp/types';
import type { Result } from '@/types/result';
import {
  createCoalescer,
  defaultLedgerPath,
  loadLedgerFile,
  removeLedgerFile,
  saveLedgerFile,
} from '@/lib/blender-mcp/ledger-file';

/**
 * Server custody of paid, in-flight Blender-MCP generations (Hyper3D / Hunyuan3D).
 *
 * A provider generation is paid at submit and runs for minutes. The server already has
 * everything needed to finish a job it knows about — `pollJobStatus` / `importGeneratedAsset`
 * take only `(jobId, provider)` — so this ledger remembers exactly that (plus the prompt and
 * a state), never credentials. A reloaded forge queue re-adopts the resumable entries via
 * `GET /api/blender-mcp/generate/jobs` instead of the operator paying again.
 *
 * SINGLE-PROCESS, FILE-BACKED: anchored on `globalThis` like the visual-gen
 * `*-job-store.ts` maps so a dev hot-reload keeps it, and written through to
 * `.pof/blender-mcp-ledger.json` (atomic, coalesced) so a real restart rehydrates the
 * paid jobs AND the epoch. A missing, corrupt or unwritable file degrades to the old
 * in-memory behaviour: an empty list under a freshly minted `ownerEpoch`, which is what
 * lets a client say "the server restarted and tracking was lost" rather than reading an
 * empty list as "nothing in flight". Unfinished entries older than 24h are dropped on load.
 */
export type LedgerState = 'generating' | 'completed' | 'imported' | 'failed';

export interface LedgerEntry {
  jobId: string;
  provider: GenerationProvider;
  prompt: string;
  createdAt: number;
  state: LedgerState;
  /** The Blender object the ONE import produced — answers every repeat import. */
  objectName?: string;
}

/** Oldest entries past this are evicted (terminal ones first) — a bounded memo, not a log. */
const MAX_ENTRIES = 200;
/** Unfinished entries older than this are dropped when the file is loaded. */
const UNFINISHED_TTL_MS = 24 * 60 * 60 * 1000;

interface LedgerStore {
  epoch: string;
  /** True when the epoch (and entries) came from the persisted file. */
  restored: boolean;
  entries: Map<string, LedgerEntry>;
  /** In-flight imports, so two concurrent callers share ONE scene import. */
  importing: Map<string, Promise<Result<ImportedObject, string>>>;
}

const g = globalThis as unknown as { pofBlenderMcpLedger?: LedgerStore };

function mintEpoch(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function fresh(): LedgerStore {
  return { epoch: mintEpoch(), restored: false, entries: new Map(), importing: new Map() };
}

function evict(entries: Map<string, LedgerEntry>): void {
  if (entries.size <= MAX_ENTRIES) return;
  const byAge = [...entries.values()].sort((a, b) => a.createdAt - b.createdAt);
  const terminal = byAge.filter((e) => e.state === 'imported' || e.state === 'failed');
  for (const e of [...terminal, ...byAge]) {
    if (entries.size <= MAX_ENTRIES) return;
    entries.delete(e.jobId);
  }
}

/** `undefined` = default path (off under vitest); `null` = persistence disabled. */
let fileOverride: string | null | undefined;

function ledgerFile(): string | null {
  if (fileOverride !== undefined) return fileOverride;
  if (process.env.VITEST) return null;
  return process.env.POF_BLENDER_LEDGER_FILE || defaultLedgerPath();
}

function rehydrate(): LedgerStore {
  const s = fresh();
  const file = ledgerFile();
  const snap = file ? loadLedgerFile<LedgerEntry>(file) : null;
  if (!snap) return s;
  const now = Date.now();
  for (const e of snap.entries) {
    if (!e || typeof e.jobId !== 'string' || typeof e.createdAt !== 'number') continue;
    const unfinished = e.state === 'generating' || e.state === 'completed';
    if (unfinished && now - e.createdAt > UNFINISHED_TTL_MS) continue;
    s.entries.set(e.jobId, e);
  }
  evict(s.entries);
  s.epoch = snap.epoch;
  s.restored = true;
  return s;
}

function store(): LedgerStore {
  if (!g.pofBlenderMcpLedger) g.pofBlenderMcpLedger = rehydrate();
  return g.pofBlenderMcpLedger;
}

const writer = createCoalescer(() => {
  const file = ledgerFile();
  const s = g.pofBlenderMcpLedger;
  if (!file || !s) return;
  saveLedgerFile(file, { epoch: s.epoch, entries: [...s.entries.values()] });
});

function persist(): void {
  if (ledgerFile()) writer.schedule();
}

export const ledger = {
  /** Per-process id; differs after a restart (or `resetLedgerForTest`). */
  get ownerEpoch(): string {
    return store().epoch;
  },

  /** True when the epoch came from disk, i.e. the server restarted but tracking survived. */
  get restored(): boolean {
    return store().restored;
  },

  /** Record a job the provider accepted (and billed). */
  record(input: { jobId: string; provider: GenerationProvider; prompt: string }): LedgerEntry {
    const { entries } = store();
    const entry: LedgerEntry = { ...input, createdAt: Date.now(), state: 'generating' };
    entries.set(input.jobId, entry);
    evict(entries);
    persist();
    return entry;
  },

  get(jobId: string): LedgerEntry | undefined {
    return store().entries.get(jobId);
  },

  /** Move a KNOWN job's state from a status poll. An imported job never regresses. */
  markState(jobId: string, state: Exclude<LedgerState, 'imported'>): void {
    const entry = store().entries.get(jobId);
    if (!entry || entry.state === 'imported') return;
    entry.state = state;
    persist();
  },

  /** The one import happened — recorded even for a job submitted before this process. */
  markImported(jobId: string, provider: GenerationProvider, objectName: string): void {
    const { entries } = store();
    const entry = entries.get(jobId);
    if (entry) {
      entry.state = 'imported';
      entry.objectName = objectName;
      persist();
      return;
    }
    entries.set(jobId, { jobId, provider, prompt: '', createdAt: Date.now(), state: 'imported', objectName });
    evict(entries);
    persist();
  },

  /**
   * Run `doImport` at most once per job: a recorded import answers from the ledger, and a
   * concurrent caller joins the in-flight one. A FAILED import is not recorded, so it can
   * be tried again. `alreadyImported` tells the caller its answer came from the ledger.
   */
  async importOnce(
    jobId: string,
    provider: GenerationProvider,
    doImport: () => Promise<Result<ImportedObject, string>>,
  ): Promise<Result<ImportedObject & { alreadyImported?: true }, string>> {
    const s = store();
    const done = s.entries.get(jobId);
    if (done?.state === 'imported' && done.objectName) {
      return { ok: true, data: { objectName: done.objectName, alreadyImported: true } };
    }
    const pending = s.importing.get(jobId);
    if (pending) return pending;
    const run = doImport()
      .then((result) => {
        if (result.ok) ledger.markImported(jobId, provider, result.data.objectName);
        return result;
      })
      .finally(() => s.importing.delete(jobId));
    s.importing.set(jobId, run);
    return run;
  },

  /** Jobs a reloaded client can re-adopt: paid, not failed, not yet imported. Oldest first. */
  listResumable(): LedgerEntry[] {
    return [...store().entries.values()]
      .filter((e) => e.state === 'generating' || e.state === 'completed')
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((e) => ({ ...e }));
  },
};

/** Test-only: forget every entry AND mint a new epoch, as a process restart would. */
export function resetLedgerForTest(): void {
  const file = ledgerFile();
  if (file) removeLedgerFile(file);
  g.pofBlenderMcpLedger = fresh();
}

/** Test-only: point persistence at a file (`null` restores the default, which is off under vitest). */
export function setLedgerFileForTest(file: string | null): void {
  fileOverride = file === null ? undefined : file;
}

/** Test-only: write any pending snapshot now. */
export function flushLedgerForTest(): void {
  writer.flush();
}

/** Test-only: a process restart - flush, drop the in-memory store, rehydrate lazily from the file. */
export function simulateRestartForTest(): void {
  writer.flush();
  g.pofBlenderMcpLedger = undefined;
}
