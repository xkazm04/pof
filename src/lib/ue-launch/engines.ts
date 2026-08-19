/**
 * Resolves the UnrealEditor binary to launch — the engine-version seam that lets
 * PoF's autonomous UE ops target UE 5.8 (the official-MCP engine) instead of the
 * project's current 5.7, without hardcoding paths. Pure + env-injectable.
 *
 * ## Why `POF_UE_EDITOR_CMD` is here
 *
 * PoF had two vocabularies for one binary. The harness and the headless spawn executor
 * read **`POF_UE_EDITOR_CMD`** — which is what `.env` actually sets and the only one an
 * operator ever configures (`src/lib/harness/ue-gates.ts:resolveUeEnv`,
 * `src/lib/test-gate-runner/spawnExecutor.ts`). This resolver read `POF_UE_EDITOR` /
 * `POF_UE_CMD`, neither of which is set anywhere, and then fell through to a hardcoded
 * `UE_5.8` path that merely HAPPENED to equal the configured one. Move the engine install
 * and the harness keeps working while everything on this resolver hard-fails pointing at a
 * path the user never configured — and the old error told them to set two variables that
 * had nothing to do with their setup.
 *
 * Resolution order (first match wins):
 *   1. an explicit `cmd` path
 *   2. env override — `POF_UE_EDITOR` (windowed) / `POF_UE_CMD` (headless)
 *   3. `POF_UE_EDITOR_CMD` — the configured install. Used as-is for the headless binary;
 *      for the windowed one the sibling `UnrealEditor(.exe)` beside it is derived, but ONLY
 *      when the configured basename is literally `UnrealEditor-Cmd(.exe)` (that is the only
 *      case where the sibling's location is provable rather than guessed). Skipped entirely
 *      when a specific engine version was asked for — the configured install may not be
 *      that version, and re-pointing a 5.7 request at a 5.8 install would be a lie.
 *   4. `UE_<engine>` default path, where engine = opts.engine ?? POF_UE_ENGINE ?? '5.8'
 *
 * `resolveEditorBinaryDetailed` returns the same answer plus its provenance, so a
 * not-found error can name what it looked for and every variable it consulted
 * ({@link editorNotFoundMessage}).
 */
export type EnvLike = Record<string, string | undefined>;

export interface ResolveEditorOptions {
  /** Engine version for the default path, e.g. '5.7' | '5.8'. */
  engine?: string;
  /** true → windowed `UnrealEditor.exe` (can render); false → headless `UnrealEditor-Cmd.exe`. */
  windowed?: boolean;
  /** Explicit full binary path — wins over everything. */
  cmd?: string;
}

/** Which input produced the resolved path. */
export type EditorBinarySource =
  | 'opts.cmd'
  | 'POF_UE_EDITOR'
  | 'POF_UE_CMD'
  | 'POF_UE_EDITOR_CMD'
  | 'POF_UE_EDITOR_CMD-derived'
  | 'default';

/** One input the resolver looked at, and what it held. */
export interface ConsultedInput {
  name: string;
  /** The value found, or undefined when the variable was not set. */
  value?: string;
  /** Why this input did or did not decide the answer. */
  note?: string;
}

export interface EditorBinaryResolution {
  binary: string;
  source: EditorBinarySource;
  /** One-line human description of `source`, used in the not-found message. */
  sourceLabel: string;
  /** Every input consulted for THIS resolution, in the order they were consulted. */
  consulted: ConsultedInput[];
}

const DEFAULT_ENGINE = '5.8';

/** A set-and-non-blank env value, or undefined (matches the harness's `.trim()` rule). */
function read(env: EnvLike, name: string): string | undefined {
  const v = env[name]?.trim();
  return v ? v : undefined;
}

/**
 * `.../UnrealEditor-Cmd.exe` → `.../UnrealEditor.exe` (and the extension-less POSIX form).
 * Returns null when the basename is anything else: the windowed binary lives beside the
 * `-Cmd` one in Epic's layout, and that is the ONLY case where its location is provable.
 * A wrapper script or a renamed binary tells us nothing about where a windowed editor is,
 * so we fall through to the versioned default rather than fabricate a path.
 */
export function windowedSiblingOf(editorCmd: string): string | null {
  return /(^|[\\/])UnrealEditor-Cmd(\.exe)?$/i.test(editorCmd)
    ? editorCmd.replace(/UnrealEditor-Cmd(\.exe)?$/i, 'UnrealEditor$1')
    : null;
}

/** The `UE_<engine>` install-default path. */
function defaultPath(engine: string, windowed: boolean): string {
  const exe = windowed ? 'UnrealEditor.exe' : 'UnrealEditor-Cmd.exe';
  return `C:\\Program Files\\Epic Games\\UE_${engine}\\Engine\\Binaries\\Win64\\${exe}`;
}

/** Resolve the editor binary AND record how it got there. Pure. */
export function resolveEditorBinaryDetailed(
  opts: ResolveEditorOptions = {},
  env: EnvLike = process.env,
): EditorBinaryResolution {
  const windowed = !!opts.windowed;
  const consulted: ConsultedInput[] = [];

  if (opts.cmd) {
    return {
      binary: opts.cmd,
      source: 'opts.cmd',
      sourceLabel: 'the explicit `cmd` path passed by the caller',
      consulted: [{ name: 'opts.cmd', value: opts.cmd, note: 'explicit path — wins over every variable' }],
    };
  }
  consulted.push({ name: 'opts.cmd', note: 'not given' });

  // 2 — the per-mode overrides. Kept at higher precedence than the configured install so an
  // operator can still point one mode somewhere else without disturbing the harness.
  const overrideName = windowed ? 'POF_UE_EDITOR' : 'POF_UE_CMD';
  const override = read(env, overrideName);
  consulted.push({
    name: overrideName,
    ...(override ? { value: override } : {}),
    note: override ? 'override for this mode — used' : `not set (override for the ${windowed ? 'windowed' : 'headless'} binary)`,
  });
  if (override) {
    return { binary: override, source: overrideName as EditorBinarySource, sourceLabel: `the \`${overrideName}\` override`, consulted };
  }
  // The other mode's override is listed only when it is set, so it is clear it was seen and
  // deliberately not used rather than missed.
  const otherName = windowed ? 'POF_UE_CMD' : 'POF_UE_EDITOR';
  const other = read(env, otherName);
  if (other) {
    consulted.push({ name: otherName, value: other, note: `set, but it overrides the ${windowed ? 'headless' : 'windowed'} binary — this run needs the ${windowed ? 'windowed' : 'headless'} one` });
  }

  // 3 — the configured install (the variable the harness reads and `.env` sets).
  const configured = read(env, 'POF_UE_EDITOR_CMD');
  const engineRequested = opts.engine ?? read(env, 'POF_UE_ENGINE');
  const engine = engineRequested ?? DEFAULT_ENGINE;
  if (configured && engineRequested) {
    consulted.push({
      name: 'POF_UE_EDITOR_CMD',
      value: configured,
      note: `not used: engine ${engineRequested} was explicitly requested, and the configured install is not known to be that version`,
    });
  } else if (configured) {
    if (!windowed) {
      consulted.push({ name: 'POF_UE_EDITOR_CMD', value: configured, note: 'the configured install — used directly (this run needs the headless binary)' });
      return { binary: configured, source: 'POF_UE_EDITOR_CMD', sourceLabel: 'the configured install in `POF_UE_EDITOR_CMD`', consulted };
    }
    const sibling = windowedSiblingOf(configured);
    if (sibling) {
      consulted.push({ name: 'POF_UE_EDITOR_CMD', value: configured, note: 'the configured install — the windowed `UnrealEditor` sibling beside it was derived' });
      return {
        binary: sibling,
        source: 'POF_UE_EDITOR_CMD-derived',
        sourceLabel: 'the windowed sibling derived from the configured install in `POF_UE_EDITOR_CMD`',
        consulted,
      };
    }
    consulted.push({
      name: 'POF_UE_EDITOR_CMD',
      value: configured,
      note: 'not used for the windowed binary: its basename is not `UnrealEditor-Cmd`, so where the windowed editor sits cannot be derived from it — set POF_UE_EDITOR to name it directly',
    });
  } else {
    consulted.push({ name: 'POF_UE_EDITOR_CMD', note: 'not set (the install the harness reads — normally set in .env)' });
  }

  // 4 — the versioned default.
  consulted.push({
    name: 'POF_UE_ENGINE',
    ...(read(env, 'POF_UE_ENGINE') ? { value: read(env, 'POF_UE_ENGINE')! } : {}),
    note: opts.engine
      ? `overridden by the caller's engine option (${opts.engine})`
      : read(env, 'POF_UE_ENGINE')
        ? 'engine version for the default install path'
        : `not set (defaulting to ${DEFAULT_ENGINE})`,
  });
  return {
    binary: defaultPath(engine, windowed),
    source: 'default',
    sourceLabel: `the default UE_${engine} install path (nothing above resolved it)`,
    consulted,
  };
}

/** Resolve the editor binary. Thin wrapper over {@link resolveEditorBinaryDetailed}. */
export function resolveEditorBinary(opts: ResolveEditorOptions = {}, env: EnvLike = process.env): string {
  return resolveEditorBinaryDetailed(opts, env).binary;
}

/**
 * The message a "binary is not there" failure carries. It names the path tried, where that
 * path came from, and EVERY input consulted with what each held — so a moved engine install
 * produces a fixable error instead of a path the user never configured and advice to set two
 * variables that are not part of their setup.
 */
export function editorNotFoundMessage(res: EditorBinaryResolution): string {
  const lines = res.consulted.map((c) => `  - ${c.name}: ${c.value ? `"${c.value}"` : 'not set'}${c.note ? ` — ${c.note}` : ''}`);
  return [
    `UE editor not found at ${res.binary}`,
    `That path came from ${res.sourceLabel}.`,
    'Consulted, in order:',
    ...lines,
    'Fix: point POF_UE_EDITOR_CMD at your install\'s UnrealEditor-Cmd binary (the same variable the harness '
      + 'and the headless drain read), or set POF_UE_EDITOR / POF_UE_CMD to override just one mode.',
  ].join('\n');
}
