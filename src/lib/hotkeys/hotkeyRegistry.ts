/**
 * The keyboard door: ONE window keydown listener that owns every chord, the
 * Escape layer stack and exclusive key capture for the legacy shell.
 *
 * - **One owner per chord.** A keydown matching several registrations fires
 *   exactly one: the innermost active scope (`module:*` beats `shell`), and
 *   within a scope the last registered. Two owners of one chord in the SAME
 *   scope is misuse — reported by `collisions()` and one `logger.warn`.
 * - **Escape is a LIFO layer stack**, not a chord. `pushLayer(id, close)`
 *   stacks a dismissible layer; one Escape pops and closes ONLY the top one.
 * - **Exclusive capture.** `captureNext(handler)` takes the next keydown
 *   before anything else sees it (capture phase, `stopPropagation`) — once —
 *   and is released by the returned function, so a hidden owner can let go.
 *
 * Pure of React: the suspend-aware hooks live in `@/hooks/useHotkey`.
 * Chord grammar: `mod+k`, `ctrl+b`, `ctrl+1` — `+`-joined modifiers
 * (`mod` = Ctrl OR Meta, `ctrl`, `meta`, `shift`, `alt`) then the key, compared
 * to `KeyboardEvent.key` exactly. Listed modifiers are required; unlisted ones
 * are not checked (parity with the listeners this replaced).
 */
import { logger } from '@/lib/logger';

export type HotkeyScope = 'shell' | `module:${string}`;

export interface HotkeyOptions {
  /** Default `shell`. A `module:*` registration outranks every `shell` one. */
  scope?: HotkeyScope;
  /** Owner name reported by `collisions()`. */
  id?: string;
  /** Fire even when focus is in an input/textarea/select/contenteditable. Default false. */
  allowInInput?: boolean;
}

export interface HotkeyCollision {
  chord: string;
  scope: HotkeyScope;
  owners: string[];
}

export type HotkeyHandler = (e: KeyboardEvent) => void;

export interface HotkeyRegistry {
  /** Register a chord; returns its unregister (idempotent). */
  register(chord: string, handler: HotkeyHandler, opts?: HotkeyOptions): () => void;
  /** Stack an Escape layer; returns its pop (idempotent). Escape pops it too. */
  pushLayer(id: string, close: () => void): () => void;
  /** Take the next keydown exclusively (one-shot); returns its release (idempotent). */
  captureNext(handler: HotkeyHandler): () => void;
  /** Same-scope duplicate owners among the live registrations. */
  collisions(): HotkeyCollision[];
  /** Live Escape layer ids, bottom first. */
  layers(): string[];
  /** Drop everything and detach the listeners (tests). */
  reset(): void;
}

interface ParsedChord { key: string; mod: boolean; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean }
interface Registration { chord: string; parsed: ParsedChord; scope: HotkeyScope; id: string; handler: HotkeyHandler; allowInInput: boolean; seq: number }
interface Layer { id: string; close: () => void }
interface Capture { handler: HotkeyHandler }

export function parseChord(chord: string): ParsedChord {
  const parts = chord.split('+');
  const key = parts.pop() ?? '';
  const mods = new Set(parts.map((p) => p.toLowerCase()));
  return { key, mod: mods.has('mod'), ctrl: mods.has('ctrl'), meta: mods.has('meta'), shift: mods.has('shift'), alt: mods.has('alt') };
}

export function matchesChord(p: ParsedChord, e: KeyboardEvent): boolean {
  if (e.key !== p.key) return false;
  if (p.mod && !(e.ctrlKey || e.metaKey)) return false;
  if (p.ctrl && !e.ctrlKey) return false;
  if (p.meta && !e.metaKey) return false;
  if (p.shift && !e.shiftKey) return false;
  if (p.alt && !e.altKey) return false;
  return true;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).tagName !== 'string') return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

const scopeDepth = (scope: HotkeyScope): number => (scope === 'shell' ? 0 : 1);

export function createHotkeyRegistry(): HotkeyRegistry {
  let regs: Registration[] = [];
  let layerStack: Layer[] = [];
  let captures: Capture[] = [];
  let seq = 0;
  let attachedTo: Window | null = null;

  const onKeyDownCapture = (e: KeyboardEvent) => {
    const capture = captures.pop();
    if (!capture) return;
    e.preventDefault();
    e.stopPropagation();
    sync();
    capture.handler(e);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && layerStack.length > 0) {
      const top = layerStack.pop()!;
      e.preventDefault();
      sync();
      top.close();
      return;
    }
    const typing = isTypingTarget(e.target);
    let owner: Registration | null = null;
    for (const r of regs) {
      if (typing && !r.allowInInput) continue;
      if (!matchesChord(r.parsed, e)) continue;
      if (!owner || scopeDepth(r.scope) > scopeDepth(owner.scope)
        || (scopeDepth(r.scope) === scopeDepth(owner.scope) && r.seq > owner.seq)) owner = r;
    }
    if (!owner) return;
    e.preventDefault();
    owner.handler(e);
  };

  /** Attach while anything is live, detach when nothing is (no idle listener). */
  function sync() {
    const live = regs.length + layerStack.length + captures.length > 0;
    if (live && !attachedTo && typeof window !== 'undefined') {
      attachedTo = window;
      window.addEventListener('keydown', onKeyDownCapture, true);
      window.addEventListener('keydown', onKeyDown);
    } else if (!live && attachedTo) {
      attachedTo.removeEventListener('keydown', onKeyDownCapture, true);
      attachedTo.removeEventListener('keydown', onKeyDown);
      attachedTo = null;
    }
  }

  function collisions(): HotkeyCollision[] {
    const groups = new Map<string, Registration[]>();
    for (const r of regs) {
      const k = `${r.scope}\u0000${r.chord}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    return [...groups.values()]
      .filter((g) => g.length > 1)
      .map((g) => ({ chord: g[0].chord, scope: g[0].scope, owners: g.map((r) => r.id) }));
  }

  return {
    register(chord, handler, opts = {}) {
      const scope = opts.scope ?? 'shell';
      const reg: Registration = {
        chord, parsed: parseChord(chord), scope, handler,
        id: opts.id ?? `${scope}#${seq + 1}`, allowInInput: opts.allowInInput ?? false, seq: ++seq,
      };
      const rivals = regs.filter((r) => r.scope === scope && r.chord === chord);
      regs = [...regs, reg];
      if (rivals.length > 0) {
        logger.warn(`[hotkeys] '${chord}' has ${rivals.length + 1} owners in scope '${scope}' (${[...rivals.map((r) => r.id), reg.id].join(', ')}) — last registered wins`);
      }
      sync();
      return () => { regs = regs.filter((r) => r !== reg); sync(); };
    },
    pushLayer(id, close) {
      const layer: Layer = { id, close };
      layerStack = [...layerStack, layer];
      sync();
      return () => { layerStack = layerStack.filter((l) => l !== layer); sync(); };
    },
    captureNext(handler) {
      const capture: Capture = { handler };
      captures = [...captures, capture];
      sync();
      return () => { captures = captures.filter((c) => c !== capture); sync(); };
    },
    collisions,
    layers: () => layerStack.map((l) => l.id),
    reset() { regs = []; layerStack = []; captures = []; sync(); },
  };
}

/** The app's single keyboard door. Prefer the hooks in `@/hooks/useHotkey`. */
export const hotkeys: HotkeyRegistry = createHotkeyRegistry();
