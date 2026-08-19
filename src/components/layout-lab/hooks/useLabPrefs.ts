'use client';
import { useSyncExternalStore } from 'react';

/** The lab's three top-level screens. Persisted so a reload reopens the one you left. */
export type LabView = 'catalogs' | 'canon' | 'matrix';

export interface LabPrefs {
  themeId: 'light' | 'dark';
  lastCatalogId?: string;
  lastEntityId?: string | null;
  /**
   * The pipeline step the catalogs view was last on, as an index into the OPEN catalog's
   * step list. Stored beside the catalog/entity because "reopens where you left off" is a
   * location, and a location missing its step drops you at step 01 of a pipeline that can be
   * 20 steps long — on every reload, and on every return from the full-page /status and /3d
   * jumps in the header.
   *
   * Deliberately an index into a list that can CHANGE (a catalog's pipeline can shrink), so
   * the reader clamps: an out-of-range restore falls back to the first step. Deliberately NOT
   * url-shaped either — this is the same local prefs blob the shell already owns, so it adds
   * no query params and no history entries.
   */
  lastStepIdx?: number;
  /** Which top-level view was open (catalogs / matrix / canon). */
  lastView?: LabView;
  /**
   * When each catalog was last OPENED (ISO), keyed by catalogId — the baseline the
   * "what moved since I was last here" digest compares against.
   *
   * Per catalog, not per app: PoF is worked by parallel sessions, headless drains and MCP
   * writers, and the question that matters is what moved in the catalog you are opening.
   * Absent for a catalog you have never opened, which reads as "no baseline yet" — NEVER as
   * "everything changed".
   */
  lastVisitByCatalog?: Record<string, string>;
}

const KEY = 'pof-lab-prefs';
const DEFAULTS: LabPrefs = { themeId: 'light' };

function parse(raw: string | null): LabPrefs {
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<LabPrefs>;
    const visits = parsed.lastVisitByCatalog;
    return {
      themeId: parsed.themeId === 'dark' ? 'dark' : 'light',
      lastCatalogId: typeof parsed.lastCatalogId === 'string' ? parsed.lastCatalogId : undefined,
      lastEntityId: typeof parsed.lastEntityId === 'string' ? parsed.lastEntityId : null,
      // A stored step index is only ever a non-negative integer. Anything else (a negative,
      // a float, a string, a hand-edited blob) is dropped here rather than reaching the
      // shell — the shell's own range clamp is the second line of defence, not the first.
      ...(Number.isInteger(parsed.lastStepIdx) && (parsed.lastStepIdx as number) >= 0
        ? { lastStepIdx: parsed.lastStepIdx as number } : {}),
      ...(isLabView(parsed.lastView) ? { lastView: parsed.lastView } : {}),
      ...(visits && typeof visits === 'object' ? { lastVisitByCatalog: onlyStrings(visits) } : {}),
    };
  } catch {
    return DEFAULTS;
  }
}

function isLabView(v: unknown): v is LabView {
  return v === 'catalogs' || v === 'canon' || v === 'matrix';
}

/** Keep only `catalogId → ISO string` entries — a corrupt map must not reach the digest. */
function onlyStrings(map: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) if (typeof v === 'string') out[k] = v;
  return out;
}

/**
 * ONE shared snapshot for every consumer, memoized on the RAW stored string.
 *
 * It used to be per-hook React state seeded once at hydration, which was safe only while
 * exactly one component wrote prefs: a second writer would merge its patch into ITS OWN
 * stale copy and write the whole object back, silently dropping the first writer's fields.
 * Reading through the stored string instead means every consumer sees the same prefs, a
 * write from anywhere is visible everywhere, and an edit made in another tab is picked up on
 * the next render rather than being overwritten.
 */
let lastRaw: string | null = null;
let cached: LabPrefs = DEFAULTS;

function snapshot(): LabPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { return cached; }
  if (raw !== lastRaw) { lastRaw = raw; cached = parse(raw); }
  return cached;
}

const listeners = new Set<() => void>();
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/**
 * Merge a patch into the stored prefs and notify every consumer. A plain module function on
 * purpose: it writes an EXTERNAL system (localStorage), so it is safe to call from an effect
 * — which is exactly what "record that this catalog was opened" needs.
 */
export function setLabPrefs(patch: Partial<LabPrefs>): void {
  const next = { ...snapshot(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* storage full/blocked — keep the in-memory value */ }
  // Adopt the merged value AND the raw string it was written as, so the next snapshot serves
  // it without re-parsing. A write that was blocked leaves the in-memory value in force —
  // the same degradation the previous implementation chose.
  cached = next;
  lastRaw = safeRead();
  for (const l of listeners) l();
}

function safeRead(): string | null {
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}

/** True only after hydration — gates reading localStorage so SSR + first client render agree. */
const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export function useLabPrefs() {
  const hydrated = useHydrated();
  const stored = useSyncExternalStore(subscribe, snapshot, () => DEFAULTS);
  return { prefs: hydrated ? stored : DEFAULTS, setPrefs: setLabPrefs, hydrated };
}
